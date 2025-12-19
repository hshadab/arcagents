import type { Address, Hash, WalletClient, PublicClient } from 'viem';
import type { PaymentRequirement, PaymentResult, X402Service } from '../types';
import { USDC_ADDRESSES } from '../config';

const PAYMENT_REQUIRED_HEADERS = ['payment-required', 'x-payment-required'];
const PAYMENT_HEADER = 'x-payment';

// ERC20 ABI for USDC transfers
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

interface X402ClientConfig {
  /** Wallet client for signing transactions */
  wallet: WalletClient;
  /** Public client for reading chain state */
  publicClient: PublicClient;
  /** Treasury contract address (for agent-funded payments) */
  treasury?: Address;
  /** Agent ID (for tracking payments) */
  agentId?: string;
  /** Skip actual payment execution (for testing) */
  simulatePayments?: boolean;
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
  private simulatePayments: boolean;

  constructor(config: X402ClientConfig) {
    this.wallet = config.wallet;
    this.publicClient = config.publicClient;
    this.treasury = config.treasury;
    this.agentId = config.agentId;
    this.simulatePayments = config.simulatePayments ?? false;
  }

  /**
   * Get USDC address for a network
   */
  private getUsdcAddress(network: string): Address | null {
    return USDC_ADDRESSES[network] ?? null;
  }

  /**
   * Execute actual USDC transfer for x402 payment
   */
  private async executePayment(requirement: PaymentRequirement): Promise<{
    txHash: Hash;
    amount: string;
  }> {
    const account = this.wallet.account;
    if (!account) {
      throw new Error('Wallet has no account');
    }

    // Get USDC address for the payment network
    const usdcAddress = this.getUsdcAddress(requirement.network);
    if (!usdcAddress) {
      throw new Error(`USDC not configured for network: ${requirement.network}. Supported: ${Object.keys(USDC_ADDRESSES).join(', ')}`);
    }

    const amount = BigInt(requirement.maxAmount);
    const recipient = requirement.payTo as Address;

    // Check balance first
    const balance = await this.publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }) as bigint;

    if (balance < amount) {
      const balanceFormatted = (Number(balance) / 1_000_000).toFixed(6);
      const amountFormatted = (Number(amount) / 1_000_000).toFixed(6);
      throw new Error(
        `Insufficient USDC balance. Have: ${balanceFormatted}, Need: ${amountFormatted}`
      );
    }

    // Execute transfer
    const txHash = await this.wallet.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipient, amount],
      account,
      chain: { id: await this.publicClient.getChainId() } as any,
    });

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      throw new Error(`Payment transaction failed: ${txHash}`);
    }

    return {
      txHash,
      amount: requirement.maxAmount,
    };
  }

  /**
   * Fetch a resource, automatically handling x402 payments
   */
  async fetch(url: string, init?: RequestInit): Promise<Response & { paymentResult?: PaymentResult }> {
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

    // Execute actual payment and create signed payload
    const { payload, txHash, amount } = await this.createPaymentPayload(requirement);

    // Retry with payment proof
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        'Accept': 'application/json',
        [PAYMENT_HEADER]: payload,
      },
    });

    // Attach payment result to response for caller access
    const paymentResult = this.extractPaymentResult(response, txHash, amount);
    (response as any).paymentResult = paymentResult;

    return response;
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
    // Use attached payment result from fetch, or extract from headers
    const payment = (response as any).paymentResult || this.extractPaymentResult(response);

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
          // Use Buffer for Node.js compatibility (replaces atob)
          const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
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

  private async createPaymentPayload(requirement: PaymentRequirement): Promise<{
    payload: string;
    txHash?: Hash;
    amount?: string;
  }> {
    const account = this.wallet.account;
    if (!account) {
      throw new Error('Wallet has no account');
    }

    let txHash: Hash | undefined;
    let amountPaid: string | undefined;

    // Execute actual payment unless in simulation mode
    if (!this.simulatePayments) {
      const paymentResult = await this.executePayment(requirement);
      txHash = paymentResult.txHash;
      amountPaid = paymentResult.amount;
    }

    // Create EIP-712 typed data for payment proof
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
      txHash, // Include actual transaction hash
    };

    // Use Buffer for Node.js compatibility (replaces btoa)
    return {
      payload: Buffer.from(JSON.stringify(payload)).toString('base64'),
      txHash,
      amount: amountPaid,
    };
  }

  private extractPaymentResult(response: Response, localTxHash?: Hash, localAmount?: string): PaymentResult {
    const paymentResponse = response.headers.get('payment-response')
      || response.headers.get('x-payment-response');

    if (paymentResponse) {
      try {
        // Use Buffer for Node.js compatibility (replaces atob)
        const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString('utf-8'));
        return {
          success: true,
          transactionHash: decoded.txHash as Hash,
          amount: decoded.amount,
          network: decoded.network,
          settlement: {
            network: decoded.network,
            txHash: decoded.txHash,
            amount: decoded.amount,
          },
        };
      } catch {
        // Fall through to local data
      }
    }

    // Return local payment data if service didn't provide response
    return {
      success: true,
      transactionHash: localTxHash,
      amount: localAmount,
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
