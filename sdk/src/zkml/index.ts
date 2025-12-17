// Prover exports
export { ZkmlProver, zkmlProver, type ProverConfig } from './prover';

// Verifier exports
export { ZkmlVerifier, type VerifierConfig } from './verifier';

// Attestation exports
export {
  ProofAttestation,
  createProofAttestation,
  type AttestationConfig,
  type SubmitProofResult,
  type ProofStatusResult,
} from './attestation';

// Re-export ValidationResponse enum as value (must be separate from type exports)
export { ValidationResponse } from './types';

// Type exports
export type {
  // Proof types
  ProofTag,
  ProofMetadata,
  ZkmlProof,
  ProofGenerationInput,
  ProofGenerationResult,
  // Validation types
  ValidationRecord,
  // Submit types
  ProofSubmitOptions,
  ProofSubmitResult,
  // Status types
  ProofStatusOptions,
  ProofStatus,
  // List types
  ListProofsOptions,
  ProofListItem,
  // Verification types
  VerifyOnChainOptions,
  VerifyOnChainResult,
} from './types';
