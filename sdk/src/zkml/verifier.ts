import type { PublicClient, WalletClient, Hash, Address } from 'viem';
import { keccak256, toHex, encodeAbiParameters, parseAbiParameters } from 'viem';
import type { NetworkConfig } from '../types';
import type {
  ProofMetadata,
  ProofStatus,
  ProofSubmitOptions,
  ProofSubmitResult,
  ProofTag,
  ValidationRecord,
  ValidationResponse,
  VerifyOnChainOptions,
  VerifyOnChainResult,
  ZkmlProof,
  ListProofsOptions,
  ProofListItem,
} from './types';

// ABI fragments for ArcProofAttestation contract
const PROOF_ATTESTATION_ABI = [
  {
    name: 'validationRequestWithMetadata',
    type: 'function',
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
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getValidationStatus',
    type: 'function',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      { name: 'validatorAddress', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'response', type: 'uint8' },
      { name: 'tag', type: 'bytes32' },
      { name: 'lastUpdate', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getFullValidation',
    type: 'function',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'validatorAddress', type: 'address' },
          { name: 'agentId', type: 'uint256' },
          { name: 'requestUri', type: 'string' },
          { name: 'requestHash', type: 'bytes32' },
          { name: 'response', type: 'uint8' },
          { name: 'responseUri', type: 'string' },
          { name: 'responseHash', type: 'bytes32' },
          { name: 'tag', type: 'bytes32' },
          { name: 'requestTimestamp', type: 'uint256' },
          { name: 'responseTimestamp', type: 'uint256' },
          { name: 'hasResponse', type: 'bool' },
        ],
      },
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
    stateMutability: 'view',
  },
  {
    name: 'getProofMetadata',
    type: 'function',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      {
        name: '',
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
    stateMutability: 'view',
  },
  {
    name: 'isProofValid',
    type: 'function',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'isProofHashValid',
    type: 'function',
    inputs: [{ name: 'proofHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getAgentValidations',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getAgentValidProofCount',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'verifyProofOnChain',
    type: 'function',
    inputs: [
      { name: 'requestHash', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
  },
  {
    name: 'trustedValidators',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Configuration for the zkML verifier
 */
export interface VerifierConfig {
  network: NetworkConfig;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

/**
 * zkML Verifier Client
 *
 * Interacts with the ArcProofAttestation contract for proof submission
 * and verification status checking.
 *
 * @example
 * ```typescript
 * const verifier = new ZkmlVerifier({
 *   network: ARC_TESTNET,
 *   publicClient,
 *   walletClient,
 * });
 *
 * // Submit a proof
 * const result = await verifier.submitProof({
 *   agentId: '1',
 *   proof: generatedProof,
 * });
 *
 * // Check status
 * const status = await verifier.getProofStatus({
 *   requestHash: result.requestHash,
 * });
 * ```
 */
export class ZkmlVerifier {
  private network: NetworkConfig;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(config: VerifierConfig) {
    this.network = config.network;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
  }

  /**
   * Get the proof attestation contract address
   */
  get contractAddress(): Address {
    return this.network.contracts.arcProofAttestation;
  }

  /**
   * Submit a proof attestation to Arc chain
   *
   * Stores proof data and metadata on-chain for attestation.
   * Arc chain handles the attestation directly - no separate validator needed.
   */
  async submitProof(options: ProofSubmitOptions): Promise<ProofSubmitResult> {
    if (!this.walletClient) {
      return {
        success: false,
        error: 'Wallet client required for submitting proofs',
      };
    }

    try {
      const { agentId, proof } = options;

      // Use the submitter's address as the attestor (Arc handles attestation)
      const attestor = this.walletClient.account!.address;

      // Convert tag to bytes32
      const tagBytes32 = this.tagToBytes32(proof.tag);

      // Prepare metadata tuple
      const metadataTuple = {
        modelHash: proof.metadata.modelHash,
        inputHash: proof.metadata.inputHash,
        outputHash: proof.metadata.outputHash,
        proofSize: BigInt(proof.metadata.proofSize),
        generationTime: BigInt(proof.metadata.generationTime),
        proverVersion: proof.metadata.proverVersion,
      };

      // Request URI - proof data reference (can be updated to use Supabase later)
      const requestUri = proof.requestUri ?? `arc://proof/${proof.proofHash}`;

      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'validationRequestWithMetadata',
        args: [
          attestor,
          BigInt(agentId),
          requestUri,
          proof.proofHash,
          tagBytes32,
          metadataTuple,
        ],
        account: this.walletClient.account!,
      });

      // Execute the transaction
      const txHash = await this.walletClient.writeContract(request);

      // Wait for confirmation
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      return {
        success: true,
        txHash,
        requestHash: proof.proofHash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error submitting proof',
      };
    }
  }

  /**
   * Get the status of a submitted proof
   */
  async getProofStatus(requestHash: Hash): Promise<ProofStatus> {
    try {
      const [record, metadata] = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'getFullValidation',
        args: [requestHash],
      }) as [any, any];

      // Check if proof exists (requestTimestamp > 0)
      const exists = record.requestTimestamp > 0n;

      if (!exists) {
        return {
          exists: false,
          response: 0 as ValidationResponse,
          isValidated: false,
        };
      }

      const validationRecord: ValidationRecord = {
        validatorAddress: record.validatorAddress,
        agentId: record.agentId,
        requestUri: record.requestUri,
        requestHash: record.requestHash,
        response: record.response as ValidationResponse,
        responseUri: record.responseUri,
        responseHash: record.responseHash,
        tag: record.tag,
        requestTimestamp: record.requestTimestamp,
        responseTimestamp: record.responseTimestamp,
        hasResponse: record.hasResponse,
      };

      const proofMetadata: ProofMetadata = {
        modelHash: metadata.modelHash,
        inputHash: metadata.inputHash,
        outputHash: metadata.outputHash,
        proofSize: Number(metadata.proofSize),
        generationTime: Number(metadata.generationTime),
        proverVersion: metadata.proverVersion,
      };

      return {
        exists: true,
        response: record.response as ValidationResponse,
        isValidated: record.hasResponse,
        record: validationRecord,
        metadata: proofMetadata,
      };
    } catch (error) {
      return {
        exists: false,
        response: 0 as ValidationResponse,
        isValidated: false,
      };
    }
  }

  /**
   * Check if a proof is valid (validated with RESPONSE_VALID)
   */
  async isProofValid(requestHash: Hash): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'isProofValid',
        args: [requestHash],
      });
      return result as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Get all proof hashes for an agent
   */
  async getAgentProofs(agentId: string): Promise<Hash[]> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidations',
        args: [BigInt(agentId)],
      });
      return result as Hash[];
    } catch {
      return [];
    }
  }

  /**
   * Get count of valid proofs for an agent
   */
  async getAgentValidProofCount(agentId: string): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidProofCount',
        args: [BigInt(agentId)],
      });
      return Number(result);
    } catch {
      return 0;
    }
  }

  /**
   * List proofs for an agent with optional filtering
   */
  async listProofs(options: ListProofsOptions): Promise<ProofListItem[]> {
    const proofHashes = await this.getAgentProofs(options.agentId);
    const proofs: ProofListItem[] = [];

    for (const hash of proofHashes) {
      const status = await this.getProofStatus(hash);

      if (!status.exists) continue;

      // Apply filters
      if (options.tag) {
        const tagBytes32 = this.tagToBytes32(options.tag);
        if (status.record?.tag !== tagBytes32) continue;
      }

      if (options.response !== undefined && status.response !== options.response) {
        continue;
      }

      proofs.push({
        requestHash: hash,
        tag: this.bytes32ToTag(status.record?.tag ?? '0x'),
        response: status.response,
        isValidated: status.isValidated,
        timestamp: Number(status.record?.requestTimestamp ?? 0n),
        metadata: status.metadata,
      });

      if (options.limit && proofs.length >= options.limit) {
        break;
      }
    }

    return proofs;
  }

  /**
   * Attempt on-chain proof verification
   * Note: This is Phase 2 - currently returns false
   */
  async verifyOnChain(options: VerifyOnChainOptions): Promise<VerifyOnChainResult> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'verifyProofOnChain',
        args: [options.requestHash, options.proof],
      });

      // If it returns false, on-chain verification is not yet implemented
      if (result === false) {
        return {
          supported: false,
          error: 'On-chain verification not yet implemented (Phase 2)',
        };
      }

      return {
        supported: true,
        verified: result as boolean,
      };
    } catch (error) {
      return {
        supported: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Check if an address is a trusted validator
   */
  async isTrustedValidator(address: Address): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'trustedValidators',
        args: [address],
      });
      return result as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Get the contract owner address
   */
  async getOwner(): Promise<Address> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: PROOF_ATTESTATION_ABI,
      functionName: 'owner',
      args: [],
    });
    return result as Address;
  }

  /**
   * Convert proof tag to bytes32
   */
  private tagToBytes32(tag: ProofTag): Hash {
    const encoded = encodeAbiParameters(
      parseAbiParameters('string'),
      [tag]
    );
    return keccak256(encoded) as Hash;
  }

  /**
   * Convert bytes32 to proof tag
   */
  private bytes32ToTag(bytes32: Hash | string): ProofTag {
    // This is a reverse lookup - in practice you'd store the mapping
    const tagMap: Record<string, ProofTag> = {
      [this.tagToBytes32('authorization')]: 'authorization',
      [this.tagToBytes32('compliance')]: 'compliance',
      [this.tagToBytes32('collision_severity')]: 'collision_severity',
    };
    return tagMap[bytes32] ?? 'authorization';
  }
}
