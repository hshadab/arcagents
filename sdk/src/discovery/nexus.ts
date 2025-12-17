import type { X402Service, DiscoveryOptions, ServiceCategory } from '../types';

const NEXUS_API_BASE = 'https://nexus.thirdweb.com';

interface NexusEndpoint {
  url: string;
  name?: string;
  description?: string;
  price: string;
  asset: string;
  network: string;
  payTo: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

interface NexusListResponse {
  endpoints: NexusEndpoint[];
  total?: number;
}

interface NexusSupportedResponse {
  chains: string[];
  tokens: string[];
}

/**
 * Thirdweb Nexus client for discovering x402 services.
 *
 * Nexus is a payment-gated API router that provides discovery
 * and reputation for x402-enabled services.
 */
export class NexusClient {
  private apiBase: string;

  constructor(apiBase: string = NEXUS_API_BASE) {
    this.apiBase = apiBase;
  }

  /**
   * List all available x402 services from Nexus
   */
  async listServices(options?: DiscoveryOptions): Promise<X402Service[]> {
    try {
      const response = await fetch(`${this.apiBase}/list`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Nexus may not be available or may require auth
        console.warn(`Nexus API returned ${response.status}, falling back to empty list`);
        return [];
      }

      const data: NexusListResponse = await response.json();
      let services = (data.endpoints || []).map(this.mapNexusEndpoint);

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
      if (options?.network) {
        services = services.filter(s =>
          s.network.toLowerCase() === options.network!.toLowerCase()
        );
      }
      if (options?.limit) {
        services = services.slice(0, options.limit);
      }

      return services;
    } catch (error) {
      console.warn('Failed to fetch from Nexus:', error);
      return [];
    }
  }

  /**
   * Get supported chains and tokens from Nexus
   */
  async getSupportedNetworks(): Promise<NexusSupportedResponse> {
    try {
      const response = await fetch(`${this.apiBase}/supported`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return { chains: [], tokens: [] };
      }

      return await response.json();
    } catch {
      return { chains: [], tokens: [] };
    }
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

  private mapNexusEndpoint(endpoint: NexusEndpoint): X402Service {
    // Nexus may return price in different formats
    let price = endpoint.price || '0';
    let priceAtomic = '0';

    // If price looks like atomic units (large number), convert
    if (parseInt(price) > 1000) {
      priceAtomic = price;
      price = (parseInt(price) / 1_000_000).toFixed(6);
    } else {
      // Price is already in USDC
      priceAtomic = String(Math.round(parseFloat(price) * 1_000_000));
    }

    return {
      url: endpoint.url,
      name: endpoint.name || new URL(endpoint.url).hostname,
      description: endpoint.description,
      price,
      priceAtomic,
      asset: endpoint.asset || 'USDC',
      network: endpoint.network || 'base',
      payTo: endpoint.payTo as `0x${string}`,
      source: 'nexus',
      category: inferCategory(endpoint.url, endpoint.category, endpoint.metadata),
      metadata: endpoint.metadata,
    };
  }
}

function inferCategory(url: string, explicitCategory?: string, metadata?: Record<string, unknown>): ServiceCategory {
  if (explicitCategory) {
    const normalized = explicitCategory.toLowerCase();
    if (['data', 'compute', 'ai', 'storage', 'oracle', 'api', 'other'].includes(normalized)) {
      return normalized as ServiceCategory;
    }
  }

  if (metadata?.category) {
    return metadata.category as ServiceCategory;
  }

  const urlLower = url.toLowerCase();

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
export const nexus = new NexusClient();
