/**
 * zkML Proof Service
 *
 * Generates zkML proofs for model inference using JOLT-Atlas format.
 * Proofs can be submitted to the ArcProofAttestation contract on Arc Testnet.
 *
 * Architecture:
 * 1. Browser runs ONNX inference (onnxruntime-web)
 * 2. This service generates commitment proofs (hash-based)
 * 3. For real zkML proofs, use JOLT-Atlas backend service
 * 4. Proofs are submitted to ArcProofAttestation on-chain
 */

import { keccak256, toHex, type Hash, type Address } from 'viem';
import type { InferenceResult } from './onnxInference';
import { ARC_CONTRACTS } from './constants';
import { DECISION_MODELS, type DecisionModelId } from './models';
import { hexToBytes, isValidHash } from './utils/crypto';

/** JOLT-Atlas compatible prover version */
const PROVER_VERSION = 'jolt-atlas-0.2.0';

/** Proof type tags matching ArcProofAttestation contract */
export type ProofTag = 'authorization' | 'compliance' | 'collision_severity' | 'decision' | 'spending';

/**
 * Proof metadata stored on-chain
 */
export interface ProofMetadata {
  modelHash: Hash;
  inputHash: Hash;
  outputHash: Hash;
  proofSize: number;
  generationTime: number;
  proverVersion: string;
}

/**
 * Complete zkML proof
 */
export interface ZkmlProof {
  proof: `0x${string}`;
  proofHash: Hash;
  metadata: ProofMetadata;
  tag: ProofTag;
  timestamp: number;
  status: 'pending' | 'valid' | 'invalid';
}

/**
 * Input for proof generation
 */
export interface ProofGenerationInput {
  modelId: string;
  modelName: string;
  inputs: Record<string, unknown>;
  inferenceResult: InferenceResult;
  tag?: ProofTag;
}

/**
 * Result from proof generation
 */
export interface ProofGenerationResult {
  success: boolean;
  proof?: ZkmlProof;
  error?: string;
  generationTimeMs: number;
}

/**
 * Options for submitting proofs to chain
 */
export interface ProofSubmitOptions {
  proof: ZkmlProof;
  agentId: string;
  treasuryPrivateKey: string;
}

/**
 * Result from proof submission
 */
export interface ProofSubmitResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
}

/**
 * Generate a zkML proof for model inference
 *
 * This generates a JOLT-Atlas compatible proof structure.
 * In simulation mode, proofs are hash-based commitments.
 * For real proofs, integrate with JOLT-Atlas backend.
 *
 * @param input - Proof generation input including model and inference result
 * @returns Proof generation result with proof data
 */
export async function generateProof(input: ProofGenerationInput): Promise<ProofGenerationResult> {
  const startTime = Date.now();

  try {
    const { modelId, modelName, inputs, inferenceResult, tag = 'authorization' } = input;

    // Validate inference result
    if (!inferenceResult.success || inferenceResult.output === undefined) {
      return {
        success: false,
        error: 'Invalid inference result - cannot generate proof',
        generationTimeMs: Date.now() - startTime,
      };
    }

    // Get the real ONNX model hash from DECISION_MODELS (SHA-256 of model file)
    // Falls back to hashing model name if model not found
    const modelConfig = DECISION_MODELS[modelId as DecisionModelId];
    const modelHash = (modelConfig?.modelHash ||
      keccak256(toHex(new TextEncoder().encode(modelName)))) as Hash;

    // Hash the inputs
    const inputsJson = JSON.stringify(inputs);
    const inputHash = keccak256(toHex(new TextEncoder().encode(inputsJson))) as Hash;

    // Hash the output
    const outputJson = JSON.stringify({
      output: inferenceResult.output,
      rawOutput: inferenceResult.rawOutput,
      confidence: inferenceResult.confidence,
      category: inferenceResult.category,
    });
    const outputHash = keccak256(toHex(new TextEncoder().encode(outputJson))) as Hash;

    // Generate proof bytes (JOLT-Atlas compatible structure)
    const proofBytes = generateProofBytes(modelHash, inputHash, outputHash, tag);

    // Calculate proof hash
    const proofHex = toHex(proofBytes) as `0x${string}`;
    const proofHash = keccak256(proofHex) as Hash;

    const generationTime = Date.now() - startTime;

    // Create metadata
    const metadata: ProofMetadata = {
      modelHash,
      inputHash,
      outputHash,
      proofSize: proofBytes.length,
      generationTime,
      proverVersion: PROVER_VERSION,
    };

    // Create the proof object
    const proof: ZkmlProof = {
      proof: proofHex,
      proofHash,
      metadata,
      tag,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    };

    return {
      success: true,
      proof,
      generationTimeMs: generationTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Proof generation failed',
      generationTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate JOLT-Atlas compatible proof bytes
 */
function generateProofBytes(
  modelHash: Hash,
  inputHash: Hash,
  outputHash: Hash,
  tag: ProofTag
): Uint8Array {
  // JOLT proof structure (simplified for simulation)
  // Real JOLT proofs would come from the Rust prover
  const proofBytes = new Uint8Array(256);

  // Header: "JOLT_PROOF_V1"
  const header = new TextEncoder().encode('JOLT_PROOF_V1\0\0\0');
  proofBytes.set(header, 0);

  // Model hash at offset 16
  const modelHashBytes = hexToBytes(modelHash);
  proofBytes.set(modelHashBytes, 16);

  // Input hash at offset 48
  const inputHashBytes = hexToBytes(inputHash);
  proofBytes.set(inputHashBytes, 48);

  // Output hash at offset 80
  const outputHashBytes = hexToBytes(outputHash);
  proofBytes.set(outputHashBytes, 80);

  // Tag at offset 112
  const tagBytes = new TextEncoder().encode(tag.padEnd(16, '\0'));
  proofBytes.set(tagBytes, 112);

  // Timestamp at offset 128
  const timestamp = Math.floor(Date.now() / 1000);
  const timestampView = new DataView(proofBytes.buffer, 128, 8);
  timestampView.setBigUint64(0, BigInt(timestamp), true);

  // Prover version at offset 136
  const versionBytes = new TextEncoder().encode(PROVER_VERSION.padEnd(32, '\0'));
  proofBytes.set(versionBytes, 136);

  // Fill rest with deterministic padding based on hashes
  const combinedHash = keccak256(toHex(proofBytes.slice(0, 168)));
  const paddingBytes = hexToBytes(combinedHash as Hash);
  proofBytes.set(paddingBytes, 168);
  proofBytes.set(paddingBytes, 200);
  proofBytes.set(paddingBytes.slice(0, 24), 232);

  return proofBytes;
}

/**
 * Verify a proof locally (basic structural validation)
 */
export function verifyProofLocally(proof: ZkmlProof): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check proof format
  if (!proof.proof || !proof.proof.startsWith('0x')) {
    errors.push('Invalid proof format: must be hex string starting with 0x');
  }

  // Check proof hash
  if (!proof.proofHash || proof.proofHash.length !== 66) {
    errors.push('Invalid proof hash: must be 32-byte hex string');
  }

  // Verify proof hash matches proof data
  const computedHash = keccak256(proof.proof);
  if (computedHash !== proof.proofHash) {
    errors.push('Proof hash mismatch');
  }

  // Check metadata
  if (!proof.metadata) {
    errors.push('Missing proof metadata');
  } else {
    if (!proof.metadata.modelHash || !isValidHash(proof.metadata.modelHash)) {
      errors.push('Invalid model hash');
    }
    if (!proof.metadata.inputHash || !isValidHash(proof.metadata.inputHash)) {
      errors.push('Invalid input hash');
    }
    if (!proof.metadata.outputHash || !isValidHash(proof.metadata.outputHash)) {
      errors.push('Invalid output hash');
    }
    if (proof.metadata.proofSize < 100) {
      errors.push('Proof size too small');
    }
  }

  // Check tag
  const validTags: ProofTag[] = ['authorization', 'compliance', 'collision_severity', 'decision', 'spending'];
  if (!validTags.includes(proof.tag)) {
    errors.push(`Invalid proof tag: ${proof.tag}`);
  }

  // Check proof header (JOLT format)
  try {
    const proofBytes = hexToBytes(proof.proof as Hash);
    const header = new TextDecoder().decode(proofBytes.slice(0, 13));
    if (header !== 'JOLT_PROOF_V1') {
      errors.push('Invalid proof header: not JOLT format');
    }
  } catch {
    errors.push('Could not decode proof bytes');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Submit a proof to ArcProofAttestation contract
 */
export async function submitProofToChain(
  options: ProofSubmitOptions
): Promise<ProofSubmitResult> {
  const { proof, agentId, treasuryPrivateKey } = options;

  // Validate proof first
  const validation = verifyProofLocally(proof);
  if (!validation.valid) {
    return {
      success: false,
      error: `Proof validation failed: ${validation.errors.join(', ')}`,
    };
  }

  try {
    // Import viem for transaction
    const { createWalletClient, createPublicClient, http, encodeFunctionData } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');

    // Arc Testnet chain config
    const arcTestnet = {
      id: 5042002,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
      rpcUrls: {
        default: { http: ['https://rpc-testnet.arc.circle.com'] },
      },
    };

    const account = privateKeyToAccount(treasuryPrivateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: arcTestnet as any,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet as any,
      transport: http(),
    });

    // ArcProofAttestation ABI
    const abi = [
      {
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
      },
    ] as const;

    // Convert tag to bytes32
    const tagBytes32 = keccak256(toHex(new TextEncoder().encode(proof.tag)));

    // Prepare metadata for contract
    const contractMetadata = {
      modelHash: proof.metadata.modelHash,
      inputHash: proof.metadata.inputHash,
      outputHash: proof.metadata.outputHash,
      proofSize: BigInt(proof.metadata.proofSize),
      generationTime: BigInt(proof.metadata.generationTime),
      proverVersion: proof.metadata.proverVersion,
    };

    // Encode function call
    const data = encodeFunctionData({
      abi,
      functionName: 'validationRequestWithMetadata',
      args: [
        account.address,  // Validator is the submitter
        BigInt(agentId),
        `arc://proof/${proof.proofHash}`,
        proof.proofHash,
        tagBytes32 as Hash,
        contractMetadata,
      ],
    });

    // Send transaction
    const txHash = await walletClient.sendTransaction({
      to: ARC_CONTRACTS.PROOF_ATTESTATION as Address,
      data,
      account,
      chain: arcTestnet as any,
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    return {
      success: receipt.status === 'success',
      txHash,
      error: receipt.status !== 'success' ? 'Transaction reverted' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Proof submission failed',
    };
  }
}

/**
 * Check proof status on-chain
 */
export async function getProofStatus(proofHash: Hash): Promise<{
  exists: boolean;
  isValid: boolean;
  response: number;
}> {
  try {
    const { createPublicClient, http } = await import('viem');

    const arcTestnet = {
      id: 5042002,
      name: 'Arc Testnet',
      rpcUrls: {
        default: { http: ['https://rpc-testnet.arc.circle.com'] },
      },
    };

    const publicClient = createPublicClient({
      chain: arcTestnet as any,
      transport: http(),
    });

    const abi = [
      {
        inputs: [{ name: 'requestHash', type: 'bytes32' }],
        name: 'isProofValid',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'requestHash', type: 'bytes32' }],
        name: 'getValidationStatus',
        outputs: [
          { name: 'validatorAddress', type: 'address' },
          { name: 'agentId', type: 'uint256' },
          { name: 'response', type: 'uint8' },
          { name: 'tag', type: 'bytes32' },
          { name: 'lastUpdate', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    const isValid = await publicClient.readContract({
      address: ARC_CONTRACTS.PROOF_ATTESTATION as Address,
      abi,
      functionName: 'isProofValid',
      args: [proofHash],
    });

    const status = await publicClient.readContract({
      address: ARC_CONTRACTS.PROOF_ATTESTATION as Address,
      abi,
      functionName: 'getValidationStatus',
      args: [proofHash],
    }) as [Address, bigint, number, Hash, bigint];

    const exists = status[0] !== '0x0000000000000000000000000000000000000000';

    return {
      exists,
      isValid: isValid as boolean,
      response: status[2],
    };
  } catch {
    return {
      exists: false,
      isValid: false,
      response: 0,
    };
  }
}

// hexToBytes and isValidHash are now imported from ./utils/crypto
