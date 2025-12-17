/**
 * Circle Compliance Engine Integration
 *
 * Provides address screening and risk assessment for Arc Agents.
 * Used to verify counterparties before transfers.
 *
 * @see https://developers.circle.com/w3s/compliance-engine
 */

import type { Address } from 'viem';

// Circle Compliance API base URLs
const CIRCLE_API_BASE = 'https://api.circle.com';
const CIRCLE_API_SANDBOX = 'https://api-sandbox.circle.com';

/**
 * Compliance screening status
 */
export type ScreeningStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'REVIEW_REQUIRED';

/**
 * Risk level from compliance check
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

/**
 * Screening result
 */
export interface ScreeningResult {
  id: string;
  address: Address;
  status: ScreeningStatus;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  flags: string[];
  details?: {
    sanctioned: boolean;
    pep: boolean; // Politically Exposed Person
    adverseMedia: boolean;
    categories: string[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Screening request options
 */
export interface ScreeningOptions {
  /** Address to screen */
  address: Address;
  /** Chain identifier */
  chain?: string;
  /** Additional context for the screening */
  context?: {
    transactionType?: 'SEND' | 'RECEIVE';
    amount?: string;
    currency?: string;
  };
}

/**
 * Batch screening request
 */
export interface BatchScreeningOptions {
  addresses: Address[];
  chain?: string;
}

/**
 * Configuration for Compliance client
 */
export interface ComplianceConfig {
  /** Circle API key */
  apiKey: string;
  /** Use sandbox/testnet environment */
  sandbox?: boolean;
  /** Auto-approve low-risk addresses */
  autoApproveThreshold?: RiskLevel;
}

/**
 * Circle Compliance Engine Client
 *
 * Screen addresses for sanctions, PEP status, and other risk factors.
 *
 * @example
 * ```typescript
 * const compliance = new CircleCompliance({
 *   apiKey: process.env.CIRCLE_API_KEY!,
 *   sandbox: true,
 * });
 *
 * // Screen an address before transfer
 * const result = await compliance.screenAddress({
 *   address: '0x1234...',
 *   context: { transactionType: 'SEND', amount: '100' },
 * });
 *
 * if (result.status === 'APPROVED') {
 *   // Safe to proceed with transfer
 * }
 * ```
 */
export class CircleCompliance {
  private apiKey: string;
  private baseUrl: string;
  private autoApproveThreshold: RiskLevel;

  constructor(config: ComplianceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.sandbox ? CIRCLE_API_SANDBOX : CIRCLE_API_BASE;
    this.autoApproveThreshold = config.autoApproveThreshold || 'LOW';
  }

  /**
   * Screen a single address
   */
  async screenAddress(options: ScreeningOptions): Promise<ScreeningResult> {
    const response = await this.request('/v1/compliance/screening', {
      method: 'POST',
      body: {
        idempotencyKey: `screen-${options.address}-${Date.now()}`,
        address: options.address,
        chain: options.chain || 'ARC',
        context: options.context,
      },
    });

    return this.mapScreeningResult(response.data);
  }

  /**
   * Screen multiple addresses in batch
   */
  async screenBatch(options: BatchScreeningOptions): Promise<ScreeningResult[]> {
    const response = await this.request('/v1/compliance/screening/batch', {
      method: 'POST',
      body: {
        idempotencyKey: `batch-screen-${Date.now()}`,
        addresses: options.addresses,
        chain: options.chain || 'ARC',
      },
    });

    return (response.data?.results || []).map(this.mapScreeningResult);
  }

  /**
   * Get screening result by ID
   */
  async getScreening(screeningId: string): Promise<ScreeningResult> {
    const response = await this.request(`/v1/compliance/screening/${screeningId}`, {
      method: 'GET',
    });

    return this.mapScreeningResult(response.data);
  }

  /**
   * Check if an address is safe for transactions
   *
   * @returns true if address passes compliance checks
   */
  async isAddressSafe(address: Address): Promise<boolean> {
    try {
      const result = await this.screenAddress({ address });
      return result.status === 'APPROVED' || this.isWithinThreshold(result.riskLevel);
    } catch {
      // If screening fails, default to unsafe
      return false;
    }
  }

  /**
   * Quick risk check without full screening
   */
  async quickRiskCheck(address: Address): Promise<{
    safe: boolean;
    riskLevel: RiskLevel;
    reason?: string;
  }> {
    try {
      const result = await this.screenAddress({ address });

      const safe = result.status === 'APPROVED' || this.isWithinThreshold(result.riskLevel);

      return {
        safe,
        riskLevel: result.riskLevel,
        reason: safe
          ? undefined
          : result.flags.length > 0
            ? result.flags.join(', ')
            : `Risk level: ${result.riskLevel}`,
      };
    } catch (error) {
      return {
        safe: false,
        riskLevel: 'SEVERE',
        reason: error instanceof Error ? error.message : 'Screening failed',
      };
    }
  }

  /**
   * Validate transfer participants
   *
   * Screens both sender and recipient before a transfer.
   */
  async validateTransfer(
    sender: Address,
    recipient: Address,
    amount?: string
  ): Promise<{
    approved: boolean;
    senderResult: ScreeningResult;
    recipientResult: ScreeningResult;
    reason?: string;
  }> {
    const [senderResult, recipientResult] = await Promise.all([
      this.screenAddress({
        address: sender,
        context: { transactionType: 'SEND', amount },
      }),
      this.screenAddress({
        address: recipient,
        context: { transactionType: 'RECEIVE', amount },
      }),
    ]);

    const senderApproved =
      senderResult.status === 'APPROVED' || this.isWithinThreshold(senderResult.riskLevel);
    const recipientApproved =
      recipientResult.status === 'APPROVED' || this.isWithinThreshold(recipientResult.riskLevel);

    const approved = senderApproved && recipientApproved;

    let reason: string | undefined;
    if (!senderApproved) {
      reason = `Sender flagged: ${senderResult.flags.join(', ') || senderResult.riskLevel}`;
    } else if (!recipientApproved) {
      reason = `Recipient flagged: ${recipientResult.flags.join(', ') || recipientResult.riskLevel}`;
    }

    return {
      approved,
      senderResult,
      recipientResult,
      reason,
    };
  }

  /**
   * Check if risk level is within auto-approve threshold
   */
  private isWithinThreshold(riskLevel: RiskLevel): boolean {
    const levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];
    const thresholdIndex = levels.indexOf(this.autoApproveThreshold);
    const levelIndex = levels.indexOf(riskLevel);
    return levelIndex <= thresholdIndex;
  }

  /**
   * Make API request to Circle Compliance
   */
  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Circle Compliance API error: ${response.status} - ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Map API response to ScreeningResult
   */
  private mapScreeningResult(data: any): ScreeningResult {
    return {
      id: data.id,
      address: data.address as Address,
      status: data.status || 'PENDING',
      riskLevel: data.riskLevel || 'LOW',
      riskScore: data.riskScore || 0,
      flags: data.flags || [],
      details: data.details
        ? {
            sanctioned: data.details.sanctioned || false,
            pep: data.details.pep || false,
            adverseMedia: data.details.adverseMedia || false,
            categories: data.details.categories || [],
          }
        : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

/**
 * Create a Circle Compliance client with environment config
 */
export function createCircleCompliance(config?: Partial<ComplianceConfig>): CircleCompliance {
  const apiKey = config?.apiKey || process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY is required');
  }

  return new CircleCompliance({
    apiKey,
    sandbox: config?.sandbox ?? true,
    autoApproveThreshold: config?.autoApproveThreshold,
  });
}
