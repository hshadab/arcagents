import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Log,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  decodeEventLog,
} from 'viem';
import {
  type Agent,
  type AgentConfig,
  type AgentBalance,
  type NetworkConfig,
  KycStatus,
  type X402Service,
} from '../types';
import { X402Client } from '../x402/client';

// ABI fragments for Arc contracts
const ARC_AGENT_ABI = [
  {
    name: 'createAgent',
    type: 'function',
    inputs: [
      { name: 'circleWallet', type: 'address' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'proverVersion', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'getAgentGlobalId',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'checkAgentEligibility',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'eligible', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
  },
  // Events
  {
    name: 'AgentCreated',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'walletAddress', type: 'address', indexed: false },
      { name: 'modelHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;

const ARC_IDENTITY_ABI = [
  {
    name: 'getAgentIdentity',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'circleWallet', type: 'address' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'proverVersion', type: 'string' },
      { name: 'kycStatus', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'getAgentsByOwner',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const;

const ARC_TREASURY_ABI = [
  {
    name: 'getAgentBalance',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'deposit',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface ArcAgentClientConfig {
  /** Network configuration */
  network: NetworkConfig;
  /** Wallet client for signing transactions */
  wallet: WalletClient;
  /** Public client for reading chain state */
  publicClient: PublicClient;
}

/**
 * Client for managing Arc Agents on-chain.
 *
 * Handles agent creation, identity management, treasury operations,
 * and x402 payment integration.
 */
export class ArcAgentClient {
  private network: NetworkConfig;
  private wallet: WalletClient;
  private publicClient: PublicClient;

  constructor(config: ArcAgentClientConfig) {
    this.network = config.network;
    this.wallet = config.wallet;
    this.publicClient = config.publicClient;
  }

  /**
   * Spawn a new Arc Agent
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
    const account = this.wallet.account;
    if (!account) {
      throw new Error('Wallet has no account');
    }

    // Validate configuration
    this.validateAgentConfig(config);

    const walletAddress = config.walletAddress || account.address;
    const modelHash = config.modelHash || ('0x' + '0'.repeat(64)) as Hash;
    const proverVersion = config.proverVersion || '1.0.0';

    // Create agent on-chain
    const hash = await this.wallet.writeContract({
      address: this.network.contracts.arcAgent,
      abi: ARC_AGENT_ABI,
      functionName: 'createAgent',
      args: [walletAddress, modelHash, proverVersion],
      account,
      chain: { id: this.network.chainId } as any,
    });

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Extract agent ID from logs (simplified - would parse event logs)
    const agentId = this.parseAgentIdFromReceipt(receipt);

    // Get global ID
    const globalId = await this.publicClient.readContract({
      address: this.network.contracts.arcAgent,
      abi: ARC_AGENT_ABI,
      functionName: 'getAgentGlobalId',
      args: [BigInt(agentId)],
    }) as string;

    // Deposit initial funds if specified
    if (config.initialDeposit) {
      await this.deposit(agentId, config.initialDeposit);
    }

    return {
      id: agentId,
      globalId,
      name: config.name,
      owner: account.address,
      walletAddress,
      kycStatus: KycStatus.None,
      createdAt: Date.now(),
      metadata: config.metadata || {},
    };
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const identity = await this.publicClient.readContract({
        address: this.network.contracts.arcIdentity,
        abi: ARC_IDENTITY_ABI,
        functionName: 'getAgentIdentity',
        args: [BigInt(agentId)],
      }) as [Address, Address, Hash, string, number, bigint];

      const [owner, walletAddress, _modelHash, _proverVersion, kycStatus, createdAt] = identity;

      const globalId = await this.publicClient.readContract({
        address: this.network.contracts.arcAgent,
        abi: ARC_AGENT_ABI,
        functionName: 'getAgentGlobalId',
        args: [BigInt(agentId)],
      }) as string;

      return {
        id: agentId,
        globalId,
        name: `Agent #${agentId}`,
        owner,
        walletAddress,
        kycStatus: kycStatus as KycStatus,
        createdAt: Number(createdAt) * 1000,
        metadata: {},
      };
    } catch {
      return null;
    }
  }

  /**
   * List all agents owned by an address
   */
  async listAgents(owner?: Address): Promise<Agent[]> {
    const account = this.wallet.account;
    const ownerAddress = owner || account?.address;
    if (!ownerAddress) {
      throw new Error('No owner address provided');
    }

    const agentIds = await this.publicClient.readContract({
      address: this.network.contracts.arcIdentity,
      abi: ARC_IDENTITY_ABI,
      functionName: 'getAgentsByOwner',
      args: [ownerAddress],
    }) as bigint[];

    const agents = await Promise.all(
      agentIds.map(id => this.getAgent(id.toString()))
    );

    return agents.filter((a): a is Agent => a !== null);
  }

  /**
   * Get agent treasury balance
   */
  async getBalance(agentId: string): Promise<AgentBalance> {
    const balance = await this.publicClient.readContract({
      address: this.network.contracts.arcTreasury,
      abi: ARC_TREASURY_ABI,
      functionName: 'getAgentBalance',
      args: [BigInt(agentId)],
    }) as bigint;

    return {
      agentId,
      available: formatUnits(balance, 6), // USDC has 6 decimals
      pending: '0',
      locked: '0',
    };
  }

  /**
   * Deposit USDC into agent treasury
   */
  async deposit(agentId: string, amount: string): Promise<Hash> {
    const account = this.wallet.account;
    if (!account) {
      throw new Error('Wallet has no account');
    }

    const amountAtomic = parseUnits(amount, 6);

    // Approve USDC spend
    await this.wallet.writeContract({
      address: this.network.contracts.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [this.network.contracts.arcTreasury, amountAtomic],
      account,
      chain: { id: this.network.chainId } as any,
    });

    // Deposit
    const hash = await this.wallet.writeContract({
      address: this.network.contracts.arcTreasury,
      abi: ARC_TREASURY_ABI,
      functionName: 'deposit',
      args: [BigInt(agentId), amountAtomic],
      account,
      chain: { id: this.network.chainId } as any,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Check if agent is eligible for transfers
   */
  async checkEligibility(agentId: string): Promise<{ eligible: boolean; reason: string }> {
    const result = await this.publicClient.readContract({
      address: this.network.contracts.arcAgent,
      abi: ARC_AGENT_ABI,
      functionName: 'checkAgentEligibility',
      args: [BigInt(agentId)],
    }) as [boolean, string];

    return {
      eligible: result[0],
      reason: result[1],
    };
  }

  /**
   * Create an x402 client for this agent to make paid requests
   */
  createX402Client(agentId: string): X402Client {
    return new X402Client({
      wallet: this.wallet,
      publicClient: this.publicClient,
      treasury: this.network.contracts.arcTreasury,
      agentId,
    });
  }

  /**
   * Parse AgentCreated event from transaction receipt to get agent ID
   */
  private parseAgentIdFromReceipt(receipt: any): string {
    // Find the AgentCreated event in the logs
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ARC_AGENT_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'AgentCreated') {
          const agentId = (decoded.args as any).agentId;
          return agentId.toString();
        }
      } catch {
        // Not an AgentCreated event, continue
        continue;
      }
    }

    throw new Error(
      'AgentCreated event not found in transaction receipt. ' +
      'Transaction may have failed or contract ABI mismatch.'
    );
  }

  /**
   * Validate agent configuration before creation
   */
  private validateAgentConfig(config: AgentConfig): void {
    if (config.name && config.name.length > 64) {
      throw new Error('Agent name must be 64 characters or less');
    }
    if (config.name && !/^[\w\s-]+$/.test(config.name)) {
      throw new Error('Agent name can only contain letters, numbers, spaces, underscores, and hyphens');
    }
    if (config.initialDeposit) {
      const deposit = parseFloat(config.initialDeposit);
      if (isNaN(deposit) || deposit < 0) {
        throw new Error('Initial deposit must be a non-negative number');
      }
    }
    if (config.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.walletAddress)) {
      throw new Error('Invalid wallet address format');
    }
  }
}
