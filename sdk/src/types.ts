import type { Address, Hash } from 'viem';

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
  name: string;
  /** Circle Programmable Wallet address */
  walletAddress?: Address;
  /** Model hash for zkML verification */
  modelHash?: Hash;
  /** JOLT-Atlas prover version */
  proverVersion?: string;
  /** Initial USDC deposit amount */
  initialDeposit?: string;
  /** Spending limits */
  limits?: AgentLimits;
  /** Metadata key-value pairs */
  metadata?: Record<string, string>;
}

export interface AgentLimits {
  /** Max USDC per transaction */
  perTransaction?: string;
  /** Max USDC per day */
  daily?: string;
  /** Auto-pause threshold */
  pauseThreshold?: string;
}

export interface Agent {
  id: string;
  /** ERC-8004 global identifier: eip155:{chainId}:{contract}:{agentId} */
  globalId: string;
  name: string;
  owner: Address;
  walletAddress: Address;
  kycStatus: KycStatus;
  createdAt: number;
  metadata: Record<string, string>;
}

export enum KycStatus {
  None = 0,
  Pending = 1,
  Approved = 2,
  Rejected = 3,
}

export interface AgentBalance {
  agentId: string;
  available: string;
  pending: string;
  locked: string;
}

// ============================================================================
// x402 Discovery Types
// ============================================================================

/** Discovery source for x402 services */
export type DiscoverySource = 'bazaar' | 'nexus' | 'probe';

export interface X402Service {
  /** Service endpoint URL */
  url: string;
  /** Human-readable name */
  name: string;
  /** Service description */
  description?: string;
  /** Price per request in USDC */
  price: string;
  /** Price in atomic units */
  priceAtomic: string;
  /** Accepted payment asset (e.g., USDC) */
  asset: string;
  /** Network/chain for payment */
  network: string;
  /** Payment destination address */
  payTo: Address;
  /** Discovery source (bazaar, nexus, or probe) */
  source?: DiscoverySource;
  /** Service category */
  category?: ServiceCategory;
  /**
   * Service type for agent workflow:
   * - fetch: Data retrieval (no proof needed)
   * - action: Execution service (requires decision proof before calling)
   */
  serviceType?: 'fetch' | 'action';
  /**
   * Required decision model ID for action services.
   * Must match a model from the DecisionModels registry.
   */
  requiredModel?: DecisionModelId;
  /** Whether zkML proofs are recommended for this service */
  zkmlRecommended?: boolean;
  /** @deprecated Use requiredModel instead */
  zkmlProofType?: 'authorization' | 'compliance';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Available premade decision model IDs
 */
export type DecisionModelId =
  | 'trading-signal'
  | 'opportunity-detector'
  | 'risk-scorer'
  | 'sentiment-classifier'
  | 'threshold-checker'
  | 'anomaly-detector';

/**
 * Decision model definition from the premade library
 */
export interface DecisionModel {
  /** Unique model ID */
  id: DecisionModelId;
  /** Human-readable name */
  name: string;
  /** What the model does */
  description: string;
  /** Hash of the ONNX model for verification */
  modelHash: Hash;
  /** Default threshold for decision (0-1) */
  defaultThreshold: number;
  /** Input schema description */
  inputDescription: string;
  /** Output description */
  outputDescription: string;
  /** Service categories this model is appropriate for */
  forCategories: ServiceCategory[];
}

export type ServiceCategory =
  | 'data'
  | 'compute'
  | 'ai'
  | 'storage'
  | 'oracle'
  | 'api'
  | 'other';

export interface DiscoveryOptions {
  /** Filter by network */
  network?: string;
  /** Filter by category */
  category?: ServiceCategory;
  /** Filter by max price (USDC) */
  maxPrice?: string;
  /** Search query */
  query?: string;
  /** Limit results */
  limit?: number;
}

// ============================================================================
// x402 Payment Types
// ============================================================================

export interface PaymentRequirement {
  scheme: string;
  network: string;
  asset: Address;
  payTo: Address;
  maxAmount: string;
  resource: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: Hash;
  settlement?: {
    network: string;
    txHash: Hash;
    amount: string;
  };
  error?: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface AgentTransaction {
  id: string;
  agentId: string;
  type: 'incoming' | 'outgoing';
  amount: string;
  counterparty: Address;
  service?: string;
  status: TransactionStatus;
  txHash?: Hash;
  timestamp: number;
}

export enum TransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

// ============================================================================
// Network Configuration
// ============================================================================

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: {
    arcAgent: Address;
    arcIdentity: Address;
    arcReputation: Address;
    arcProofAttestation: Address;
    arcTreasury: Address;
    arcComplianceOracle: Address;
    usdc: Address;
  };
  explorer?: string;
}

// Network configs are exported from ./config.ts
