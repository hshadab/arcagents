import type { X402Service, DiscoveryOptions, ServiceCategory } from '../types';

const BAZAAR_API_BASE = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery';

interface BazaarResource {
  url: string;
  name?: string;
  description?: string;
  acceptedAsset: string;
  network: string;
  payTo: string;
  maxAmountRequired: string;
  metadata?: Record<string, unknown>;
}

interface BazaarResponse {
  resources: BazaarResource[];
  nextPageToken?: string;
}

/**
 * x402 Bazaar client for discovering machine-payable services.
 *
 * Bazaar is Coinbase's discovery layer for x402-enabled endpoints.
 * Agents can query available services, filter by criteria, and get
 * payment requirements without manual configuration.
 */
export class BazaarClient {
  private apiBase: string;

  constructor(apiBase: string = BAZAAR_API_BASE) {
    this.apiBase = apiBase;
  }

  /**
   * List all available x402 services from Bazaar
   */
  async listServices(options?: DiscoveryOptions): Promise<X402Service[]> {
    const url = new URL(`${this.apiBase}/resources`);

    if (options?.network) {
      url.searchParams.set('network', options.network);
    }
    if (options?.limit) {
      url.searchParams.set('limit', String(options.limit));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Bazaar API error: ${response.status} ${response.statusText}`);
    }

    const data: BazaarResponse = await response.json();
    let services = data.resources.map(this.mapBazaarResource);

    // Apply client-side filters
    if (options?.category) {
      services = services.filter(s => s.category === options.category);
    }
    if (options?.maxPrice) {
      const maxPriceNum = parseFloat(options.maxPrice);
      services = services.filter(s => parseFloat(s.price) <= maxPriceNum);
    }
    if (options?.query) {
      const query = options.query.toLowerCase();
      services = services.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.url.toLowerCase().includes(query)
      );
    }

    return services;
  }

  /**
   * Get details for a specific service by URL
   */
  async getService(serviceUrl: string): Promise<X402Service | null> {
    const services = await this.listServices();
    return services.find(s => s.url === serviceUrl) || null;
  }

  /**
   * Search services by query string
   */
  async searchServices(query: string, options?: Omit<DiscoveryOptions, 'query'>): Promise<X402Service[]> {
    return this.listServices({ ...options, query });
  }

  /**
   * Get services by category
   */
  async getServicesByCategory(category: ServiceCategory, options?: Omit<DiscoveryOptions, 'category'>): Promise<X402Service[]> {
    return this.listServices({ ...options, category });
  }

  /**
   * Probe an endpoint to check if it supports x402 payments
   */
  async probeEndpoint(url: string): Promise<X402Service | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 402) {
        const paymentRequired = response.headers.get('payment-required')
          || response.headers.get('x-payment-required');

        if (paymentRequired) {
          const decoded = JSON.parse(atob(paymentRequired));
          return this.mapPaymentRequired(url, decoded);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapBazaarResource(resource: BazaarResource): X402Service {
    const priceAtomic = resource.maxAmountRequired;
    // Convert from atomic units (6 decimals for USDC)
    const price = (parseInt(priceAtomic) / 1_000_000).toFixed(6);

    return {
      url: resource.url,
      name: resource.name || new URL(resource.url).hostname,
      description: resource.description,
      price,
      priceAtomic,
      asset: resource.acceptedAsset,
      network: resource.network,
      payTo: resource.payTo as `0x${string}`,
      source: 'bazaar',
      category: inferCategory(resource.url, resource.metadata),
      metadata: resource.metadata,
    };
  }

  private mapPaymentRequired(url: string, requirement: Record<string, unknown>): X402Service {
    const priceAtomic = String(requirement.maxAmount || requirement.amount || '0');
    const price = (parseInt(priceAtomic) / 1_000_000).toFixed(6);

    return {
      url,
      name: new URL(url).hostname,
      price,
      priceAtomic,
      asset: String(requirement.asset || 'USDC'),
      network: String(requirement.network || 'base'),
      payTo: requirement.payTo as `0x${string}`,
      source: 'probe',
      category: 'other',
    };
  }
}

function inferCategory(url: string, metadata?: Record<string, unknown>): ServiceCategory {
  const urlLower = url.toLowerCase();

  if (metadata?.category) {
    return metadata.category as ServiceCategory;
  }

  if (urlLower.includes('weather') || urlLower.includes('data') || urlLower.includes('market')) {
    return 'data';
  }
  if (urlLower.includes('inference') || urlLower.includes('llm') || urlLower.includes('ai') || urlLower.includes('gpt')) {
    return 'ai';
  }
  if (urlLower.includes('compute') || urlLower.includes('gpu')) {
    return 'compute';
  }
  if (urlLower.includes('storage') || urlLower.includes('ipfs') || urlLower.includes('s3')) {
    return 'storage';
  }
  if (urlLower.includes('oracle') || urlLower.includes('price')) {
    return 'oracle';
  }

  return 'api';
}

// Export singleton instance
export const bazaar = new BazaarClient();
