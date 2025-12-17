'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import type { X402Service, ServiceCategory } from '@arc-agent/sdk';

interface ServiceListProps {
  onSpawn?: (service: X402Service) => void;
}

const categories: { value: ServiceCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'data', label: 'Data' },
  { value: 'ai', label: 'AI/ML' },
  { value: 'compute', label: 'Compute' },
  { value: 'storage', label: 'Storage' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'api', label: 'API' },
];

// Use local API proxy to avoid CORS issues
const BAZAAR_API = '/api/bazaar';

// Determine if zkML is recommended and which proof type
function getZkmlRecommendation(url: string, description: string, category: ServiceCategory): {
  recommended: boolean;
  proofType?: 'authorization' | 'compliance';
} {
  const combined = `${url} ${description}`.toLowerCase();

  // Trading signals, indicators, DeFi data → authorization proofs (financial decisions)
  if (
    combined.includes('signal') ||
    combined.includes('indicator') ||
    combined.includes('trading') ||
    combined.includes('pool') ||
    combined.includes('tvl') ||
    combined.includes('apr') ||
    combined.includes('defi') ||
    combined.includes('price') ||
    combined.includes('arbitrage') ||
    combined.includes('funding rate')
  ) {
    return { recommended: true, proofType: 'authorization' };
  }

  // Token analysis, security scores, research → compliance proofs (risk assessment)
  if (
    combined.includes('analysis') ||
    combined.includes('analyze') ||
    combined.includes('research') ||
    combined.includes('security') ||
    combined.includes('score') ||
    combined.includes('risk') ||
    combined.includes('scam') ||
    combined.includes('audit') ||
    combined.includes('token')
  ) {
    return { recommended: true, proofType: 'compliance' };
  }

  // News and market data → authorization proofs (decision-making data)
  if (
    combined.includes('news') ||
    combined.includes('recap') ||
    combined.includes('market') ||
    combined.includes('sentiment')
  ) {
    return { recommended: true, proofType: 'authorization' };
  }

  // Oracle category services → authorization
  if (category === 'oracle' || category === 'data') {
    return { recommended: true, proofType: 'authorization' };
  }

  return { recommended: false };
}

// Map Bazaar API response to our X402Service type
function mapBazaarResource(item: any): X402Service | null {
  try {
    // The Bazaar API returns items with 'resource' (URL) and 'accepts' array
    const url = item.resource || item.url || '';
    if (!url) return null;

    // Get the first payment option from accepts array
    const accept = item.accepts?.[0] || {};

    // Extract price from maxAmountRequired (in atomic units, 6 decimals for USDC)
    const atomicAmount = accept.maxAmountRequired || accept.amount || '0';
    const priceUsd = (parseInt(atomicAmount) / 1_000_000).toFixed(atomicAmount.length > 4 ? 2 : 4);

    // Extract name from URL or outputSchema
    const urlPath = new URL(url).pathname;
    const pathParts = urlPath.split('/').filter(Boolean);
    const lastName = pathParts[pathParts.length - 1] || 'service';
    const displayName = accept.outputSchema?.input?.displayName ||
                       accept.outputSchema?.input?.name ||
                       item.metadata?.serviceName ||
                       lastName.replace(/-/g, ' ').replace(/_/g, ' ');

    // Extract description
    const description = accept.description ||
                       accept.outputSchema?.input?.description ||
                       `x402 service at ${new URL(url).hostname}`;

    // Better category detection by combining URL, description, and any tags
    const categoryHint = [
      url,
      description,
      displayName,
      ...(item.metadata?.tags || []),
      item.metadata?.category || '',
    ].join(' ');

    const category = mapCategory(categoryHint);

    // Check if zkML is recommended for this service
    const zkmlRec = getZkmlRecommendation(url, description, category);

    return {
      url,
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      description,
      price: priceUsd,
      priceAtomic: atomicAmount,
      asset: 'USDC',
      network: accept.network || 'base',
      payTo: accept.payTo || '0x0000000000000000000000000000000000000000',
      category,
      zkmlRecommended: zkmlRec.recommended,
      zkmlProofType: zkmlRec.proofType,
      metadata: item.metadata,
    };
  } catch (e) {
    console.error('Failed to map resource:', e, item);
    return null;
  }
}

function mapCategory(input: string | undefined): ServiceCategory {
  if (!input) return 'api';
  const lower = input.toLowerCase();

  // AI/ML related
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('inference') ||
      lower.includes('llm') || lower.includes('chat') || lower.includes('gpt') ||
      lower.includes('claude') || lower.includes('sora') || lower.includes('image') ||
      lower.includes('video') || lower.includes('generate')) return 'ai';

  // Data services
  if (lower.includes('data') || lower.includes('news') || lower.includes('signal') ||
      lower.includes('analysis') || lower.includes('research') || lower.includes('indicator') ||
      lower.includes('recap') || lower.includes('score')) return 'data';

  // Compute services
  if (lower.includes('compute') || lower.includes('gpu') || lower.includes('process')) return 'compute';

  // Storage
  if (lower.includes('storage') || lower.includes('ipfs') || lower.includes('file') ||
      lower.includes('download') || lower.includes('book')) return 'storage';

  // Oracle/price feeds
  if (lower.includes('oracle') || lower.includes('price') || lower.includes('pool') ||
      lower.includes('tvl') || lower.includes('apr') || lower.includes('defi')) return 'oracle';

  return 'api';
}

// Map unified service response (from new API that includes source)
function mapUnifiedService(item: any): X402Service | null {
  try {
    const url = item.url || '';
    if (!url) return null;

    const category = mapCategory(item.category || item.url);
    const zkmlRec = getZkmlRecommendation(url, item.description || '', category);

    return {
      url,
      name: item.name || new URL(url).hostname,
      description: item.description,
      price: item.price || '0',
      priceAtomic: item.priceAtomic || '0',
      asset: item.asset || 'USDC',
      network: item.network || 'base',
      payTo: item.payTo || '0x0000000000000000000000000000000000000000',
      category,
      zkmlRecommended: zkmlRec.recommended,
      zkmlProofType: zkmlRec.proofType,
      metadata: item.metadata,
    };
  } catch (e) {
    console.error('Failed to map unified service:', e, item);
    return null;
  }
}

export function ServiceList({ onSpawn }: ServiceListProps) {
  const [services, setServices] = useState<X402Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategory | 'all'>('all');

  const fetchServices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(BAZAAR_API);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Handle unified API response format
      const items = data.resources || data.items || data.data || [];

      // Map items - check if already in unified format (has 'source' field) or needs mapping
      const mapped = items.map((item: any) => {
        if (item.source) {
          // Already in unified format from new API
          return mapUnifiedService(item);
        }
        // Legacy format, map from Bazaar
        return mapBazaarResource(item);
      }).filter(Boolean) as X402Service[];

      console.log(`Loaded ${mapped.length} x402 services`);
      setServices(mapped);
    } catch (err) {
      console.error('Failed to fetch x402 services:', err);
      setError('Unable to load x402 services. Showing example services.');

      // Fallback to example services
      setServices([
        {
          url: 'https://x402.org/demo/weather',
          name: 'Weather API',
          description: 'Real-time weather data - x402 demo service',
          price: '0.001',
          priceAtomic: '1000',
          asset: 'USDC',
          network: 'base-sepolia',
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          category: 'data',
        },
        {
          url: 'https://x402.org/demo/llm',
          name: 'LLM Inference',
          description: 'AI text generation - x402 demo service',
          price: '0.01',
          priceAtomic: '10000',
          asset: 'USDC',
          network: 'base-sepolia',
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          category: 'ai',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      !search ||
      service.name.toLowerCase().includes(search.toLowerCase()) ||
      service.description?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === 'all' || service.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={fetchServices}
            className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-arc-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  category === cat.value
                    ? 'bg-arc-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Service Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading x402 services...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            No services found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.url}
              service={service}
              onSpawn={onSpawn}
            />
          ))}
        </div>
      )}

      {/* Service Count */}
      {!loading && services.length > 0 && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">
          Showing {filteredServices.length} of {services.length} x402 services
        </p>
      )}
    </div>
  );
}
