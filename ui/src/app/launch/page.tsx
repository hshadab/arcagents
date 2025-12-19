'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { LaunchForm } from '@/components/LaunchForm';
import type { X402Service, ServiceCategory } from '@arc-agent/sdk';

// Use the same API proxy as ServiceList for consistency
const BAZAAR_API = '/api/bazaar';

function mapCategory(cat: string | undefined): ServiceCategory {
  if (!cat) return 'api';
  const lower = cat.toLowerCase();
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('inference')) return 'ai';
  if (lower.includes('data')) return 'data';
  if (lower.includes('compute') || lower.includes('gpu')) return 'compute';
  if (lower.includes('storage') || lower.includes('ipfs')) return 'storage';
  if (lower.includes('oracle') || lower.includes('price')) return 'oracle';
  return 'api';
}

// Determine if service is an "action" type that requires ML decision-making
// Must match the logic in ServiceList.tsx
function getServiceType(url: string, description: string, category: ServiceCategory): 'action' | 'fetch' {
  const combined = `${url} ${description}`.toLowerCase();

  // Explicitly DATA services - never action (even if they contain action-like keywords)
  // These are just fetching data, not making decisions
  if (
    combined.includes('pool') ||
    combined.includes('tvl') ||
    combined.includes('apr') ||
    combined.includes('price') && !combined.includes('predict') ||
    combined.includes('news') ||
    combined.includes('weather') ||
    combined.includes('current') && !combined.includes('signal')
  ) {
    // Exception: if it explicitly has decision/analysis keywords, treat as action
    if (
      combined.includes('analyze') ||
      combined.includes('analysis') ||
      combined.includes('score') ||
      combined.includes('risk') ||
      combined.includes('decision') ||
      combined.includes('predict') ||
      combined.includes('recommend')
    ) {
      return 'action';
    }
    return 'fetch';
  }

  // Action services - require ML decision making
  if (
    combined.includes('signal') ||
    combined.includes('indicator') ||
    combined.includes('trading') ||
    combined.includes('arbitrage') ||
    combined.includes('score') ||
    combined.includes('risk') ||
    combined.includes('analyze') ||
    combined.includes('analysis') ||
    combined.includes('predict') ||
    combined.includes('forecast') ||
    combined.includes('recommend') ||
    combined.includes('decision') ||
    combined.includes('strategy') ||
    combined.includes('alert')
  ) {
    return 'action';
  }

  // Everything else is data fetching
  return 'fetch';
}

// Map service from API response (matches ServiceList mapping)
function mapServiceResponse(item: any): X402Service | null {
  try {
    const url = item.url || item.resource || '';
    if (!url) return null;

    const category = mapCategory(item.category);
    const description = item.description || '';
    const serviceType = getServiceType(url, description, category);

    return {
      url,
      name: item.name || 'Unknown Service',
      description,
      price: item.price || '0',
      priceAtomic: item.priceAtomic || '0',
      asset: item.asset || 'USDC',
      network: 'base',
      payTo: item.payTo || '0x0000000000000000000000000000000000000000',
      category,
      serviceType,
    };
  } catch {
    return null;
  }
}

function LaunchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceUrl = searchParams.get('service');
  const [selectedService, setSelectedService] = useState<X402Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Agents must be tied to a service - redirect if none provided
    if (!serviceUrl) {
      router.replace('/');
      return;
    }

    if (serviceUrl) {
      // Fetch service details from local API (same as ServiceList)
      const fetchService = async () => {
        try {
          const response = await fetch(BAZAAR_API);
          if (response.ok) {
            const data = await response.json();
            const items = data.resources || data.items || data.data || [];

            // Map items and find matching service
            const mapped = items
              .map(mapServiceResponse)
              .filter(Boolean) as X402Service[];

            // Find by exact URL match
            let found = mapped.find((s: X402Service) => s.url === serviceUrl);

            // If not found, try URL decoding in case of encoding mismatch
            if (!found) {
              const decodedUrl = decodeURIComponent(serviceUrl);
              found = mapped.find((s: X402Service) =>
                s.url === decodedUrl || decodeURIComponent(s.url) === decodedUrl
              );
            }

            if (found) {
              setSelectedService(found);
            } else {
              console.error('Service not found in Bazaar:', serviceUrl);
              // Create a minimal service object from the URL
              setSelectedService({
                url: serviceUrl,
                name: new URL(serviceUrl).pathname.split('/').pop() || 'Service',
                description: `x402 service at ${new URL(serviceUrl).hostname}`,
                price: '0.01',
                priceAtomic: '10000',
                asset: 'USDC',
                network: 'base',
                payTo: '0x0000000000000000000000000000000000000000',
                category: 'api',
              });
            }
          }
        } catch (err) {
          console.error('Failed to fetch service:', err);
          // Fallback: create service from URL
          try {
            setSelectedService({
              url: serviceUrl,
              name: new URL(serviceUrl).pathname.split('/').pop() || 'Service',
              description: `x402 service at ${new URL(serviceUrl).hostname}`,
              price: '0.01',
              priceAtomic: '10000',
              asset: 'USDC',
              network: 'base',
              payTo: '0x0000000000000000000000000000000000000000',
              category: 'api',
            });
          } catch {
            // Invalid URL
          }
        } finally {
          setLoading(false);
        }
      };
      fetchService();
    }
  }, [serviceUrl]);

  const handleSuccess = (agentId: string) => {
    console.log('Agent created:', agentId);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Services
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Launch Agent
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {selectedService
            ? `Create an agent to consume ${selectedService.name}`
            : 'Loading service details...'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
        </div>
      ) : (
        <LaunchForm selectedService={selectedService} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
      </div>
    }>
      <LaunchPageContent />
    </Suspense>
  );
}
