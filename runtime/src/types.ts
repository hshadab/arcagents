import type { Address, Hash } from 'viem';
import type { X402Service } from '@arc-agent/sdk';

/**
 * Persisted agent configuration for runtime execution
 */
export interface AgentRuntimeConfig {
  /** Unique agent identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Owner wallet address */
  owner: Address;
  /** Agent's Circle Programmable Wallet address */
  walletAddress: Address;
  /** Private key for signing (stored securely in env) */
  privateKeyEnvVar: string;
  /** Services the agent interacts with (fetch and action) */
  services: AgentServiceConfig[];
  /** Local decision model configuration */
  decisionModel?: DecisionModelConfig;
  /** Execution schedule */
  schedule: ScheduleConfig;
  /** zkML configuration for decision proofs */
  zkml?: ZkmlConfig;
  /** Spending limits */
  limits: SpendingLimits;
  /** Optional webhook for notifications */
  webhookUrl?: string;
  /** Agent status */
  status: AgentStatus;
  /** Creation timestamp */
  createdAt: number;
  /** Last run timestamp */
  lastRunAt?: number;
}

/**
 * Service type (legacy - no longer determines proof requirements)
 *
 * In the current architecture:
 * - Simple agents: call services directly (probe → pay)
 * - ML agents: run model and prove BEFORE payment (probe → model → prove → pay)
 *
 * The service type is now informational only. zkML is determined by
 * whether the agent has a decisionModel configured, not by service type.
 */
export type ServiceType = 'fetch' | 'action';

/**
 * Agent service configuration with type designation
 */
export interface AgentServiceConfig {
  /** Service type: fetch (data) or action (execution) */
  type: ServiceType;
  /** Service URL */
  url: string;
  /** Service name */
  name: string;
  /** Price per request (atomic units) */
  priceAtomic: string;
  /** Payment network */
  network: string;
  /** Payment destination */
  payTo: Address;
  /** HTTP method */
  method?: 'GET' | 'POST';
  /** Request body template (for POST) */
  bodyTemplate?: Record<string, unknown>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Order in workflow (for multi-service agents) */
  order?: number;
}

/**
 * Local decision model configuration
 * The agent runs this model locally and generates a JOLT-Atlas zkML proof
 * BEFORE calling any action-type services
 */
export interface DecisionModelConfig {
  /** Model identifier/name */
  modelId: string;
  /** Model hash for verification */
  modelHash: Hash;
  /** Path to ONNX model file */
  modelPath: string;
  /** Decision threshold (model output above this triggers action) */
  threshold: number;
  /** Description of what the model decides */
  description: string;
}

/** @deprecated Use AgentServiceConfig instead */
export interface X402ServiceConfig {
  /** Service URL */
  url: string;
  /** Service name */
  name: string;
  /** Price per request (atomic units) */
  priceAtomic: string;
  /** Payment network */
  network: string;
  /** Payment destination */
  payTo: Address;
  /** HTTP method */
  method?: 'GET' | 'POST';
  /** Request body template (for POST) */
  bodyTemplate?: Record<string, unknown>;
  /** Request headers */
  headers?: Record<string, string>;
}

/**
 * Agent execution mode determines HOW the agent runs
 */
export type ExecutionMode =
  | 'scheduled'    // Runs on cron schedule (e.g., hourly data fetching)
  | 'event'        // Triggered by on-chain events or webhooks
  | 'continuous'   // Long-running process (streaming data)
  | 'on-demand'    // Triggered by API call
  | 'reactive';    // Polls conditions, acts when threshold met

/**
 * Schedule configuration - supports multiple execution modes
 */
export interface ScheduleConfig {
  /** How the agent should be executed */
  mode: ExecutionMode;

  // === Scheduled Mode ===
  /** Cron expression (e.g., "0 * * * *" for hourly) - for 'scheduled' mode */
  cron?: string;
  /** Timezone */
  timezone?: string;

  // === Event Mode ===
  /** Event triggers - for 'event' mode */
  triggers?: EventTrigger[];

  // === Reactive Mode ===
  /** Poll interval in seconds - for 'reactive' mode */
  pollIntervalSeconds?: number;
  /** Conditions to check - agent acts only when ALL conditions met */
  conditions?: ReactiveCondition[];

  // === Continuous Mode ===
  /** Data source to stream from - for 'continuous' mode */
  streamSource?: StreamConfig;

  // === Common ===
  /** Max runs per day (safety limit) */
  maxRunsPerDay?: number;
  /** Cooldown between executions in seconds */
  cooldownSeconds?: number;
}

/**
 * Event trigger configuration for event-driven agents
 */
export interface EventTrigger {
  /** Type of event source */
  type: 'webhook' | 'onchain' | 'price';

  // === Webhook ===
  /** Expected webhook endpoint path */
  webhookPath?: string;
  /** Secret for webhook validation */
  webhookSecret?: string;

  // === On-chain ===
  /** Contract address to watch */
  contractAddress?: `0x${string}`;
  /** Event signature to listen for */
  eventSignature?: string;
  /** Chain to watch */
  chainId?: number;

  // === Price ===
  /** Asset pair (e.g., "ETH/USD") */
  pricePair?: string;
  /** Price threshold */
  priceThreshold?: number;
  /** Direction: 'above' or 'below' */
  priceDirection?: 'above' | 'below';
}

/**
 * Reactive condition for reactive agents
 */
export interface ReactiveCondition {
  /** Type of condition to check */
  type: 'price' | 'balance' | 'custom';

  // === Price condition ===
  pricePair?: string;
  priceOperator?: '>' | '<' | '>=' | '<=' | '==';
  priceValue?: number;

  // === Balance condition ===
  balanceAddress?: `0x${string}`;
  balanceOperator?: '>' | '<' | '>=' | '<=';
  balanceValue?: string;

  // === Custom ===
  /** Custom API to call for condition check */
  customEndpoint?: string;
  /** JSONPath to extract boolean from response */
  customJsonPath?: string;
}

/**
 * Stream configuration for continuous agents
 */
export interface StreamConfig {
  /** Stream type */
  type: 'websocket' | 'sse' | 'polling';
  /** Stream URL */
  url: string;
  /** Reconnect on disconnect */
  reconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
}

export interface ZkmlConfig {
  /** Enable zkML proofs */
  enabled: boolean;
  /** Model hash for verification */
  modelHash: Hash;
  /** Proof type */
  proofType: 'authorization' | 'compliance' | 'decision';
  /** Submit proofs on-chain */
  submitOnChain: boolean;
}

export interface SpendingLimits {
  /** Max per transaction (USDC atomic units) */
  perTransaction: string;
  /** Max daily spend (USDC atomic units) */
  daily: string;
  /** Pause agent if balance drops below this (USDC atomic units) */
  pauseThreshold: string;
}

export type AgentStatus = 'active' | 'paused' | 'error' | 'out_of_funds';

/**
 * Result of a single agent execution
 */
export interface ExecutionResult {
  agentId: string;
  agentName?: string;
  timestamp: number;
  success: boolean;

  /** Workflow steps executed */
  workflow?: WorkflowStepResult[];

  /** Decision model result (if model was run) */
  decision?: {
    modelId: string;
    modelHash: Hash;
    /** Raw model output */
    output: number;
    /** Threshold used */
    threshold: number;
    /** Whether threshold was met (action should proceed) */
    shouldAct: boolean;
    /** Human-readable decision explanation */
    explanation: string;
  };

  /** zkML proof of decision (generated BEFORE action services) */
  decisionProof?: {
    proofHash: Hash;
    /** Proof submitted on-chain */
    submitted: boolean;
    /** Submission tx hash */
    txHash?: Hash;
  };

  /** Fetch service responses (data retrieved) */
  fetchResults?: Array<{
    serviceName: string;
    serviceUrl: string;
    response: unknown;
    amountPaid: string;
  }>;

  /** Action service responses (after decision proof) */
  actionResults?: Array<{
    serviceName: string;
    serviceUrl: string;
    response: unknown;
    amountPaid: string;
  }>;

  /** Total amount paid across all services */
  totalAmountPaid?: string;

  /** @deprecated Use decisionProof.proofHash instead */
  proofHash?: Hash;
  /** @deprecated Use decisionProof.submitted instead */
  proofSubmitted?: boolean;
  /** @deprecated Use decisionProof.txHash instead */
  proofTxHash?: Hash;
  /** @deprecated Use fetchResults/actionResults instead */
  serviceResponse?: unknown;
  /** @deprecated Use workflow steps instead */
  serviceUrl?: string;
  /** @deprecated Use workflow steps instead */
  serviceName?: string;
  /** Payment transaction hash */
  paymentTxHash?: Hash;
  /** @deprecated Use totalAmountPaid instead */
  amountPaid?: string;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  durationMs: number;
}

/**
 * Individual step in the agent workflow
 *
 * Workflow types:
 * - probe: Inspect x402 service metadata (free, no payment)
 * - decision: Run ONNX model locally (ML agents only)
 * - proof: Generate JOLT-Atlas zkML proof (ML agents only)
 * - action: Pay and execute x402 service
 */
export interface WorkflowStepResult {
  step: number;
  type: 'probe' | 'decision' | 'proof' | 'action';
  serviceName?: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Daily spending tracker
 */
export interface DailySpendTracker {
  agentId: string;
  date: string; // YYYY-MM-DD
  totalSpent: string;
  runCount: number;
}

/**
 * Agent execution log entry
 */
export interface ExecutionLog {
  id: string;
  agentId: string;
  timestamp: number;
  result: ExecutionResult;
}
