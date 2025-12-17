import { NextRequest, NextResponse } from 'next/server';
import { makeX402Request, makeX402PaidRequest, formatAmount } from '@/lib/x402Client';
import {
  sendPayment,
  detectNetwork,
  simulatePayment,
  formatUsdcAmount,
  type WalletInfo,
} from '@/lib/multiChainPayment';
import type { MultiChainWallets } from '@/lib/agentStorage';

interface ExecuteRequest {
  agentId: string;
  agentName?: string;
  serviceUrl: string;
  serviceName?: string;
  servicePrice?: string;        // Price in atomic units
  servicePayTo?: string;        // Payment recipient
  walletAddress?: string;       // Agent wallet address (EVM)
  walletPrivateKey?: string;    // Legacy: EVM private key
  wallets?: MultiChainWallets;  // Multi-chain wallets
  // ML Agent fields
  zkmlEnabled?: boolean;        // Whether this agent runs proofs
  modelName?: string;           // ONNX model name
  threshold?: number;           // Decision threshold (0-1)
}

interface ExecuteResponse {
  success: boolean;
  data?: unknown;
  modelInference?: {
    modelName: string;
    input: unknown;
    output: number;
    decision: 'approve' | 'reject';
    threshold: number;
  };
  proof?: ProofData;
  payment?: {
    amount: string;
    amountFormatted: string;
    txHash?: string;
    recipient: string;
    simulated: boolean;
    complianceChecked: boolean;
  };
  error?: string;
  durationMs: number;
  executionType: 'ml-agent' | 'simple-agent';
}

interface ProofData {
  hash: string;
  tag: 'authorization' | 'compliance' | 'collision_severity';
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
}

/**
 * POST /api/execute
 * Execute an agent request to an x402 service
 *
 * ML Agent Flow:  Probe → Model Inference → Proof → [if valid] → Pay → Execute
 * Simple Agent Flow: Probe → Pay → Execute
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
      servicePrice,
      servicePayTo,
      walletAddress,
      walletPrivateKey,
      wallets,
      zkmlEnabled,
      modelName,
      threshold = 0.7,
    } = body;

    if (!agentId || !serviceUrl) {
      return NextResponse.json(
        { success: false, error: 'agentId and serviceUrl are required', durationMs: 0, executionType: 'simple-agent' },
        { status: 400 }
      );
    }

    const isMLAgent = zkmlEnabled && modelName;
    console.log(`[Execute] Agent ${agentId} (${isMLAgent ? 'ML' : 'Simple'}) calling ${serviceUrl}`);

    // ========================================
    // STEP 1: PROBE SERVICE (free metadata request)
    // ========================================
    console.log('[Execute] Step 1: Probing service...');
    const probeResult = await probeService(serviceUrl);

    if (!probeResult.success && !probeResult.requiresPayment) {
      return NextResponse.json({
        success: false,
        error: probeResult.error || 'Service probe failed',
        durationMs: Date.now() - startTime,
        executionType: isMLAgent ? 'ml-agent' : 'simple-agent',
      });
    }

    // Get payment info from probe
    const paymentInfo = probeResult.paymentInfo || {
      payTo: servicePayTo || '0x0000000000000000000000000000000000000000',
      amount: servicePrice || '10000',
      asset: 'USDC',
      network: 'base', // Default to Base for real services
    };

    // Detect the correct network for payment
    const paymentNetwork = detectNetwork(paymentInfo);
    console.log(`[Execute] Detected payment network: ${paymentNetwork}`);

    // ========================================
    // ML AGENT FLOW: Model → Proof → Pay
    // ========================================
    if (isMLAgent) {
      console.log('[Execute] ML Agent flow: Model → Proof → Pay');

      // STEP 2: RUN MODEL INFERENCE
      console.log('[Execute] Step 2: Running model inference...');
      const inference = runModelInference(modelName, probeResult.metadata, threshold);

      console.log(`[Execute] Model output: ${inference.output.toFixed(4)}, threshold: ${threshold}, decision: ${inference.decision}`);

      // STEP 3: GENERATE ZKML PROOF (before payment!)
      console.log('[Execute] Step 3: Generating zkML proof...');
      const proof = generateProof(
        agentId,
        modelName,
        probeResult.metadata,
        inference.output
      );

      console.log(`[Execute] Proof generated: ${proof.hash.slice(0, 18)}... (${proof.metadata.generationTime}ms)`);

      // STEP 4: VERIFY PROOF LOCALLY
      console.log('[Execute] Step 4: Verifying proof locally...');
      const proofValid = verifyProofLocally(proof);

      if (!proofValid) {
        console.log('[Execute] Proof verification failed - blocking payment');
        return NextResponse.json({
          success: false,
          error: 'Proof verification failed - payment blocked',
          modelInference: {
            modelName,
            input: probeResult.metadata,
            output: inference.output,
            decision: inference.decision,
            threshold,
          },
          proof: { ...proof, status: 'invalid' as const },
          durationMs: Date.now() - startTime,
          executionType: 'ml-agent',
        });
      }

      proof.status = 'valid';
      console.log('[Execute] Proof verified successfully');

      // STEP 5: CHECK IF MODEL DECISION APPROVES ACTION
      if (inference.decision === 'reject') {
        console.log('[Execute] Model decision: REJECT - no payment made');
        return NextResponse.json({
          success: true,
          data: { message: 'Model decision below threshold - action not taken', probeData: probeResult.metadata },
          modelInference: {
            modelName,
            input: probeResult.metadata,
            output: inference.output,
            decision: inference.decision,
            threshold,
          },
          proof,
          durationMs: Date.now() - startTime,
          executionType: 'ml-agent',
        });
      }

      // STEP 6: MAKE PAYMENT (only after proof is valid AND model approves)
      console.log(`[Execute] Step 5: Making payment on ${paymentNetwork} (proof valid, model approved)...`);
      const payment = await makeMultiChainPayment(
        walletAddress || `0x${agentId.slice(-40)}`,
        paymentInfo.payTo,
        paymentInfo.amount,
        paymentNetwork,
        wallets,
        walletPrivateKey
      );

      if (!payment.success) {
        return NextResponse.json({
          success: false,
          error: payment.error || 'Payment failed',
          modelInference: {
            modelName,
            input: probeResult.metadata,
            output: inference.output,
            decision: inference.decision,
            threshold,
          },
          proof,
          durationMs: Date.now() - startTime,
          executionType: 'ml-agent',
        });
      }

      // STEP 7: EXECUTE SERVICE WITH PAYMENT
      console.log('[Execute] Step 6: Executing service with payment...');
      const serviceResponse = await makeX402PaidRequest(serviceUrl, {
        txHash: payment.txHash || `0x${Date.now().toString(16)}`,
        amount: paymentInfo.amount,
        payer: walletAddress || agentId,
      });

      // Log execution
      await logExecution(agentId, agentName || agentId, serviceUrl, serviceName, payment, proof, serviceResponse.data, Date.now() - startTime);

      return NextResponse.json({
        success: true,
        data: serviceResponse.data,
        modelInference: {
          modelName,
          input: probeResult.metadata,
          output: inference.output,
          decision: inference.decision,
          threshold,
        },
        proof,
        payment: {
          amount: paymentInfo.amount,
          amountFormatted: formatAmount(paymentInfo.amount),
          txHash: payment.txHash,
          recipient: paymentInfo.payTo,
          simulated: payment.simulated,
          complianceChecked: payment.complianceChecked,
        },
        durationMs: Date.now() - startTime,
        executionType: 'ml-agent',
      });
    }

    // ========================================
    // SIMPLE AGENT FLOW: Pay → Execute
    // ========================================
    console.log('[Execute] Simple Agent flow: Pay → Execute');

    // If no payment required, return probe data
    if (!probeResult.requiresPayment) {
      await logExecution(agentId, agentName || agentId, serviceUrl, serviceName, null, null, probeResult.data, Date.now() - startTime);
      return NextResponse.json({
        success: true,
        data: probeResult.data,
        durationMs: Date.now() - startTime,
        executionType: 'simple-agent',
      });
    }

    // STEP 2: MAKE PAYMENT
    console.log(`[Execute] Step 2: Making payment on ${paymentNetwork}...`);
    const payment = await makeMultiChainPayment(
      walletAddress || `0x${agentId.slice(-40)}`,
      paymentInfo.payTo,
      paymentInfo.amount,
      paymentNetwork,
      wallets,
      walletPrivateKey
    );

    if (!payment.success) {
      return NextResponse.json({
        success: false,
        error: payment.error || 'Payment failed',
        durationMs: Date.now() - startTime,
        executionType: 'simple-agent',
      });
    }

    // STEP 3: EXECUTE SERVICE
    console.log('[Execute] Step 3: Executing service...');
    const serviceResponse = await makeX402PaidRequest(serviceUrl, {
      txHash: payment.txHash || `0x${Date.now().toString(16)}`,
      amount: paymentInfo.amount,
      payer: walletAddress || agentId,
    });

    console.log('[Execute] Service response:', serviceResponse.success ? 'success' : 'failed', serviceResponse.statusCode);

    // Determine what data to return
    let responseData: unknown;
    let note: string | undefined;

    if (serviceResponse.success && serviceResponse.data) {
      // Real service response
      responseData = serviceResponse.data;
    } else if (payment.simulated) {
      // Payment was simulated - service likely rejected it
      // Return probe metadata as demo data
      responseData = {
        _demo: true,
        _note: 'Payment simulated - showing service metadata. Real x402 services require on-chain payment on their specific network.',
        serviceUrl,
        serviceName: serviceName || 'Unknown',
        serviceMetadata: probeResult.metadata,
        paymentInfo: {
          required: paymentInfo.amount,
          network: paymentInfo.network,
          asset: paymentInfo.asset,
          recipient: paymentInfo.payTo,
        },
      };
      note = 'Simulated payment - real services require actual on-chain payment';
    } else {
      // Real payment but service failed
      responseData = serviceResponse.data || { error: 'Service did not return data' };
    }

    await logExecution(agentId, agentName || agentId, serviceUrl, serviceName, payment, null, responseData, Date.now() - startTime);

    return NextResponse.json({
      success: true,
      data: responseData,
      note,
      payment: {
        amount: paymentInfo.amount,
        amountFormatted: formatAmount(paymentInfo.amount),
        txHash: payment.txHash,
        recipient: paymentInfo.payTo,
        simulated: payment.simulated,
        complianceChecked: payment.complianceChecked,
      },
      durationMs: Date.now() - startTime,
      executionType: 'simple-agent',
    });

  } catch (error) {
    console.error('[Execute] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
      durationMs: Date.now() - startTime,
      executionType: 'simple-agent',
    });
  }
}

/**
 * Probe service to get metadata (free request)
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
    const response = await makeX402Request(serviceUrl);

    if (response.success) {
      return {
        success: true,
        requiresPayment: false,
        data: response.data,
        metadata: response.data,
      };
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
          network: response.paymentRequired.network || 'arc-testnet',
        } : undefined,
      };
    }

    return {
      success: false,
      requiresPayment: false,
      error: response.error || 'Probe failed',
    };
  } catch (error) {
    return {
      success: false,
      requiresPayment: false,
      error: error instanceof Error ? error.message : 'Probe failed',
    };
  }
}

/**
 * Run ONNX model inference (simulated)
 * In production, this would use ONNX Runtime to execute the actual model
 */
function runModelInference(
  modelName: string,
  input: unknown,
  threshold: number
): { output: number; decision: 'approve' | 'reject' } {
  // Simulate model inference
  // In production: const session = await ort.InferenceSession.create(modelPath);
  // const results = await session.run(inputTensor);

  const inputHash = simpleHash(JSON.stringify(input));
  const modelHash = simpleHash(modelName);

  // Deterministic "inference" based on input and model
  const combinedHash = (inputHash + modelHash) % 1000;
  const output = combinedHash / 1000; // 0-1 range

  // Add some randomness for demo variety
  const finalOutput = Math.min(1, Math.max(0, output + (Math.random() - 0.5) * 0.2));

  return {
    output: finalOutput,
    decision: finalOutput >= threshold ? 'approve' : 'reject',
  };
}

/**
 * Generate zkML proof of model execution
 * This happens BEFORE payment for ML agents
 */
function generateProof(
  agentId: string,
  modelName: string,
  input: unknown,
  output: number
): ProofData {
  const inputStr = JSON.stringify(input || {});
  const outputStr = output.toString();

  // Generate deterministic hashes
  const inputHash = `0x${simpleHash(inputStr).toString().padStart(64, '0')}`;
  const outputHash = `0x${simpleHash(outputStr).toString().padStart(64, '0')}`;
  const modelHash = `0x${simpleHash(modelName).toString().padStart(64, '0')}`;
  const proofHash = `0x${simpleHash(`${modelHash}${inputHash}${outputHash}${Date.now()}`).toString().padStart(64, '0')}`;

  // Simulate proof generation time (50-200ms)
  const generationTime = 50 + Math.floor(Math.random() * 150);

  return {
    hash: proofHash,
    tag: 'authorization',
    status: 'pending',
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      modelHash,
      inputHash,
      outputHash,
      proofSize: 1024 + Math.floor(Math.random() * 512),
      generationTime,
      proverVersion: 'jolt-atlas-0.2.0',
    },
  };
}

/**
 * Verify proof locally
 * In production: Use JOLT verifier to cryptographically verify the proof
 */
function verifyProofLocally(proof: ProofData): boolean {
  // Simulate verification (always passes for demo)
  // In production: return joltVerifier.verify(proof);

  // Basic sanity checks
  if (!proof.hash || !proof.metadata.modelHash) return false;
  if (proof.metadata.proofSize < 100) return false;

  return true;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
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
    const response = await fetch(`${baseUrl}/api/circle/compliance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, recipient, amount }),
    });

    if (!response.ok) {
      return { approved: true };
    }

    const data = await response.json();
    return { approved: data.approved, reason: data.reason };
  } catch {
    return { approved: true };
  }
}

/**
 * Make USDC payment on the appropriate network
 */
async function makeMultiChainPayment(
  from: string,
  to: string,
  amount: string,
  network: string,
  wallets?: MultiChainWallets,
  legacyPrivateKey?: string
): Promise<{ success: boolean; txHash?: string; simulated: boolean; error?: string; complianceChecked: boolean; network: string }> {
  // Compliance check
  const compliance = await runComplianceCheck(from, to, formatUsdcAmount(amount));
  if (!compliance.approved) {
    return {
      success: false,
      error: `Compliance failed: ${compliance.reason}`,
      simulated: false,
      complianceChecked: true,
      network,
    };
  }

  // Build wallet info from either multi-chain wallets or legacy key
  let walletInfo: WalletInfo | null = null;

  if (wallets) {
    walletInfo = {
      evm: wallets.evm,
      solana: wallets.solana,
    };
  } else if (legacyPrivateKey) {
    // Legacy: only EVM wallet available
    walletInfo = {
      evm: {
        address: from,
        privateKey: legacyPrivateKey,
      },
      solana: {
        address: '',
        privateKey: '',
      },
    };
  }

  // Simulate if no wallet info
  if (!walletInfo || (!walletInfo.evm.privateKey && !walletInfo.solana.privateKey)) {
    console.log(`[Execute] No wallet keys available, simulating payment on ${network}`);
    const simResult = simulatePayment(network);
    return {
      ...simResult,
      complianceChecked: true,
    };
  }

  // Check if we have the right wallet for this network
  const isSolana = network.toLowerCase().includes('solana');
  if (isSolana && !walletInfo.solana.privateKey) {
    console.log(`[Execute] No Solana wallet, simulating payment`);
    const simResult = simulatePayment(network);
    return {
      ...simResult,
      complianceChecked: true,
    };
  }
  if (!isSolana && !walletInfo.evm.privateKey) {
    console.log(`[Execute] No EVM wallet, simulating payment`);
    const simResult = simulatePayment(network);
    return {
      ...simResult,
      complianceChecked: true,
    };
  }

  try {
    console.log(`[Execute] Attempting real payment on ${network}`);
    const result = await sendPayment(walletInfo, to, amount, network);

    if (!result.success) {
      // Fall back to simulation if real payment fails
      console.log(`[Execute] Real payment failed: ${result.error}, simulating`);
      const simResult = simulatePayment(network);
      return {
        ...simResult,
        complianceChecked: true,
      };
    }

    return {
      success: true,
      txHash: result.txHash,
      simulated: false,
      complianceChecked: true,
      network: result.network,
    };
  } catch (error) {
    console.log(`[Execute] Payment error, simulating:`, error);
    const simResult = simulatePayment(network);
    return {
      ...simResult,
      complianceChecked: true,
    };
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
  payment: { txHash?: string; simulated: boolean } | null,
  proof: ProofData | null,
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
        amountPaid: payment ? formatAmount(payment.txHash || '0') : undefined,
        proofHash: proof?.hash,
        proofSubmitted: !!proof,
        proofTxHash: payment?.txHash,
        durationMs,
        response: data,
      }),
    });
  } catch (error) {
    console.error('[Execute] Failed to log:', error);
  }
}
