import { NextRequest, NextResponse } from 'next/server';

const CIRCLE_API_BASE = 'https://api-sandbox.circle.com';

/**
 * POST /api/circle/wallet
 * Create a Circle Programmable Wallet for an agent
 */
export async function POST(request: NextRequest) {
  try {
    const { agentId, name } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const apiKey = process.env.CIRCLE_API_KEY;

    // If no API key, return mock wallet
    if (!apiKey) {
      const mockWallet = {
        id: `mock-wallet-${Date.now()}`,
        address: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
        blockchain: 'ARC-TESTNET',
        status: 'LIVE',
        name: name || `agent-${agentId}`,
        refId: agentId,
        createDate: new Date().toISOString(),
        mock: true,
      };
      return NextResponse.json({ wallet: mockWallet });
    }

    // Real Circle API call
    // First, get or create wallet set
    const walletSetId = await getOrCreateWalletSet(apiKey);

    const response = await fetch(`${CIRCLE_API_BASE}/v1/w3s/developer/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        idempotencyKey: `agent-wallet-${agentId}-${Date.now()}`,
        walletSetId,
        blockchains: ['ARC-TESTNET'],
        count: 1,
        metadata: [{ name: name || `agent-${agentId}`, refId: agentId }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Circle API error: ${response.status}`);
    }

    const data = await response.json();
    const wallet = data.data?.wallets?.[0];

    return NextResponse.json({ wallet });
  } catch (error) {
    console.error('Failed to create wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create wallet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circle/wallet?agentId=xxx
 * Get wallet for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const apiKey = process.env.CIRCLE_API_KEY;

    // If no API key, return mock
    if (!apiKey) {
      return NextResponse.json({ wallet: null, mock: true });
    }

    const response = await fetch(`${CIRCLE_API_BASE}/v1/w3s/wallets?refId=${agentId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Circle API error: ${response.status}`);
    }

    const data = await response.json();
    const wallet = data.data?.wallets?.[0] || null;

    return NextResponse.json({ wallet });
  } catch (error) {
    console.error('Failed to get wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get wallet' },
      { status: 500 }
    );
  }
}

async function getOrCreateWalletSet(apiKey: string): Promise<string> {
  const name = 'arc-agents';

  // Try to find existing
  const listResponse = await fetch(`${CIRCLE_API_BASE}/v1/w3s/developer/walletSets`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (listResponse.ok) {
    const data = await listResponse.json();
    const existing = data.data?.walletSets?.find((s: any) => s.name === name);
    if (existing) return existing.id;
  }

  // Create new
  const createResponse = await fetch(`${CIRCLE_API_BASE}/v1/w3s/developer/walletSets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      idempotencyKey: `wallet-set-${name}-${Date.now()}`,
      name,
    }),
  });

  if (!createResponse.ok) {
    throw new Error('Failed to create wallet set');
  }

  const data = await createResponse.json();
  return data.data?.walletSet?.id;
}
