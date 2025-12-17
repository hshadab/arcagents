import type { X402Service, DiscoveryOptions, DiscoverySource } from '../types';
import { BazaarClient, bazaar } from './bazaar';
import { NexusClient, nexus } from './nexus';

export { BazaarClient, bazaar } from './bazaar';
export { NexusClient, nexus } from './nexus';

export interface UnifiedDiscoveryOptions extends DiscoveryOptions {
  /** Which sources to query (default: all) */
  sources?: DiscoverySource[];
  /** Whether to deduplicate by URL (default: true) */
  deduplicate?: boolean;
}

/**
 * Unified x402 service discovery client.
 *
 * Aggregates services from multiple discovery sources:
 * - Coinbase Bazaar (official x402 registry)
 * - Thirdweb Nexus (payment-gated API router)
 *
 * Services are deduplicated by URL, with Bazaar taking precedence.
 */
export class UnifiedDiscoveryClient {
  private bazaarClient: BazaarClient;
  private nexusClient: NexusClient;

  constructor(
    bazaarClient: BazaarClient = bazaar,
    nexusClient: NexusClient = nexus
  ) {
    this.bazaarClient = bazaarClient;
    this.nexusClient = nexusClient;
  }

  /**
   * List services from all configured sources
   */
  async listServices(options?: UnifiedDiscoveryOptions): Promise<X402Service[]> {
    const sources = options?.sources || ['bazaar', 'nexus'];
    const deduplicate = options?.deduplicate !== false;

    // Fetch from all sources in parallel
    const promises: Promise<X402Service[]>[] = [];

    if (sources.includes('bazaar')) {
      promises.push(
        this.bazaarClient.listServices(options).catch(err => {
          console.warn('Bazaar fetch failed:', err);
          return [];
        })
      );
    }

    if (sources.includes('nexus')) {
      promises.push(
        this.nexusClient.listServices(options).catch(err => {
          console.warn('Nexus fetch failed:', err);
          return [];
        })
      );
    }

    const results = await Promise.all(promises);
    let allServices = results.flat();

    // Deduplicate by URL (Bazaar takes precedence as the "official" source)
    if (deduplicate) {
      const seen = new Map<string, X402Service>();

      for (const service of allServices) {
        const normalizedUrl = this.normalizeUrl(service.url);

        if (!seen.has(normalizedUrl)) {
          seen.set(normalizedUrl, service);
        } else {
          // Keep Bazaar version if it exists
          const existing = seen.get(normalizedUrl)!;
          if (existing.source !== 'bazaar' && service.source === 'bazaar') {
            seen.set(normalizedUrl, service);
          }
        }
      }

      allServices = Array.from(seen.values());
    }

    // Apply limit after deduplication
    if (options?.limit && allServices.length > options.limit) {
      allServices = allServices.slice(0, options.limit);
    }

    return allServices;
  }

  /**
   * Search services across all sources
   */
  async searchServices(query: string, options?: Omit<UnifiedDiscoveryOptions, 'query'>): Promise<X402Service[]> {
    return this.listServices({ ...options, query });
  }

  /**
   * Get service by URL from any source
   */
  async getService(url: string): Promise<X402Service | null> {
    const services = await this.listServices();
    const normalizedUrl = this.normalizeUrl(url);
    return services.find(s => this.normalizeUrl(s.url) === normalizedUrl) || null;
  }

  /**
   * Get statistics about available services
   */
  async getStats(): Promise<DiscoveryStats> {
    const services = await this.listServices({ deduplicate: true });

    const bySource: Record<DiscoverySource, number> = {
      bazaar: 0,
      nexus: 0,
      probe: 0,
    };

    const byCategory: Record<string, number> = {};
    const byNetwork: Record<string, number> = {};

    for (const service of services) {
      // Count by source
      if (service.source) {
        bySource[service.source]++;
      }

      // Count by category
      const cat = service.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      // Count by network
      byNetwork[service.network] = (byNetwork[service.network] || 0) + 1;
    }

    return {
      total: services.length,
      bySource,
      byCategory,
      byNetwork,
    };
  }

  /**
   * Probe an endpoint directly (bypasses registries)
   */
  async probeEndpoint(url: string): Promise<X402Service | null> {
    return this.bazaarClient.probeEndpoint(url);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash and normalize
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}

export interface DiscoveryStats {
  total: number;
  bySource: Record<DiscoverySource, number>;
  byCategory: Record<string, number>;
  byNetwork: Record<string, number>;
}

// Export singleton instance
export const discovery = new UnifiedDiscoveryClient();
