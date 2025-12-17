import type { Address, Hash } from 'viem';

// ============================================================================
// zkML Proof Types
// ============================================================================

/**
 * Proof type tags as defined in ArcProofAttestation contract
 * - authorization: Proves agent was authorized to take action
 * - compliance: Proves compliance check was performed
 * - collision_severity: Proves collision severity assessment (autonomous vehicles)
 * - decision: Proves agent's decision model output before taking action
 */
export type ProofTag = 'authorization' | 'compliance' | 'collision_severity' | 'decision';

/**
 * Validation response codes from ArcProofAttestation
 */
export enum ValidationResponse {
  Pending = 0,
  Valid = 1,
  Invalid = 2,
  Inconclusive = 3,
}

/**
 * Metadata for a zkML proof
 */
export interface ProofMetadata {
  /** Hash of the ONNX model used */
  modelHash: Hash;
  /** Hash of model inputs */
  inputHash: Hash;
  /** Hash of model outputs */
  outputHash: Hash;
  /** Size of proof in bytes */
  proofSize: number;
  /** Proof generation time in milliseconds */
  generationTime: number;
  /** JOLT-Atlas prover version */
  proverVersion: string;
}

/**
 * A zkML proof with full data
 */
export interface ZkmlProof {
  /** Raw proof bytes (hex encoded) */
  proof: `0x${string}`;
  /** Hash of the proof */
  proofHash: Hash;
  /** Proof metadata */
  metadata: ProofMetadata;
  /** Proof type tag */
  tag: ProofTag;
  /** URI to full proof data (IPFS/Arweave) */
  requestUri?: string;
}

/**
 * Input for proof generation
 */
export interface ProofGenerationInput {
  /** ONNX model path or bytes */
  model: string | Uint8Array;
  /** Model inputs as JSON */
  inputs: Record<string, unknown>;
  /** Proof type */
  tag: ProofTag;
}

/**
 * Result from proof generation
 */
export interface ProofGenerationResult {
  success: boolean;
  proof?: ZkmlProof;
  error?: string;
  /** Time taken to generate proof in ms */
  generationTimeMs?: number;
}

/**
 * On-chain validation record
 */
export interface ValidationRecord {
  /** Validator address */
  validatorAddress: Address;
  /** Agent ID */
  agentId: bigint;
  /** Request URI (IPFS/Arweave) */
  requestUri: string;
  /** Request/proof hash */
  requestHash: Hash;
  /** Validation response */
  response: ValidationResponse;
  /** Response details URI */
  responseUri: string;
  /** Response hash */
  responseHash: Hash;
  /** Proof type tag */
  tag: Hash;
  /** Request timestamp */
  requestTimestamp: bigint;
  /** Response timestamp */
  responseTimestamp: bigint;
  /** Whether response has been submitted */
  hasResponse: boolean;
}

/**
 * Options for submitting a proof attestation to Arc
 */
export interface ProofSubmitOptions {
  /** Agent ID to associate proof with */
  agentId: string;
  /** Proof to submit */
  proof: ZkmlProof;
}

/**
 * Result from proof submission
 */
export interface ProofSubmitResult {
  success: boolean;
  /** Transaction hash */
  txHash?: Hash;
  /** Proof request hash (use this to check status) */
  requestHash?: Hash;
  error?: string;
}

/**
 * Options for checking proof status
 */
export interface ProofStatusOptions {
  /** Proof request hash */
  requestHash: Hash;
}

/**
 * Proof status result
 */
export interface ProofStatus {
  /** Whether the proof exists */
  exists: boolean;
  /** Validation response */
  response: ValidationResponse;
  /** Whether validation is complete */
  isValidated: boolean;
  /** Full validation record */
  record?: ValidationRecord;
  /** Proof metadata */
  metadata?: ProofMetadata;
}

/**
 * Options for listing agent proofs
 */
export interface ListProofsOptions {
  /** Agent ID */
  agentId: string;
  /** Filter by tag */
  tag?: ProofTag;
  /** Filter by response status */
  response?: ValidationResponse;
  /** Limit results */
  limit?: number;
}

/**
 * Proof list item
 */
export interface ProofListItem {
  requestHash: Hash;
  tag: ProofTag;
  response: ValidationResponse;
  isValidated: boolean;
  timestamp: number;
  metadata?: ProofMetadata;
}

/**
 * On-chain verification options
 */
export interface VerifyOnChainOptions {
  /** Proof request hash */
  requestHash: Hash;
  /** Raw proof bytes */
  proof: `0x${string}`;
}

/**
 * On-chain verification result
 */
export interface VerifyOnChainResult {
  /** Whether verification is supported */
  supported: boolean;
  /** Verification result (if supported) */
  verified?: boolean;
  /** Transaction hash (if verification was attempted) */
  txHash?: Hash;
  error?: string;
}
