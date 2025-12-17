/**
 * Circle Compliance Engine Client
 *
 * Integrates with Circle's Compliance Engine API for address screening.
 * https://developers.circle.com/w3s/compliance-engine
 */

export type RiskCategory =
  | 'SANCTIONS'
  | 'CSAM'
  | 'ILLICIT_BEHAVIOR'
  | 'GAMBLING'
  | 'TERRORIST_FINANCING'
  | 'UNSUPPORTED'
  | 'FROZEN'
  | 'OTHER'
  | 'HIGH_RISK_INDUSTRY'
  | 'PEP'
  | 'TRUSTED'
  | 'HACKING'
  | 'HUMAN_TRAFFICKING'
  | 'SPECIAL_MEASURES';

export type ScreeningResult = 'APPROVED' | 'DENIED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export interface RiskSignal {
  category: RiskCategory;
  riskLevel: RiskLevel;
  description?: string;
}

export interface ScreeningResponse {
  id: string;
  address: string;
  chain: string;
  result: ScreeningResult;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  matchedRule?: string;
  action?: string;
  screenedAt: string;
}

export interface CircleComplianceConfig {
  apiKey: string;
  baseUrl?: string;
  entitySecretCiphertext?: string;
}

/**
 * Circle Compliance Engine client for address screening
 */
export class CircleComplianceClient {
  private apiKey: string;
  private baseUrl: string;
  private entitySecretCiphertext?: string;

  constructor(config: CircleComplianceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.circle.com';
    this.entitySecretCiphertext = config.entitySecretCiphertext;
  }

  /**
   * Screen a blockchain address for compliance risks
   */
  async screenAddress(
    address: string,
    chain: string = 'ETH'
  ): Promise<ScreeningResponse> {
    const url = `${this.baseUrl}/v1/w3s/compliance/screening/addresses`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(this.entitySecretCiphertext && {
          'X-Entity-Secret': this.entitySecretCiphertext,
        }),
      },
      body: JSON.stringify({
        address,
        chain,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Circle Compliance API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return this.parseScreeningResponse(data, address, chain);
  }

  /**
   * Parse Circle API response into our ScreeningResponse format
   */
  private parseScreeningResponse(
    data: unknown,
    address: string,
    chain: string
  ): ScreeningResponse {
    // Circle API response structure may vary - adapt as needed
    const responseData = data as { data?: Record<string, unknown> } | undefined;
    const result = responseData?.data;

    return {
      id: (result?.id as string) || crypto.randomUUID(),
      address,
      chain,
      result: (result?.decision as ScreeningResult) || 'APPROVED',
      riskLevel: this.calculateRiskLevel(result?.signals as RiskSignal[] | undefined),
      signals: (result?.signals as RiskSignal[]) || [],
      matchedRule: result?.matchedRule as string | undefined,
      action: result?.action as string | undefined,
      screenedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate overall risk level from signals
   */
  private calculateRiskLevel(signals?: RiskSignal[]): RiskLevel {
    if (!signals || signals.length === 0) return 'LOW';

    const severityOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];
    let maxSeverity: RiskLevel = 'LOW';

    for (const signal of signals) {
      if (severityOrder.indexOf(signal.riskLevel) > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = signal.riskLevel;
      }
    }

    return maxSeverity;
  }

  /**
   * Check if screening result indicates address is compliant
   */
  isCompliant(response: ScreeningResponse): boolean {
    return response.result === 'APPROVED';
  }

  /**
   * Map risk level to on-chain compliance status
   * Status values match IArcTreasury.ComplianceStatus enum
   */
  toComplianceStatus(response: ScreeningResponse): number {
    if (response.result === 'DENIED') {
      return 3; // REJECTED
    }

    switch (response.riskLevel) {
      case 'SEVERE':
      case 'HIGH':
        return 3; // REJECTED
      case 'MEDIUM':
        return 1; // PENDING (needs review)
      case 'LOW':
      default:
        return 2; // APPROVED
    }
  }
}

/**
 * Create a mock compliance client for testing
 * Uses Circle's "magic values" for deterministic test results
 */
export class MockCircleComplianceClient extends CircleComplianceClient {
  constructor() {
    super({ apiKey: 'mock' });
  }

  async screenAddress(address: string, chain: string = 'ETH'): Promise<ScreeningResponse> {
    // Circle magic values for testing:
    // - Address ending in 9999: Sanctioned
    // - Address ending in 8888: High risk
    // - Address ending in 7777: Medium risk
    // - Others: Approved

    const suffix = address.slice(-4).toLowerCase();
    let result: ScreeningResult = 'APPROVED';
    let riskLevel: RiskLevel = 'LOW';
    const signals: RiskSignal[] = [];

    if (suffix === '9999') {
      result = 'DENIED';
      riskLevel = 'SEVERE';
      signals.push({
        category: 'SANCTIONS',
        riskLevel: 'SEVERE',
        description: 'Address matches OFAC sanctions list',
      });
    } else if (suffix === '8888') {
      result = 'DENIED';
      riskLevel = 'HIGH';
      signals.push({
        category: 'ILLICIT_BEHAVIOR',
        riskLevel: 'HIGH',
        description: 'Address associated with illicit activity',
      });
    } else if (suffix === '7777') {
      result = 'APPROVED';
      riskLevel = 'MEDIUM';
      signals.push({
        category: 'HIGH_RISK_INDUSTRY',
        riskLevel: 'MEDIUM',
        description: 'Address associated with high-risk industry',
      });
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      id: crypto.randomUUID(),
      address,
      chain,
      result,
      riskLevel,
      signals,
      matchedRule: signals.length > 0 ? signals[0].category : undefined,
      screenedAt: new Date().toISOString(),
    };
  }
}
