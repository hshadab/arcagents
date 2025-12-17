// Core exports
export { ArcAgentClient, type ArcAgentClientConfig } from './core/agent';

// Discovery exports
export { BazaarClient, bazaar } from './discovery/bazaar';
export { NexusClient, nexus } from './discovery/nexus';
export {
  UnifiedDiscoveryClient,
  discovery,
  type UnifiedDiscoveryOptions,
  type DiscoveryStats,
} from './discovery';

// x402 exports
export { X402Client, createPaymentFetch } from './x402/client';

// Circle Integration exports
export {
  CircleWallets,
  createCircleWallets,
  CircleCompliance,
  createCircleCompliance,
} from './circle';

export type {
  CircleWalletsConfig,
  CircleWallet,
  WalletStatus,
  BlockchainType,
  CreateWalletOptions,
  WalletSet,
  TransactionRequest,
  TransactionResponse,
  ComplianceConfig,
  ScreeningStatus,
  RiskLevel,
  ScreeningResult,
  ScreeningOptions,
  BatchScreeningOptions,
} from './circle';

// zkML exports - enums must be exported separately from types
export {
  ZkmlProver,
  zkmlProver,
  ZkmlVerifier,
  ValidationResponse,
  ProofAttestation,
  createProofAttestation,
} from './zkml';

export type {
  ProverConfig,
  VerifierConfig,
  ProofTag,
  ProofMetadata,
  ZkmlProof,
  ProofGenerationInput,
  ProofGenerationResult,
  ValidationRecord,
  ProofSubmitOptions,
  ProofSubmitResult,
  ProofStatus,
  ListProofsOptions,
  ProofListItem,
  AttestationConfig,
  SubmitProofResult,
  ProofStatusResult,
} from './zkml';

// Config exports
export {
  ARC_TESTNET_CONFIG as ARC_TESTNET,
  ARC_MAINNET_CONFIG as ARC_MAINNET,
  createNetworkConfig,
  validateNetworkConfig,
} from './config';

// Decision Models exports
export {
  DECISION_MODELS,
  getDecisionModel,
  getAllDecisionModels,
  getModelsForCategory,
  suggestModelForService,
  MODEL_PATHS,
} from './models';

// Type exports
export type {
  // Agent types
  Agent,
  AgentConfig,
  AgentLimits,
  AgentBalance,
  AgentTransaction,
  // Discovery types
  X402Service,
  ServiceCategory,
  DiscoveryOptions,
  DiscoverySource,
  // Decision model types
  DecisionModelId,
  DecisionModel,
  // Payment types
  PaymentRequirement,
  PaymentResult,
  // Network types
  NetworkConfig,
} from './types';

// Re-export KycStatus and TransactionStatus enums as both types and values
export { KycStatus, TransactionStatus } from './types';

// Validation utilities
export {
  ValidationError,
  validateAddress,
  validateAgentName,
  validateAmount,
  validateUrl,
  validateAgentId,
  validateBytes32,
  sanitizeString,
  AGENT_NAME_CONSTRAINTS,
  DEPOSIT_CONSTRAINTS,
  URL_CONSTRAINTS,
} from './utils/validation';
