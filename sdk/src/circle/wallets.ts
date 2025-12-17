/**
 * Circle Programmable Wallets Integration
 *
 * Each Arc Agent owns its own Circle wallet, enabling:
 * - Secure key management (Circle handles keys)
 * - Built-in compliance hooks
 * - Policy-based spending limits
 * - Native USDC support on Arc
 *
 * @see https://developers.circle.com/w3s/programmable-wallets
 */

import type { Address, Hash } from 'viem';

// Circle API base URLs
const CIRCLE_API_BASE = 'https://api.circle.com';
const CIRCLE_API_SANDBOX = 'https://api-sandbox.circle.com';

/**
 * Circle wallet status
 */
export type WalletStatus = 'PENDING' | 'LIVE' | 'FROZEN' | 'DISABLED';

/**
 * Circle wallet blockchain type
 */
export type BlockchainType = 'ARC' | 'ARC-TESTNET' | 'ETH' | 'ETH-SEPOLIA' | 'MATIC' | 'SOL';

/**
 * Circle wallet representation
 */
export interface CircleWallet {
  id: string;
  address: Address;
  blockchain: BlockchainType;
  status: WalletStatus;
  custodyType: 'DEVELOPER' | 'ENDUSER';
  name?: string;
  refId?: string;
  createDate: string;
  updateDate: string;
}

/**
 * Wallet creation options
 */
export interface CreateWalletOptions {
  /** Unique identifier for the agent */
  agentId: string;
  /** Human-readable name */
  name?: string;
  /** Blockchain to create wallet on */
  blockchain?: BlockchainType;
  /** Wallet set ID (for grouping wallets) */
  walletSetId?: string;
}

/**
 * Wallet set for grouping agent wallets
 */
export interface WalletSet {
  id: string;
  name: string;
  custodyType: 'DEVELOPER' | 'ENDUSER';
}

/**
 * Transaction request
 */
export interface TransactionRequest {
  walletId: string;
  destinationAddress: Address;
  amount: string;
  tokenId?: string; // For USDC transfers
  fee?: {
    type: 'level';
    config: { feeLevel: 'LOW' | 'MEDIUM' | 'HIGH' };
  };
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  id: string;
  state: 'INITIATED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  txHash?: Hash;
  amounts: string[];
  createDate: string;
}

/**
 * Configuration for Circle Wallets client
 */
export interface CircleWalletsConfig {
  /** Circle API key */
  apiKey: string;
  /** Use sandbox/testnet environment */
  sandbox?: boolean;
  /** Entity secret for wallet operations */
  entitySecret?: string;
}

/**
 * Circle Programmable Wallets Client
 *
 * Creates and manages wallets for Arc Agents using Circle's infrastructure.
 *
 * @example
 * ```typescript
 * const wallets = new CircleWallets({
 *   apiKey: process.env.CIRCLE_API_KEY!,
 *   sandbox: true,
 * });
 *
 * // Create wallet for an agent
 * const wallet = await wallets.createAgentWallet({
 *   agentId: 'agent-123',
 *   name: 'weather-bot',
 * });
 *
 * console.log('Agent wallet:', wallet.address);
 * ```
 */
export class CircleWallets {
  private apiKey: string;
  private baseUrl: string;
  private entitySecret?: string;

  constructor(config: CircleWalletsConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.sandbox ? CIRCLE_API_SANDBOX : CIRCLE_API_BASE;
    this.entitySecret = config.entitySecret;
  }

  /**
   * Create a wallet for an Arc Agent
   */
  async createAgentWallet(options: CreateWalletOptions): Promise<CircleWallet> {
    const { agentId, name, blockchain = 'ARC-TESTNET', walletSetId } = options;

    // First, ensure we have a wallet set
    const setId = walletSetId || await this.getOrCreateWalletSet('arc-agents');

    const response = await this.request('/v1/w3s/developer/wallets', {
      method: 'POST',
      body: {
        idempotencyKey: `agent-wallet-${agentId}-${Date.now()}`,
        walletSetId: setId,
        blockchains: [blockchain],
        count: 1,
        metadata: [
          {
            name: name || `agent-${agentId}`,
            refId: agentId,
          },
        ],
      },
    });

    const wallets = response.data?.wallets || [];
    if (wallets.length === 0) {
      throw new Error('Failed to create wallet');
    }

    return this.mapWallet(wallets[0]);
  }

  /**
   * Get wallet by agent ID (refId)
   */
  async getAgentWallet(agentId: string): Promise<CircleWallet | null> {
    const response = await this.request('/v1/w3s/wallets', {
      method: 'GET',
      params: { refId: agentId },
    });

    const wallets = response.data?.wallets || [];
    return wallets.length > 0 ? this.mapWallet(wallets[0]) : null;
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<CircleWallet> {
    const response = await this.request(`/v1/w3s/wallets/${walletId}`, {
      method: 'GET',
    });

    return this.mapWallet(response.data?.wallet);
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string): Promise<{ amount: string; currency: string }[]> {
    const response = await this.request(`/v1/w3s/wallets/${walletId}/balances`, {
      method: 'GET',
    });

    return response.data?.tokenBalances || [];
  }

  /**
   * Create a transaction from agent wallet
   */
  async createTransaction(request: TransactionRequest): Promise<TransactionResponse> {
    const response = await this.request('/v1/w3s/developer/transactions/transfer', {
      method: 'POST',
      body: {
        idempotencyKey: `tx-${request.walletId}-${Date.now()}`,
        walletId: request.walletId,
        destinationAddress: request.destinationAddress,
        amounts: [request.amount],
        tokenId: request.tokenId,
        fee: request.fee || {
          type: 'level',
          config: { feeLevel: 'MEDIUM' },
        },
      },
    });

    return response.data;
  }

  /**
   * Get transaction status
   */
  async getTransaction(transactionId: string): Promise<TransactionResponse> {
    const response = await this.request(`/v1/w3s/transactions/${transactionId}`, {
      method: 'GET',
    });

    return response.data?.transaction;
  }

  /**
   * List all agent wallets
   */
  async listAgentWallets(options?: {
    blockchain?: BlockchainType;
    status?: WalletStatus;
    limit?: number;
  }): Promise<CircleWallet[]> {
    const response = await this.request('/v1/w3s/wallets', {
      method: 'GET',
      params: {
        blockchain: options?.blockchain,
        status: options?.status,
        pageSize: options?.limit,
      },
    });

    return (response.data?.wallets || []).map(this.mapWallet);
  }

  /**
   * Get or create a wallet set for grouping wallets
   */
  private async getOrCreateWalletSet(name: string): Promise<string> {
    // Try to find existing wallet set
    const listResponse = await this.request('/v1/w3s/developer/walletSets', {
      method: 'GET',
    });

    const sets = listResponse.data?.walletSets || [];
    const existing = sets.find((s: any) => s.name === name);
    if (existing) {
      return existing.id;
    }

    // Create new wallet set
    const createResponse = await this.request('/v1/w3s/developer/walletSets', {
      method: 'POST',
      body: {
        idempotencyKey: `wallet-set-${name}-${Date.now()}`,
        name,
      },
    });

    return createResponse.data?.walletSet?.id;
  }

  /**
   * Make API request to Circle
   */
  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }
  ): Promise<any> {
    let url = `${this.baseUrl}${path}`;

    // Add query params for GET requests
    if (options.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.entitySecret) {
      headers['X-Entity-Secret'] = this.entitySecret;
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Circle API error: ${response.status} - ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Map Circle API response to our wallet type
   */
  private mapWallet(data: any): CircleWallet {
    return {
      id: data.id,
      address: data.address as Address,
      blockchain: data.blockchain,
      status: data.state || 'LIVE',
      custodyType: data.custodyType,
      name: data.name,
      refId: data.refId,
      createDate: data.createDate,
      updateDate: data.updateDate,
    };
  }
}

/**
 * Create a Circle Wallets client with environment config
 */
export function createCircleWallets(config?: Partial<CircleWalletsConfig>): CircleWallets {
  const apiKey = config?.apiKey || process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY is required');
  }

  return new CircleWallets({
    apiKey,
    sandbox: config?.sandbox ?? true, // Default to sandbox
    entitySecret: config?.entitySecret,
  });
}
