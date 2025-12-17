import { createPublicClient, createWalletClient, http, formatUnits, type Chain, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { X402Client, ZkmlProver, ProofAttestation, ARC_TESTNET } from '@arc-agent/sdk';
import type {
  AgentRuntimeConfig,
  AgentServiceConfig,
  ExecutionResult,
  DailySpendTracker,
  WorkflowStepResult,
} from './types.js';

// Activity reporting endpoint (set via env)
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || '';

// ArcProofAttestation contract address (set via env)
const PROOF_ATTESTATION_ADDRESS = process.env.ARC_PROOF_ATTESTATION_ADDRESS as `0x${string}` | undefined;

// USDC contract addresses by network
const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'arc-testnet': ARC_TESTNET.contracts.usdc,
};

// Chain configs
const CHAINS: Record<string, Chain> = {
  'base': base,
  'base-sepolia': baseSepolia,
};

// In-memory daily spend tracking (in production, use Redis or database)
const dailySpendTrackers = new Map<string, DailySpendTracker>();

/**
 * Get the current date key for spend tracking
 */
function getDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get or create daily spend tracker for an agent
 */
function getDailyTracker(agentId: string): DailySpendTracker {
  const dateKey = getDateKey();
  const key = `${agentId}:${dateKey}`;

  let tracker = dailySpendTrackers.get(key);
  if (!tracker || tracker.date !== dateKey) {
    tracker = {
      agentId,
      date: dateKey,
      totalSpent: '0',
      runCount: 0,
    };
    dailySpendTrackers.set(key, tracker);
  }

  return tracker;
}

/**
 * Update daily spend tracker
 */
function updateDailyTracker(agentId: string, amountSpent: string): void {
  const tracker = getDailyTracker(agentId);
  tracker.totalSpent = (BigInt(tracker.totalSpent) + BigInt(amountSpent)).toString();
  tracker.runCount += 1;
}

/**
 * Check if agent can spend based on daily limits
 */
function canSpend(config: AgentRuntimeConfig, amount: string): { allowed: boolean; reason?: string } {
  const tracker = getDailyTracker(config.id);

  // Check daily limit
  const dailyLimit = BigInt(config.limits.daily);
  const currentSpent = BigInt(tracker.totalSpent);
  const proposedAmount = BigInt(amount);

  if (currentSpent + proposedAmount > dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit exceeded. Spent: ${formatUnits(currentSpent, 6)} USDC, Limit: ${formatUnits(dailyLimit, 6)} USDC`,
    };
  }

  // Check per-transaction limit
  const perTxLimit = BigInt(config.limits.perTransaction);
  if (proposedAmount > perTxLimit) {
    return {
      allowed: false,
      reason: `Transaction limit exceeded. Amount: ${formatUnits(proposedAmount, 6)} USDC, Limit: ${formatUnits(perTxLimit, 6)} USDC`,
    };
  }

  // Check max runs per day
  if (config.schedule.maxRunsPerDay && tracker.runCount >= config.schedule.maxRunsPerDay) {
    return {
      allowed: false,
      reason: `Max daily runs exceeded. Runs: ${tracker.runCount}, Limit: ${config.schedule.maxRunsPerDay}`,
    };
  }

  return { allowed: true };
}

/**
 * Execute a single x402 service call
 */
async function callService(
  service: AgentServiceConfig,
  x402Client: X402Client,
  agentName: string
): Promise<{ response: unknown; amountPaid: string }> {
  console.log(`[${agentName}] Calling ${service.type} service: ${service.name}...`);

  const fetchOptions: RequestInit = {
    method: service.method || 'GET',
    headers: service.headers,
  };

  if (service.method === 'POST' && service.bodyTemplate) {
    fetchOptions.body = JSON.stringify(service.bodyTemplate);
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Content-Type': 'application/json',
    };
  }

  const response = await x402Client.fetch(service.url, fetchOptions);

  if (!response.ok) {
    throw new Error(`Service ${service.name} returned ${response.status}: ${await response.text()}`);
  }

  const serviceResponse = await response.json();
  console.log(`[${agentName}] ${service.name} response received`);

  return {
    response: serviceResponse,
    amountPaid: service.priceAtomic,
  };
}

/**
 * Run local decision model and return result
 * In simulation mode, this generates a mock decision based on input data
 */
async function runDecisionModel(
  config: AgentRuntimeConfig,
  fetchedData: Record<string, unknown>
): Promise<{
  output: number;
  shouldAct: boolean;
  explanation: string;
}> {
  if (!config.decisionModel) {
    throw new Error('No decision model configured');
  }

  const model = config.decisionModel;
  console.log(`[${config.name}] Running decision model: ${model.modelId}`);

  // In production, this would load the ONNX model and run inference
  // For now, simulate a decision based on the fetched data
  // The actual JOLT-Atlas integration would replace this

  // Simulate model inference
  // In reality: load ONNX model from model.modelPath, run inference on fetchedData
  const simulatedOutput = Math.random(); // Replace with actual model inference

  const shouldAct = simulatedOutput >= model.threshold;
  const explanation = `Model ${model.modelId} output ${simulatedOutput.toFixed(4)} ${
    shouldAct ? '>=' : '<'
  } threshold ${model.threshold} → ${shouldAct ? 'PROCEED with action' : 'SKIP action'}`;

  console.log(`[${config.name}] Decision: ${explanation}`);

  return {
    output: simulatedOutput,
    shouldAct,
    explanation,
  };
}

/**
 * Execute a single agent run with the correct workflow:
 *
 * For SIMPLE agents (no decision model):
 * 1. Probe service (get metadata, free)
 * 2. Pay and execute service
 *
 * For ML agents (with decision model):
 * 1. Probe service (get metadata, free)
 * 2. Run ONNX decision model locally
 * 3. Generate JOLT-Atlas zkML proof of correct model execution
 * 4. Pay and execute service (only after proof)
 * 5. Submit proof on-chain
 *
 * Key principle: zkML proves ONNX model computed correctly.
 * Payment happens AFTER proof generation for ML agents.
 */
export async function executeAgent(config: AgentRuntimeConfig): Promise<ExecutionResult> {
  const startTime = Date.now();
  const workflow: WorkflowStepResult[] = [];
  let stepNumber = 0;

  const result: ExecutionResult = {
    agentId: config.id,
    agentName: config.name,
    timestamp: startTime,
    success: false,
    workflow: [],
    fetchResults: [],
    actionResults: [],
    durationMs: 0,
  };

  try {
    console.log(`[${config.name}] Starting execution...`);

    // Check if agent is active
    if (config.status !== 'active') {
      throw new Error(`Agent is ${config.status}, not active`);
    }

    // Get private key from environment
    const privateKey = process.env[config.privateKeyEnvVar];
    if (!privateKey) {
      throw new Error(`Private key not found in env var: ${config.privateKeyEnvVar}`);
    }

    // Sort services by order
    const orderedServices = [...config.services].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Calculate total potential spend
    const totalPotentialSpend = orderedServices.reduce(
      (sum, s) => sum + BigInt(s.priceAtomic),
      BigInt(0)
    );

    // Check spending limits
    const spendCheck = canSpend(config, totalPotentialSpend.toString());
    if (!spendCheck.allowed) {
      throw new Error(spendCheck.reason);
    }

    // Get network from first service
    const network = config.services[0]?.network || 'base-sepolia';

    // Create wallet client
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const chain = CHAINS[network];

    if (!chain && network !== 'arc-testnet') {
      throw new Error(`Unsupported network: ${network}`);
    }

    const publicClient = createPublicClient({
      chain: chain || (ARC_TESTNET as any),
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: chain || (ARC_TESTNET as any),
      transport: http(),
    });

    // Check balance
    const usdcAddress = USDC_ADDRESSES[network];
    if (!usdcAddress) {
      throw new Error(`USDC not configured for network: ${network}`);
    }

    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [config.walletAddress],
    }) as bigint;

    console.log(`[${config.name}] Balance: ${formatUnits(balance, 6)} USDC`);

    // Check pause threshold
    const pauseThreshold = BigInt(config.limits.pauseThreshold);
    if (balance < pauseThreshold) {
      config.status = 'out_of_funds';
      throw new Error(`Balance below pause threshold: ${formatUnits(balance, 6)} < ${formatUnits(pauseThreshold, 6)} USDC`);
    }

    // Create x402 client
    const x402Client = new X402Client({
      wallet: walletClient,
      publicClient,
    });

    let totalAmountPaid = BigInt(0);

    // =====================
    // STEP 1: Probe Services (get metadata without paying)
    // =====================
    console.log(`[${config.name}] Probing ${orderedServices.length} service(s)...`);

    const probeStart = Date.now();
    stepNumber++;

    const serviceMetadata: Record<string, unknown> = {};
    for (const service of orderedServices) {
      // x402Client.checkPaymentRequired probes without paying
      const requirement = await x402Client.checkPaymentRequired(service.url);
      serviceMetadata[service.name] = {
        url: service.url,
        paymentRequired: !!requirement,
        price: service.priceAtomic,
        ...requirement,
      };
    }

    workflow.push({
      step: stepNumber,
      type: 'probe',
      success: true,
      durationMs: Date.now() - probeStart,
    });

    // =====================
    // ML AGENT PATH: Model → Prove → Pay
    // =====================
    if (config.decisionModel && config.zkml?.enabled) {
      console.log(`[${config.name}] ML Agent: Running decision model before payment...`);

      // STEP 2: Run Decision Model
      const decisionStart = Date.now();
      stepNumber++;

      let decision;
      try {
        decision = await runDecisionModel(config, serviceMetadata);

        result.decision = {
          modelId: config.decisionModel.modelId,
          modelHash: config.decisionModel.modelHash,
          output: decision.output,
          threshold: config.decisionModel.threshold,
          shouldAct: decision.shouldAct,
          explanation: decision.explanation,
        };

        workflow.push({
          step: stepNumber,
          type: 'decision',
          success: true,
          durationMs: Date.now() - decisionStart,
        });
      } catch (decisionError) {
        workflow.push({
          step: stepNumber,
          type: 'decision',
          success: false,
          durationMs: Date.now() - decisionStart,
          error: decisionError instanceof Error ? decisionError.message : String(decisionError),
        });
        throw decisionError;
      }

      // STEP 3: Generate zkML Proof (BEFORE payment)
      const proofStart = Date.now();
      stepNumber++;

      try {
        console.log(`[${config.name}] Generating JOLT-Atlas zkML proof of ONNX model execution...`);

        const prover = new ZkmlProver({
          simulate: true, // Use simulation until JOLT-Atlas is integrated
        });

        const proofResult = await prover.generateProof({
          model: config.decisionModel.modelHash,
          inputs: {
            serviceMetadata,
            modelId: config.decisionModel.modelId,
            decision: decision.output,
            threshold: config.decisionModel.threshold,
            timestamp: Date.now(),
          },
          tag: 'decision',
        });

        if (proofResult.proof) {
          result.decisionProof = {
            proofHash: proofResult.proof.proofHash,
            submitted: false,
          };
          result.proofHash = proofResult.proof.proofHash;

          console.log(`[${config.name}] zkML proof generated: ${proofResult.proof.proofHash}`);

          workflow.push({
            step: stepNumber,
            type: 'proof',
            success: true,
            durationMs: Date.now() - proofStart,
          });

          // STEP 4: Pay and Execute Services (only after proof, if threshold met)
          if (decision.shouldAct) {
            console.log(`[${config.name}] Threshold met, proceeding with payment and execution...`);

            for (const service of orderedServices) {
              const stepStart = Date.now();
              stepNumber++;

              try {
                const { response, amountPaid } = await callService(service, x402Client, config.name);
                totalAmountPaid += BigInt(amountPaid);

                result.actionResults!.push({
                  serviceName: service.name,
                  serviceUrl: service.url,
                  response,
                  amountPaid,
                });

                workflow.push({
                  step: stepNumber,
                  type: 'action',
                  serviceName: service.name,
                  success: true,
                  durationMs: Date.now() - stepStart,
                });
              } catch (err) {
                workflow.push({
                  step: stepNumber,
                  type: 'action',
                  serviceName: service.name,
                  success: false,
                  durationMs: Date.now() - stepStart,
                  error: err instanceof Error ? err.message : String(err),
                });
                throw err;
              }
            }
          } else {
            console.log(`[${config.name}] Threshold not met, skipping payment and execution`);
          }

          // STEP 5: Submit proof on-chain
          if (config.zkml.submitOnChain && PROOF_ATTESTATION_ADDRESS && privateKey) {
            console.log(`[${config.name}] Submitting zkML proof on-chain...`);
            try {
              const attestation = new ProofAttestation({
                contractAddress: PROOF_ATTESTATION_ADDRESS,
                privateKey: privateKey as `0x${string}`,
              });

              const submitResult = await attestation.submitProof(
                proofResult.proof,
                config.id,
                `arc-agent://${config.id}/decision/${Date.now()}`
              );

              if (submitResult.success) {
                result.decisionProof.submitted = true;
                result.decisionProof.txHash = submitResult.txHash;
                result.proofSubmitted = true;
                result.proofTxHash = submitResult.txHash;
                console.log(`[${config.name}] Proof attested on-chain: ${submitResult.txHash}`);
              } else {
                console.warn(`[${config.name}] Proof submission failed: ${submitResult.error}`);
              }
            } catch (submitError) {
              console.warn(`[${config.name}] Proof submission error:`, submitError);
            }
          }
        }
      } catch (zkmlError) {
        console.warn(`[${config.name}] zkML proof generation failed:`, zkmlError);
        workflow.push({
          step: stepNumber,
          type: 'proof',
          success: false,
          durationMs: Date.now() - proofStart,
          error: zkmlError instanceof Error ? zkmlError.message : String(zkmlError),
        });
        // For ML agents, proof failure should block payment
        throw new Error(`zkML proof required but failed: ${zkmlError instanceof Error ? zkmlError.message : String(zkmlError)}`);
      }
    } else {
      // =====================
      // SIMPLE AGENT PATH: Probe → Pay → Execute (no model, no proof)
      // =====================
      console.log(`[${config.name}] Simple Agent: Proceeding directly with payment...`);

      for (const service of orderedServices) {
        const stepStart = Date.now();
        stepNumber++;

        try {
          const { response, amountPaid } = await callService(service, x402Client, config.name);
          totalAmountPaid += BigInt(amountPaid);

          result.actionResults!.push({
            serviceName: service.name,
            serviceUrl: service.url,
            response,
            amountPaid,
          });

          workflow.push({
            step: stepNumber,
            type: 'action',
            serviceName: service.name,
            success: true,
            durationMs: Date.now() - stepStart,
          });
        } catch (err) {
          workflow.push({
            step: stepNumber,
            type: 'action',
            serviceName: service.name,
            success: false,
            durationMs: Date.now() - stepStart,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }
    }

    // Update spend tracker
    result.totalAmountPaid = totalAmountPaid.toString();
    result.amountPaid = result.totalAmountPaid; // Legacy
    updateDailyTracker(config.id, totalAmountPaid.toString());

    result.success = true;
    result.workflow = workflow;

    // Legacy fields for first service (backward compatibility)
    if (config.services.length > 0) {
      result.serviceUrl = config.services[0].url;
      result.serviceName = config.services[0].name;
      result.serviceResponse = result.fetchResults?.[0]?.response || result.actionResults?.[0]?.response;
    }

    console.log(`[${config.name}] Execution successful`);

    // Report activity to API if configured
    if (ACTIVITY_API_URL) {
      try {
        await fetch(ACTIVITY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: config.id,
            agentName: config.name,
            timestamp: result.timestamp,
            success: result.success,
            serviceUrl: result.serviceUrl,
            serviceName: result.serviceName,
            amountPaid: result.totalAmountPaid,
            proofHash: result.decisionProof?.proofHash,
            proofSubmitted: result.decisionProof?.submitted,
            proofTxHash: result.decisionProof?.txHash,
            durationMs: result.durationMs,
            response: result.serviceResponse,
            decision: result.decision,
            workflow: result.workflow,
          }),
        });
      } catch (activityError) {
        console.warn(`[${config.name}] Activity reporting failed:`, activityError);
      }
    }

    // Send webhook notification if configured
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'execution_complete',
            agentId: config.id,
            agentName: config.name,
            result,
          }),
        });
      } catch (webhookError) {
        console.warn(`[${config.name}] Webhook notification failed:`, webhookError);
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${config.name}] Execution failed:`, errorMessage);
    result.error = errorMessage;
    result.workflow = workflow;

    // Send error webhook if configured
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'execution_error',
            agentId: config.id,
            agentName: config.name,
            error: errorMessage,
          }),
        });
      } catch (webhookError) {
        console.warn(`[${config.name}] Error webhook notification failed:`, webhookError);
      }
    }
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Check if an agent should run based on its cron schedule
 */
export function shouldRunNow(config: AgentRuntimeConfig): boolean {
  // Simple cron check - in production use node-cron or similar
  // For now, just check if agent is active
  return config.status === 'active';
}

/**
 * Get agent statistics
 */
export function getAgentStats(config: AgentRuntimeConfig) {
  const tracker = getDailyTracker(config.id);
  const isMLAgent = !!config.decisionModel && !!config.zkml?.enabled;

  return {
    agentId: config.id,
    name: config.name,
    status: config.status,
    todaySpent: formatUnits(BigInt(tracker.totalSpent), 6),
    todayRuns: tracker.runCount,
    dailyLimit: formatUnits(BigInt(config.limits.daily), 6),
    lastRunAt: config.lastRunAt ? new Date(config.lastRunAt).toISOString() : null,
    serviceCount: config.services.length,
    agentType: isMLAgent ? 'ml' : 'simple',
    hasDecisionModel: !!config.decisionModel,
    zkmlEnabled: !!config.zkml?.enabled,
  };
}
