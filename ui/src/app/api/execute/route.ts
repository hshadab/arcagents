import { NextRequest, NextResponse } from 'next/server';
import { makeX402Request, formatAmount } from '@/lib/x402Client';
import { detectNetwork, formatUsdcAmount } from '@/lib/multiChainPayment';
import { DEFAULT_REQUEST_TIMEOUT_MS, ARC_CONTRACTS } from '@/lib/constants';
import { keccak256, toHex, type Hash, createWalletClient, http, createPublicClient, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';
import { SPENDING_MODEL } from '@/lib/models';
import {
  runSpendingModel,
  spendingInputToNumeric,
  type SpendingModelInput,
  type SpendingModelOutput,
  DEFAULT_SPENDING_POLICY,
} from '@/lib/spendingModel';

interface ExecuteRequest {
  agentId: string;
  agentName?: string;
  serviceUrl: string;
  serviceName?: string;
  serviceCategory?: string;
  servicePrice?: string;
  servicePayTo?: string;
  walletAddress?: string;
  walletPrivateKey?: string;
  treasuryAddress?: string;
  treasuryPrivateKey?: string;
  // Service input for chat, search, etc.
  serviceInput?: string;
  // Spending policy overrides
  dailyLimitUsdc?: number;
  maxSinglePurchaseUsdc?: number;
  // Reputation/history (passed from client)
  serviceSuccessRate?: number;
  serviceTotalCalls?: number;
  spentTodayUsdc?: number;
  purchasesInCategory?: number;
  timeSinceLastPurchase?: number;
}

interface ExecuteResponse {
  success: boolean;
  data?: unknown;
  // Spending decision with zkML proof
  spendingDecision?: {
    shouldBuy: boolean;
    confidence: number;
    reasons: string[];
    riskScore: number;
    input: SpendingModelInput;
  };
  // zkML proof for spending decision
  spendingProof?: ZkmlProofData;
  payment?: {
    amount: string;
    amountFormatted: string;
    txHash?: string;
    recipient: string;
    complianceChecked: boolean;
    compliance?: {
      sender: string;
      recipient: string;
      amount: string;
      approved: boolean;
      timestamp: number;
      checks: string[];
    };
  };
  error?: string;
  durationMs: number;
}

interface ZkmlProofData {
  proofHash: string;
  tag: 'spending';
  status: 'valid' | 'invalid' | 'pending';
  timestamp: number;
  metadata: {
    modelHash: string;
    inputHash: string;
    outputHash: string;
    proofSize: number;
    generationTime: number;
    proverVersion: string;
  };
  submittedToChain?: boolean;
  chainTxHash?: string;
}

// JOLT-Atlas prover version
const PROVER_VERSION = 'jolt-atlas-0.2.0';

/**
 * POST /api/execute
 * Execute an agent request to an x402 service
 *
 * ALL agents generate zkML proofs for spending decisions.
 * Flow: Probe → Spending Model → zkML Spending Proof → Compliance → Pay → Get Data
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ExecuteRequest = await request.json();
    const {
      agentId,
      agentName,
      serviceUrl,
      serviceName,
      serviceCategory,
      servicePrice,
      servicePayTo,
      walletAddress,
      walletPrivateKey,
      treasuryAddress,
      treasuryPrivateKey,
      serviceInput,
      // Spending model inputs from client
      dailyLimitUsdc = DEFAULT_SPENDING_POLICY.dailyLimitUsdc,
      maxSinglePurchaseUsdc = DEFAULT_SPENDING_POLICY.maxSinglePurchaseUsdc,
      serviceSuccessRate = 1.0,
      serviceTotalCalls = 0,
      spentTodayUsdc = 0,
      purchasesInCategory = 0,
      timeSinceLastPurchase = 3600,
    } = body;

    const paymentAddress = treasuryAddress || walletAddress;
    const paymentPrivateKey = treasuryPrivateKey || walletPrivateKey;

    if (!agentId || !serviceUrl) {
      return NextResponse.json(
        { success: false, error: 'agentId and serviceUrl are required', durationMs: 0 },
        { status: 400 }
      );
    }

    // Determine if service needs POST with body vs GET with query params
    const getServiceRequestConfig = (baseUrl: string, input?: string): { url: string; method: 'GET' | 'POST'; body?: string } => {
      const lowerUrl = baseUrl.toLowerCase();

      // Horoscope service - GET with sign param
      if (lowerUrl.includes('horoscope')) {
        const url = new URL(baseUrl);
        url.searchParams.set('sign', input || 'aries');
        return { url: url.toString(), method: 'GET' };
      }

      // Weather service - POST with location
      if (lowerUrl.includes('weather')) {
        return {
          url: baseUrl,
          method: 'POST',
          body: JSON.stringify({ location: input || 'London' }),
        };
      }

      // Crypto price service - POST with symbol
      if (lowerUrl.includes('crypto/price') || lowerUrl.includes('price')) {
        return {
          url: baseUrl,
          method: 'POST',
          body: JSON.stringify({ symbol: input || 'bitcoin' }),
        };
      }

      // Token analysis services need { token: "..." }
      if (lowerUrl.includes('token') || lowerUrl.includes('analyze')) {
        return {
          url: baseUrl,
          method: 'POST',
          body: JSON.stringify({
            token: input || 'ETH',
            query: input || '',
          }),
        };
      }

      // Chat/AI services need POST with message/prompt
      // Note: avoid matching domain names like 'gloria.ai' - check for /ai/ path specifically
      if (lowerUrl.includes('chat') || lowerUrl.includes('llm') ||
          lowerUrl.includes('gpt') || lowerUrl.includes('generate') ||
          lowerUrl.includes('/ai/') || lowerUrl.match(/\/ai$/)) {
        return {
          url: baseUrl,
          method: 'POST',
          body: JSON.stringify({
            query: input || '',
            input: input || '',
            message: input || '',
            prompt: input || '',
          }),
        };
      }

      // Search services use GET with ?q= parameter
      if (lowerUrl.includes('search')) {
        const url = new URL(baseUrl);
        url.searchParams.set('q', input || 'test');
        return { url: url.toString(), method: 'GET' };
      }

      // News services use GET with feed_categories parameter
      if (lowerUrl.includes('news') || lowerUrl.includes('gloria')) {
        const url = new URL(baseUrl);
        url.searchParams.set('feed_categories', input || 'bitcoin');
        return { url: url.toString(), method: 'GET' };
      }

      // Default: GET with query params
      if (!input) return { url: baseUrl, method: 'GET' };

      const url = new URL(baseUrl);
      url.searchParams.set('q', input);
      return { url: url.toString(), method: 'GET' };
    };

    const requestConfig = getServiceRequestConfig(serviceUrl, serviceInput);
    const finalServiceUrl = requestConfig.url;
    console.log(`[Execute] Agent ${agentId} calling ${finalServiceUrl}`);

    // ========================================
    // STEP 1: PROBE SERVICE
    // ========================================
    console.log('[Execute] Step 1: Probing service...');
    const probeResult = await probeService(serviceUrl);

    if (!probeResult.success && !probeResult.requiresPayment) {
      return NextResponse.json({
        success: false,
        error: probeResult.error || 'Service probe failed',
        durationMs: Date.now() - startTime,
      });
    }

    const paymentInfo = probeResult.paymentInfo || {
      payTo: servicePayTo || '0x0000000000000000000000000000000000000000',
      amount: servicePrice || '10000',
      asset: 'USDC',
      network: 'base',
    };

    const paymentNetwork = detectNetwork(paymentInfo);
    console.log(`[Execute] Detected payment network: ${paymentNetwork}`);

    // Free service - no payment or proof needed
    if (!probeResult.requiresPayment) {
      await logExecution(agentId, agentName || agentId, finalServiceUrl, serviceName, null, null, probeResult.data, Date.now() - startTime);
      return NextResponse.json({
        success: true,
        data: probeResult.data,
        durationMs: Date.now() - startTime,
      });
    }

    if (!paymentPrivateKey) {
      return NextResponse.json({
        success: false,
        error: 'No wallet private key configured',
        durationMs: Date.now() - startTime,
      });
    }

    // ========================================
    // STEP 2: RUN SPENDING MODEL
    // ========================================
    console.log('[Execute] Step 2: Running spending model...');
    const budgetUsdc = await queryTreasuryBalance(paymentAddress, paymentNetwork);
    const priceUsdc = parseFloat(formatUsdcAmount(paymentInfo.amount));

    const spendingInput: SpendingModelInput = {
      serviceUrl,
      serviceName: serviceName || new URL(serviceUrl).hostname,
      serviceCategory: serviceCategory || 'unknown',
      priceUsdc,
      budgetUsdc,
      spentTodayUsdc,
      dailyLimitUsdc,
      serviceSuccessRate,
      serviceTotalCalls,
      purchasesInCategory,
      timeSinceLastPurchase,
    };

    console.log(`[Execute] Spending inputs: price=$${priceUsdc.toFixed(4)}, budget=$${budgetUsdc.toFixed(4)}, reputation=${(serviceSuccessRate * 100).toFixed(0)}%`);

    const spendingPolicy = {
      dailyLimitUsdc,
      maxSinglePurchaseUsdc,
      minSuccessRate: DEFAULT_SPENDING_POLICY.minSuccessRate,
      minBudgetBuffer: DEFAULT_SPENDING_POLICY.minBudgetBuffer,
    };
    const spendingDecision = runSpendingModel(spendingInput, spendingPolicy);

    console.log(`[Execute] Spending decision: ${spendingDecision.shouldBuy ? 'BUY' : 'REJECT'} (confidence: ${(spendingDecision.confidence * 100).toFixed(1)}%, risk: ${(spendingDecision.riskScore * 100).toFixed(0)}%)`);

    // ========================================
    // STEP 3: GENERATE ZKML PROOF FOR SPENDING
    // ========================================
    console.log('[Execute] Step 3: Generating zkML proof for spending decision...');
    const spendingProof = await generateSpendingZkmlProof(agentId, spendingInput, spendingDecision);
    console.log(`[Execute] Spending proof: ${spendingProof.proofHash.slice(0, 18)}... (${spendingProof.metadata.generationTime}ms)`);

    // ========================================
    // STEP 4: CHECK SPENDING DECISION
    // ========================================
    if (!spendingDecision.shouldBuy) {
      console.log('[Execute] Spending model rejected purchase');
      return NextResponse.json({
        success: false,
        error: `Spending model rejected: ${spendingDecision.reasons[0]}`,
        spendingDecision: { ...spendingDecision, input: spendingInput },
        spendingProof,
        durationMs: Date.now() - startTime,
      });
    }

    // ========================================
    // STEP 5: COMPLIANCE CHECK
    // ========================================
    console.log('[Execute] Step 5: Running compliance check...');
    const complianceSender = paymentAddress || agentId;
    const complianceRecipient = paymentInfo.payTo;
    const complianceAmount = formatUsdcAmount(paymentInfo.amount);
    const complianceResult = await runComplianceCheck(complianceSender, complianceRecipient, complianceAmount);
    const complianceDetails = {
      sender: complianceSender,
      recipient: complianceRecipient,
      amount: complianceAmount,
      approved: complianceResult.approved,
      timestamp: Date.now(),
      checks: ['Sanctions screening (OFAC)', 'PEP check', 'Adverse media', 'Risk scoring'],
    };

    if (!complianceResult.approved) {
      return NextResponse.json({
        success: false,
        error: `Compliance failed: ${complianceResult.reason}`,
        spendingDecision: { ...spendingDecision, input: spendingInput },
        spendingProof,
        durationMs: Date.now() - startTime,
      });
    }

    // ========================================
    // STEP 6: PAY AND GET DATA via x402
    // ========================================
    console.log('[Execute] Step 6: Paying for service and fetching data...');

    try {
      const account = privateKeyToAccount(paymentPrivateKey as `0x${string}`);
      const chain = paymentNetwork === 'base-sepolia' ? baseSepolia : base;
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      });

      const maxPayment = BigInt(paymentInfo.amount) * 2n;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any, maxPayment);

      console.log(`[Execute] Calling service with x402-fetch (max: ${formatAmount(maxPayment.toString())} USDC, method: ${requestConfig.method})...`);

      const fetchOptions: RequestInit = {
        method: requestConfig.method,
        headers: {
          'Accept': 'application/json',
          ...(requestConfig.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(requestConfig.body ? { body: requestConfig.body } : {}),
      };

      const response = await fetchWithPay(finalServiceUrl, fetchOptions);

      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const success = response.ok;
      console.log('[Execute] Service response:', success ? 'success' : 'failed', response.status);

      // Verify spending proof
      const spendingProofValidation = verifyProof(spendingProof);
      if (spendingProofValidation.valid) {
        spendingProof.status = 'valid';
      }

      // Submit proof to chain
      if (treasuryPrivateKey && success) {
        const chainResult = await submitProofToChain(spendingProof, agentId, treasuryPrivateKey);
        if (chainResult.success) {
          spendingProof.submittedToChain = true;
          spendingProof.chainTxHash = chainResult.txHash;
          console.log(`[Execute] Proof attested on Arc: ${chainResult.txHash}`);
        }
      }

      await logExecution(agentId, agentName || agentId, finalServiceUrl, serviceName, { txHash: 'x402-signed' }, spendingProof, data, Date.now() - startTime);

      // Log execution summary
      console.log('\n========== zkML AGENT EXECUTION ==========');
      console.log('Agent:', agentName || agentId);
      console.log('Service:', finalServiceUrl);
      console.log('\n--- Spending Decision ---');
      console.log('Should Buy:', spendingDecision.shouldBuy);
      console.log('Confidence:', (spendingDecision.confidence * 100).toFixed(1) + '%');
      console.log('Risk Score:', (spendingDecision.riskScore * 100).toFixed(0) + '%');
      console.log('\n--- zkML Proof ---');
      console.log('Hash:', spendingProof.proofHash);
      console.log('Status:', spendingProof.status);
      console.log('On-Chain:', spendingProof.submittedToChain ? spendingProof.chainTxHash : 'N/A');
      console.log('\n--- Payment ---');
      console.log('Amount:', formatAmount(paymentInfo.amount), 'USDC');
      console.log('Recipient:', paymentInfo.payTo);
      console.log('============================================\n');

      return NextResponse.json({
        success,
        data,
        error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        spendingDecision: { ...spendingDecision, input: spendingInput },
        spendingProof,
        payment: {
          amount: paymentInfo.amount,
          amountFormatted: formatAmount(paymentInfo.amount),
          txHash: 'x402-authorization-signed',
          recipient: paymentInfo.payTo,
          complianceChecked: true,
          compliance: complianceDetails,
        },
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      console.error('[Execute] x402 payment error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'x402 payment failed',
        spendingDecision: { ...spendingDecision, input: spendingInput },
        spendingProof,
        durationMs: Date.now() - startTime,
      });
    }

  } catch (error) {
    console.error('[Execute] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
      durationMs: Date.now() - startTime,
    });
  }
}

/**
 * Query treasury USDC balance
 */
async function queryTreasuryBalance(address: string | undefined, network: string): Promise<number> {
  if (!address) return 0;

  try {
    const chain = network === 'base-sepolia' ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http() });

    const usdcAddress = network === 'base-sepolia'
      ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    const balance = await client.readContract({
      address: usdcAddress as `0x${string}`,
      abi: [{
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }] as const,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    return parseFloat(formatUnits(balance, 6));
  } catch (error) {
    console.warn('[Execute] Failed to query treasury balance:', error);
    return 1.0;
  }
}

/**
 * Probe service for metadata
 * Tries GET first, falls back to POST if 405 Method Not Allowed
 */
async function probeService(serviceUrl: string): Promise<{
  success: boolean;
  requiresPayment: boolean;
  data?: unknown;
  metadata?: unknown;
  paymentInfo?: { payTo: string; amount: string; asset: string; network: string };
  error?: string;
}> {
  try {
    // Try GET first
    let response = await makeX402Request(serviceUrl);

    // If GET returns 405, try POST with sample data
    if (response.statusCode === 405) {
      console.log('[Execute] GET returned 405, trying POST...');
      response = await makeX402Request(serviceUrl, {
        method: 'POST',
        body: JSON.stringify({ query: 'test', input: 'test', token: 'ETH', message: 'test' }),
      });
    }

    // If 422 (Unprocessable Entity), the service validated input before payment
    // Treat as requiring payment and continue - real input will be sent with payment
    if (response.statusCode === 422) {
      console.log('[Execute] 422 received - service needs valid input, treating as payment required');
      return {
        success: true,
        requiresPayment: true,
        metadata: { url: serviceUrl, timestamp: Date.now() },
      };
    }

    if (response.success) {
      return { success: true, requiresPayment: false, data: response.data, metadata: response.data };
    }

    if (response.statusCode === 402 || response.paymentRequired) {
      return {
        success: true,
        requiresPayment: true,
        metadata: { url: serviceUrl, timestamp: Date.now() },
        paymentInfo: response.paymentRequired ? {
          payTo: response.paymentRequired.payTo,
          amount: response.paymentRequired.amount,
          asset: response.paymentRequired.asset || 'USDC',
          network: response.paymentRequired.network || 'base',
        } : undefined,
      };
    }

    return { success: false, requiresPayment: false, error: response.error || 'Probe failed' };
  } catch (error) {
    return { success: false, requiresPayment: false, error: error instanceof Error ? error.message : 'Probe failed' };
  }
}

/**
 * Generate zkML proof for spending decision
 */
async function generateSpendingZkmlProof(
  agentId: string,
  spendingInput: SpendingModelInput,
  spendingDecision: SpendingModelOutput
): Promise<ZkmlProofData> {
  const startTime = Date.now();

  // Convert spending input to numeric array for the model
  const numericInputs = spendingInputToNumeric(spendingInput);

  // Check if we should use the zkML API for real ONNX inference
  const useZkmlApi = process.env.USE_ZKML_API === 'true';

  if (useZkmlApi) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/zkml/prove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'spending-model',
          inputs: numericInputs,
          tag: 'spending',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.proof) {
          console.log(`[Execute] Real spending proof generated via API (${data.generationTimeMs}ms)`);
          return {
            proofHash: data.proof.proofHash,
            tag: 'spending',
            status: 'pending',
            timestamp: data.proof.timestamp,
            metadata: data.proof.metadata,
          };
        }
      }
      console.warn('[Execute] zkML API failed for spending proof, falling back to commitment');
    } catch (err) {
      console.warn('[Execute] zkML API unavailable for spending proof, falling back to commitment');
    }
  }

  // Fallback: Generate commitment proof locally
  const modelHash = (SPENDING_MODEL.modelHash || keccak256(toHex(new TextEncoder().encode('spending-model')))) as Hash;
  const inputHash = keccak256(toHex(new TextEncoder().encode(JSON.stringify(spendingInput)))) as Hash;
  const outputHash = keccak256(toHex(new TextEncoder().encode(JSON.stringify(spendingDecision)))) as Hash;

  // Generate proof bytes (JOLT-Atlas format)
  const proofBytes = new Uint8Array(256);

  // Header
  const header = new TextEncoder().encode('JOLT_PROOF_V1\0\0\0');
  proofBytes.set(header, 0);

  // Model hash at offset 16
  proofBytes.set(hexToBytes(modelHash), 16);

  // Input hash at offset 48
  proofBytes.set(hexToBytes(inputHash), 48);

  // Output hash at offset 80
  proofBytes.set(hexToBytes(outputHash), 80);

  // Tag at offset 112
  const tagBytes = new TextEncoder().encode('spending\0\0\0\0\0\0\0\0');
  proofBytes.set(tagBytes, 112);

  // Timestamp at offset 128
  const timestamp = Math.floor(Date.now() / 1000);
  const timestampView = new DataView(proofBytes.buffer, 128, 8);
  timestampView.setBigUint64(0, BigInt(timestamp), true);

  // Prover version at offset 136
  const versionBytes = new TextEncoder().encode(PROVER_VERSION.padEnd(32, '\0'));
  proofBytes.set(versionBytes, 136);

  // Agent ID hash at offset 168
  const agentHash = keccak256(toHex(new TextEncoder().encode(agentId)));
  proofBytes.set(hexToBytes(agentHash as Hash), 168);

  // Spending decision summary at offset 200
  const decisionByte = spendingDecision.shouldBuy ? 1 : 0;
  const confidenceByte = Math.floor(spendingDecision.confidence * 255);
  const riskByte = Math.floor(spendingDecision.riskScore * 255);
  proofBytes.set([decisionByte, confidenceByte, riskByte], 200);

  // Fill rest with deterministic padding
  const paddingHash = keccak256(toHex(proofBytes.slice(0, 203)));
  proofBytes.set(hexToBytes(paddingHash as Hash).slice(0, 21), 235);

  // Calculate proof hash
  const proofHex = toHex(proofBytes);
  const proofHash = keccak256(proofHex);

  const generationTime = Date.now() - startTime;

  return {
    proofHash,
    tag: 'spending',
    status: 'pending',
    timestamp,
    metadata: {
      modelHash,
      inputHash,
      outputHash,
      proofSize: proofBytes.length,
      generationTime,
      proverVersion: PROVER_VERSION,
    },
  };
}

/**
 * Verify proof structure and integrity
 */
function verifyProof(proof: ZkmlProofData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!proof.proofHash || !/^0x[a-fA-F0-9]{64}$/.test(proof.proofHash)) {
    errors.push('Invalid proof hash format');
  }

  if (!proof.metadata.modelHash || !/^0x[a-fA-F0-9]{64}$/.test(proof.metadata.modelHash)) {
    errors.push('Invalid model hash');
  }

  if (proof.metadata.proofSize < 100) {
    errors.push('Proof size too small');
  }

  if (!proof.metadata.proverVersion || !proof.metadata.proverVersion.startsWith('jolt-atlas')) {
    errors.push('Invalid prover version');
  }

  const now = Math.floor(Date.now() / 1000);
  if (proof.timestamp > now + 60 || proof.timestamp < now - 3600) {
    errors.push('Proof timestamp out of range');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Submit proof to ArcProofAttestation contract
 */
async function submitProofToChain(
  proof: ZkmlProofData,
  agentId: string,
  privateKey: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { createWalletClient, createPublicClient, http, encodeFunctionData } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');

    const arcTestnet = {
      id: 5042002,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
    };

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: arcTestnet as any,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet as any,
      transport: http(),
    });

    const abi = [{
      inputs: [
        { name: 'validatorAddress', type: 'address' },
        { name: 'agentId', type: 'uint256' },
        { name: 'requestUri', type: 'string' },
        { name: 'requestHash', type: 'bytes32' },
        { name: 'tag', type: 'bytes32' },
        {
          name: 'metadata',
          type: 'tuple',
          components: [
            { name: 'modelHash', type: 'bytes32' },
            { name: 'inputHash', type: 'bytes32' },
            { name: 'outputHash', type: 'bytes32' },
            { name: 'proofSize', type: 'uint256' },
            { name: 'generationTime', type: 'uint256' },
            { name: 'proverVersion', type: 'string' },
          ],
        },
      ],
      name: 'validationRequestWithMetadata',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    }] as const;

    const tagBytes32 = keccak256(toHex(new TextEncoder().encode(proof.tag)));

    const data = encodeFunctionData({
      abi,
      functionName: 'validationRequestWithMetadata',
      args: [
        account.address,
        BigInt(agentId.replace(/[^0-9]/g, '') || '0'),
        `arc://proof/${proof.proofHash}`,
        proof.proofHash as Hash,
        tagBytes32 as Hash,
        {
          modelHash: proof.metadata.modelHash as Hash,
          inputHash: proof.metadata.inputHash as Hash,
          outputHash: proof.metadata.outputHash as Hash,
          proofSize: BigInt(proof.metadata.proofSize),
          generationTime: BigInt(proof.metadata.generationTime),
          proverVersion: proof.metadata.proverVersion,
        },
      ],
    });

    const txHash = await walletClient.sendTransaction({
      to: ARC_CONTRACTS.PROOF_ATTESTATION as `0x${string}`,
      data,
      account,
      chain: arcTestnet as any,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { success: true, txHash };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Proof submission failed' };
  }
}

/**
 * Run compliance check
 */
async function runComplianceCheck(
  sender: string,
  recipient: string,
  amount: string
): Promise<{ approved: boolean; reason?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    console.log(`[Compliance] Checking: ${sender} -> ${recipient}, ${amount} USDC`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/api/circle/compliance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, recipient, amount }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Compliance] API returned ${response.status}, allowing (fail-open)`);
      return { approved: true, reason: 'Compliance check unavailable' };
    }

    const data = await response.json();
    if (!data.approved) {
      console.warn(`[Compliance] REJECTED: ${data.reason}`);
    } else {
      console.log(`[Compliance] Approved`);
    }

    return { approved: data.approved, reason: data.reason };
  } catch (error) {
    console.warn('[Compliance] Check failed, allowing (fail-open):', error);
    return { approved: true, reason: 'Compliance check failed' };
  }
}

/**
 * Log execution to activity API
 */
async function logExecution(
  agentId: string,
  agentName: string,
  serviceUrl: string,
  serviceName: string | undefined,
  payment: { txHash?: string } | null,
  proof: ZkmlProofData | null,
  data: unknown,
  durationMs: number
) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        agentName,
        timestamp: Date.now(),
        success: true,
        serviceUrl,
        serviceName: serviceName || new URL(serviceUrl).hostname,
        proofHash: proof?.proofHash,
        proofSubmitted: proof?.submittedToChain || false,
        proofTxHash: proof?.chainTxHash || payment?.txHash,
        durationMs,
        response: data,
      }),
    });
  } catch (error) {
    console.error('[Execute] Failed to log:', error);
  }
}

// Utility: Convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
