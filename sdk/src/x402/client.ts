import type { Address, Hash, WalletClient, PublicClient } from 'viem';
import type { PaymentRequirement, PaymentResult, X402Service } from '../types';

const PAYMENT_REQUIRED_HEADERS = ['payment-required', 'x-payment-required'];
const PAYMENT_HEADER = 'x-payment';

interface X402ClientConfig {
  /** Wallet client for signing transactions */
  wallet: WalletClient;
  /** Public client for reading chain state */
  publicClient: PublicClient;
  /** Treasury contract address (for agent-funded payments) */
  treasury?: Address;
  /** Agent ID (for tracking payments) */
  agentId?: string;
}

/**
 * x402 payment client for Arc Agents.
 *
 * Wraps fetch to automatically handle HTTP 402 responses and
 * execute USDC payments on behalf of an agent.
 */
export class X402Client {
  private wallet: WalletClient;
  private publicClient: PublicClient;
  private treasury?: Address;
  private agentId?: string;

  constructor(config: X402ClientConfig) {
    this.wallet = config.wallet;
    this.publicClient = config.publicClient;
    this.treasury = config.treasury;
    this.agentId = config.agentId;
  }

  /**
   * Fetch a resource, automatically handling x402 payments
   */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    // First request - check if payment required
    const initialResponse = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        'Accept': 'application/json',
      },
    });

    if (initialResponse.status !== 402) {
      return initialResponse;
    }

    // Extract payment requirements
    const requirement = this.extractPaymentRequirement(initialResponse);
    if (!requirement) {
      throw new Error('Received 402 but no payment requirements found');
    }

    // Execute payment and get signature
    const paymentPayload = await this.createPaymentPayload(requirement);

    // Retry with payment
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        'Accept': 'application/json',
        [PAYMENT_HEADER]: paymentPayload,
      },
    });
  }

  /**
   * Execute a paid request to an x402 service
   */
  async callService<T = unknown>(service: X402Service, path: string = '', options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ data: T; payment: PaymentResult }> {
    const url = service.url + path;

    const response = await this.fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Service request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T;
    const payment = this.extractPaymentResult(response);

    return { data, payment };
  }

  /**
   * Check if a URL requires x402 payment
   */
  async checkPaymentRequired(url: string): Promise<PaymentRequirement | null> {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 402) {
      return this.extractPaymentRequirement(response);
    }

    return null;
  }

  private extractPaymentRequirement(response: Response): PaymentRequirement | null {
    for (const headerName of PAYMENT_REQUIRED_HEADERS) {
      const header = response.headers.get(headerName);
      if (header) {
        try {
          const decoded = JSON.parse(atob(header));
          return {
            scheme: decoded.scheme || 'exact',
            network: decoded.network,
            asset: decoded.asset,
            payTo: decoded.payTo,
            maxAmount: decoded.maxAmount || decoded.amount,
            resource: decoded.resource || response.url,
            description: decoded.description,
          };
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private async createPaymentPayload(requirement: PaymentRequirement): Promise<string> {
    const account = this.wallet.account;
    if (!account) {
      throw new Error('Wallet has no account');
    }

    // Create EIP-712 typed data for payment authorization
    const domain = {
      name: 'x402',
      version: '1',
      chainId: await this.publicClient.getChainId(),
    };

    const types = {
      Payment: [
        { name: 'scheme', type: 'string' },
        { name: 'network', type: 'string' },
        { name: 'asset', type: 'address' },
        { name: 'payTo', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'resource', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validUntil', type: 'uint256' },
      ],
    };

    const nonce = BigInt(Date.now());
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min validity

    const message = {
      scheme: requirement.scheme,
      network: requirement.network,
      asset: requirement.asset,
      payTo: requirement.payTo,
      amount: BigInt(requirement.maxAmount),
      resource: requirement.resource,
      nonce,
      validUntil,
    };

    const signature = await this.wallet.signTypedData({
      account,
      domain,
      types,
      primaryType: 'Payment',
      message,
    });

    const payload = {
      ...message,
      amount: requirement.maxAmount,
      nonce: nonce.toString(),
      validUntil: validUntil.toString(),
      signature,
      payer: account.address,
      agentId: this.agentId,
    };

    return btoa(JSON.stringify(payload));
  }

  private extractPaymentResult(response: Response): PaymentResult {
    const paymentResponse = response.headers.get('payment-response')
      || response.headers.get('x-payment-response');

    if (paymentResponse) {
      try {
        const decoded = JSON.parse(atob(paymentResponse));
        return {
          success: true,
          transactionHash: decoded.txHash as Hash,
          settlement: {
            network: decoded.network,
            txHash: decoded.txHash,
            amount: decoded.amount,
          },
        };
      } catch {
        // Fall through to default
      }
    }

    return {
      success: true,
    };
  }
}

/**
 * Create a fetch function that automatically handles x402 payments
 */
export function createPaymentFetch(config: X402ClientConfig): typeof fetch {
  const client = new X402Client(config);

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return client.fetch(url, init);
  };
}
