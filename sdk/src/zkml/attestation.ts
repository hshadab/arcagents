/**
 * On-chain Proof Attestation Service
 *
 * Submits zkML proofs to the ArcProofAttestation contract on Arc testnet.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  keccak256,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ZkmlProof, ProofMetadata, ProofTag } from './types.js';

// ArcProofAttestation ABI (minimal for submission)
const ARC_PROOF_ATTESTATION_ABI = [
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
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentValidations',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentValidProofCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Arc testnet chain config
const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc-testnet.arc.circle.com'] },
  },
} as const;

export interface AttestationConfig {
  /** ArcProofAttestation contract address */
  contractAddress: Address;
  /** Private key for signing transactions */
  privateKey?: string;
  /** Wallet client (alternative to privateKey) */
  walletClient?: WalletClient;
  /** RPC URL override */
  rpcUrl?: string;
  /** Validator address to assign proofs to */
  validatorAddress?: Address;
}

export interface SubmitProofResult {
  success: boolean;
  txHash?: Hash;
  requestHash?: Hash;
  error?: string;
}

export interface ProofStatusResult {
  exists: boolean;
  isValid: boolean;
  response: number;
  validatorAddress?: Address;
  agentId?: bigint;
  tag?: Hash;
  lastUpdate?: bigint;
}

/**
 * Proof Attestation Client
 *
 * Submits zkML proofs to the ArcProofAttestation contract.
 */
export class ProofAttestation {
  private contractAddress: Address;
  private publicClient: any; // Use any to avoid complex viem type issues
  private walletClient: any = null;
  private validatorAddress: Address;
  private rpcUrl: string;

  constructor(config: AttestationConfig) {
    this.contractAddress = config.contractAddress;
    this.validatorAddress = config.validatorAddress || config.contractAddress;
    this.rpcUrl = config.rpcUrl || ARC_TESTNET_CHAIN.rpcUrls.default.http[0];

    this.publicClient = createPublicClient({
      chain: ARC_TESTNET_CHAIN as any,
      transport: http(this.rpcUrl),
    });

    if (config.walletClient) {
      this.walletClient = config.walletClient;
    } else if (config.privateKey) {
      const account = privateKeyToAccount(config.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: ARC_TESTNET_CHAIN as any,
        transport: http(this.rpcUrl),
      });
    }
  }

  /**
   * Submit a proof to the ArcProofAttestation contract
   */
  async submitProof(
    proof: ZkmlProof,
    agentId: string | bigint,
    requestUri?: string
  ): Promise<SubmitProofResult> {
    if (!this.walletClient?.account) {
      return {
        success: false,
        error: 'No wallet configured for proof submission',
      };
    }

    try {
      const agentIdBigInt = typeof agentId === 'string' ? BigInt(agentId) : agentId;

      // Use proof hash as request hash
      const requestHash = proof.proofHash as Hash;

      // Convert tag to bytes32
      const tagBytes32 = this.tagToBytes32(proof.tag);

      // Prepare metadata for contract
      const metadata = {
        modelHash: proof.metadata.modelHash as Hash,
        inputHash: proof.metadata.inputHash as Hash,
        outputHash: proof.metadata.outputHash as Hash,
        proofSize: BigInt(proof.metadata.proofSize),
        generationTime: BigInt(proof.metadata.generationTime),
        proverVersion: proof.metadata.proverVersion,
      };

      // Encode function call
      const data = encodeFunctionData({
        abi: ARC_PROOF_ATTESTATION_ABI,
        functionName: 'validationRequestWithMetadata',
        args: [
          this.validatorAddress,
          agentIdBigInt,
          requestUri || `ipfs://proof/${requestHash}`,
          requestHash,
          tagBytes32,
          metadata,
        ],
      });

      // Send transaction
      const txHash = await this.walletClient.sendTransaction({
        to: this.contractAddress,
        data,
        account: this.walletClient.account,
        chain: ARC_TESTNET_CHAIN as any,
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      return {
        success: receipt.status === 'success',
        txHash,
        requestHash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error submitting proof',
      };
    }
  }

  /**
   * Check if a proof is valid on-chain
   */
  async isProofValid(requestHash: Hash): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ARC_PROOF_ATTESTATION_ABI,
        functionName: 'isProofValid',
        args: [requestHash],
      });
      return result as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Get proof status from contract
   */
  async getProofStatus(requestHash: Hash): Promise<ProofStatusResult> {
    try {
      const [validatorAddress, agentId, response, tag, lastUpdate] =
        (await this.publicClient.readContract({
          address: this.contractAddress,
          abi: ARC_PROOF_ATTESTATION_ABI,
          functionName: 'getValidationStatus',
          args: [requestHash],
        })) as [Address, bigint, number, Hash, bigint];

      const exists = validatorAddress !== '0x0000000000000000000000000000000000000000';

      return {
        exists,
        isValid: response === 1, // RESPONSE_VALID
        response,
        validatorAddress: exists ? validatorAddress : undefined,
        agentId: exists ? agentId : undefined,
        tag: exists ? tag : undefined,
        lastUpdate: exists ? lastUpdate : undefined,
      };
    } catch {
      return {
        exists: false,
        isValid: false,
        response: 0,
      };
    }
  }

  /**
   * Get all proof hashes for an agent
   */
  async getAgentProofs(agentId: string | bigint): Promise<Hash[]> {
    try {
      const agentIdBigInt = typeof agentId === 'string' ? BigInt(agentId) : agentId;
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ARC_PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidations',
        args: [agentIdBigInt],
      });
      return result as Hash[];
    } catch {
      return [];
    }
  }

  /**
   * Get count of valid proofs for an agent
   */
  async getAgentValidProofCount(agentId: string | bigint): Promise<number> {
    try {
      const agentIdBigInt = typeof agentId === 'string' ? BigInt(agentId) : agentId;
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ARC_PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidProofCount',
        args: [agentIdBigInt],
      });
      return Number(result);
    } catch {
      return 0;
    }
  }

  /**
   * Convert proof tag to bytes32
   */
  private tagToBytes32(tag: ProofTag): Hash {
    const tagString = tag.padEnd(32, '\0');
    return keccak256(toHex(new TextEncoder().encode(tagString))) as Hash;
  }
}

/**
 * Create a proof attestation client with default config
 */
export function createProofAttestation(
  contractAddress: Address,
  privateKey?: string
): ProofAttestation {
  return new ProofAttestation({
    contractAddress,
    privateKey,
  });
}
