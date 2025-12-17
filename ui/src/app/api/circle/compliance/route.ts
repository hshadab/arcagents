import { NextRequest, NextResponse } from 'next/server';

const CIRCLE_API_BASE = 'https://api-sandbox.circle.com';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
type ScreeningStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'REVIEW_REQUIRED';

interface ScreeningResult {
  id: string;
  address: string;
  status: ScreeningStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  flags: string[];
  createdAt: string;
  mock?: boolean;
}

/**
 * POST /api/circle/compliance
 * Screen an address for compliance
 */
export async function POST(request: NextRequest) {
  try {
    const { address, context } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    const apiKey = process.env.CIRCLE_API_KEY;

    // If no API key, return mock screening result
    if (!apiKey) {
      const mockResult = generateMockScreening(address);
      return NextResponse.json({ result: mockResult });
    }

    // Real Circle Compliance API call
    const response = await fetch(`${CIRCLE_API_BASE}/v1/compliance/screening`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        idempotencyKey: `screen-${address}-${Date.now()}`,
        address,
        chain: 'ARC',
        context,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // If compliance API not available, return mock
      if (response.status === 404 || response.status === 501) {
        const mockResult = generateMockScreening(address);
        return NextResponse.json({ result: mockResult });
      }
      throw new Error(error.message || `Circle API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ result: data.data });
  } catch (error) {
    console.error('Failed to screen address:', error);
    // Return mock on error for demo purposes
    const address = 'unknown';
    const mockResult = generateMockScreening(address);
    return NextResponse.json({ result: mockResult, error: 'Using mock data' });
  }
}

/**
 * POST /api/circle/compliance/validate-transfer
 * Validate both sender and recipient for a transfer
 */
export async function PUT(request: NextRequest) {
  try {
    const { sender, recipient, amount } = await request.json();

    if (!sender || !recipient) {
      return NextResponse.json(
        { error: 'sender and recipient are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CIRCLE_API_KEY;

    // Mock mode
    if (!apiKey) {
      const senderResult = generateMockScreening(sender);
      const recipientResult = generateMockScreening(recipient);

      const approved = senderResult.status === 'APPROVED' && recipientResult.status === 'APPROVED';

      return NextResponse.json({
        approved,
        senderResult,
        recipientResult,
        mock: true,
      });
    }

    // Real screening for both parties
    const [senderResponse, recipientResponse] = await Promise.all([
      screenAddress(apiKey, sender, { transactionType: 'SEND', amount }),
      screenAddress(apiKey, recipient, { transactionType: 'RECEIVE', amount }),
    ]);

    const approved =
      senderResponse.status === 'APPROVED' && recipientResponse.status === 'APPROVED';

    let reason: string | undefined;
    if (!approved) {
      if (senderResponse.status !== 'APPROVED') {
        reason = `Sender flagged: ${senderResponse.flags.join(', ') || senderResponse.riskLevel}`;
      } else {
        reason = `Recipient flagged: ${recipientResponse.flags.join(', ') || recipientResponse.riskLevel}`;
      }
    }

    return NextResponse.json({
      approved,
      senderResult: senderResponse,
      recipientResult: recipientResponse,
      reason,
    });
  } catch (error) {
    console.error('Failed to validate transfer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate transfer' },
      { status: 500 }
    );
  }
}

async function screenAddress(
  apiKey: string,
  address: string,
  context?: { transactionType?: string; amount?: string }
): Promise<ScreeningResult> {
  const response = await fetch(`${CIRCLE_API_BASE}/v1/compliance/screening`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      idempotencyKey: `screen-${address}-${Date.now()}`,
      address,
      chain: 'ARC',
      context,
    }),
  });

  if (!response.ok) {
    // Return mock on API error
    return generateMockScreening(address);
  }

  const data = await response.json();
  return data.data;
}

function generateMockScreening(address: string): ScreeningResult {
  // Deterministic mock based on address
  const hash = address.toLowerCase().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const riskScore = hash % 100;

  let riskLevel: RiskLevel;
  let status: ScreeningStatus;
  let flags: string[] = [];

  if (riskScore < 20) {
    riskLevel = 'LOW';
    status = 'APPROVED';
  } else if (riskScore < 50) {
    riskLevel = 'LOW';
    status = 'APPROVED';
  } else if (riskScore < 80) {
    riskLevel = 'MEDIUM';
    status = 'APPROVED';
    flags = ['New address'];
  } else if (riskScore < 95) {
    riskLevel = 'HIGH';
    status = 'REVIEW_REQUIRED';
    flags = ['High volume', 'Multiple chains'];
  } else {
    riskLevel = 'SEVERE';
    status = 'DENIED';
    flags = ['Sanctioned entity'];
  }

  return {
    id: `mock-screening-${Date.now()}`,
    address,
    status,
    riskLevel,
    riskScore,
    flags,
    createdAt: new Date().toISOString(),
    mock: true,
  };
}
