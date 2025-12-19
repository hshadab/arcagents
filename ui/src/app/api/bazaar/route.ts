import { NextResponse } from 'next/server';

const BAZAAR_API = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';

interface BazaarItem {
  resource: string;
  accepts: Array<{
    asset: string;
    description?: string;
    maxAmountRequired: string;
    network: string;
    payTo: string;
    outputSchema?: {
      input?: {
        displayName?: string;
        name?: string;
        description?: string;
      };
    };
  }>;
  metadata?: Record<string, unknown>;
}

interface UnifiedService {
  url: string;
  name: string;
  description?: string;
  price: string;
  priceAtomic: string;
  asset: string;
  network: string;
  payTo: string;
  source: 'bazaar';
  category?: string;
  metadata?: Record<string, unknown>;
}

function mapBazaarItem(item: BazaarItem): UnifiedService | null {
  try {
    const accept = item.accepts?.[0];
    if (!accept || !item.resource) return null;

    const priceAtomic = accept.maxAmountRequired || '0';
    const price = (parseInt(priceAtomic) / 1_000_000).toFixed(6);

    // Extract name from outputSchema or URL
    const urlPath = new URL(item.resource).pathname;
    const pathParts = urlPath.split('/').filter(Boolean);
    const lastName = pathParts[pathParts.length - 1] || 'service';
    const name = accept.outputSchema?.input?.displayName ||
                 accept.outputSchema?.input?.name ||
                 lastName.replace(/-/g, ' ').replace(/_/g, ' ');

    return {
      url: item.resource,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: accept.description || accept.outputSchema?.input?.description,
      price,
      priceAtomic,
      asset: 'USDC', // Bazaar uses USDC contract addresses
      network: 'base',
      payTo: accept.payTo,
      source: 'bazaar',
      category: inferCategory(item.resource, item.metadata),
      metadata: item.metadata,
    };
  } catch (e) {
    console.warn('Failed to map Bazaar item:', e);
    return null;
  }
}

function inferCategory(url: string, metadata?: Record<string, unknown>): string {
  if (metadata?.category) return metadata.category as string;

  const urlLower = url.toLowerCase();
  // Data services
  if (urlLower.includes('weather') || urlLower.includes('news') || urlLower.includes('signal') ||
      urlLower.includes('analysis') || urlLower.includes('recap') || urlLower.includes('score')) return 'data';
  // AI/ML services
  if (urlLower.includes('inference') || urlLower.includes('llm') || urlLower.includes('ai') ||
      urlLower.includes('gpt') || urlLower.includes('chat') || urlLower.includes('image') ||
      urlLower.includes('video') || urlLower.includes('sora')) return 'ai';
  // Compute
  if (urlLower.includes('compute') || urlLower.includes('gpu')) return 'compute';
  // Storage
  if (urlLower.includes('storage') || urlLower.includes('ipfs') || urlLower.includes('s3') ||
      urlLower.includes('download') || urlLower.includes('book')) return 'storage';
  // Oracle/DeFi
  if (urlLower.includes('oracle') || urlLower.includes('price') || urlLower.includes('pool') ||
      urlLower.includes('tvl') || urlLower.includes('apr') || urlLower.includes('defi')) return 'oracle';
  return 'api';
}

export async function GET() {
  try {
    const response = await fetch(BAZAAR_API, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn('Bazaar API returned status:', response.status);
      return NextResponse.json({
        resources: [],
        stats: { total: 0 },
      });
    }

    const data = await response.json();

    // Bazaar returns items array with resource and accepts fields
    const items = data.items || [];
    console.log(`Bazaar API returned ${items.length} items`);

    const services = items
      .map((item: BazaarItem) => mapBazaarItem(item))
      .filter((s: UnifiedService | null): s is UnifiedService => s !== null);

    console.log(`Mapped ${services.length} x402 services`);

    return NextResponse.json({
      resources: services,
      stats: { total: services.length },
    });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services', resources: [], stats: { total: 0 } },
      { status: 500 }
    );
  }
}
