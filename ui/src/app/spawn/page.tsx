'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SpawnForm } from '@/components/SpawnForm';
import type { X402Service, ServiceCategory } from '@arc-agent/sdk';

// Coinbase Bazaar API endpoint
const BAZAAR_API = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';

// Map Bazaar API response to our X402Service type
function mapBazaarResource(resource: any): X402Service {
  return {
    url: resource.url || resource.endpoint || '',
    name: resource.name || resource.title || 'Unknown Service',
    description: resource.description || '',
    price: resource.price?.amount || resource.pricing?.perRequest || '0',
    priceAtomic: resource.price?.atomicAmount || '0',
    asset: resource.price?.asset || resource.pricing?.asset || 'USDC',
    network: 'Arc Testnet',
    payTo: resource.payTo || resource.paymentAddress || '0x0000000000000000000000000000000000000000',
    category: mapCategory(resource.category || resource.type),
  };
}

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

function SpawnPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceUrl = searchParams.get('service');
  const [selectedService, setSelectedService] = useState<X402Service | null>(null);
  const [loading, setLoading] = useState(!!serviceUrl);

  useEffect(() => {
    if (serviceUrl) {
      // Fetch service details from Bazaar API
      const fetchService = async () => {
        try {
          const apiKey = process.env.NEXT_PUBLIC_CDP_API_KEY;
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (apiKey) headers['X-API-Key'] = apiKey;

          const response = await fetch(BAZAAR_API, { method: 'GET', headers });
          if (response.ok) {
            const data = await response.json();
            const resources = data.resources || data.data || [];
            const mapped = resources.map(mapBazaarResource);
            const found = mapped.find((s: X402Service) => s.url === serviceUrl);
            setSelectedService(found || null);
          }
        } catch (err) {
          console.error('Failed to fetch service:', err);
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
          Spawn an Agent
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {selectedService
            ? `Create an agent to interact with ${selectedService.name}`
            : 'Create a new Arc Agents instance with x402 payment capabilities'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
        </div>
      ) : (
        <SpawnForm selectedService={selectedService} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

export default function SpawnPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
      </div>
    }>
      <SpawnPageContent />
    </Suspense>
  );
}
