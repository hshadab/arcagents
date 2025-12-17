/**
 * X402 Client - Helper for making paid HTTP requests to x402 services
 *
 * X402 is a payment protocol where services return 402 Payment Required
 * with payment details, and clients retry with payment proof in headers.
 */

export interface X402PaymentInfo {
  payTo: string;           // Recipient address
  amount: string;          // Amount in atomic units (6 decimals for USDC)
  asset: string;           // Asset type (e.g., "USDC")
  network: string;         // Network (e.g., "arc-testnet")
  validUntil?: number;     // Payment validity timestamp
}

export interface X402Response<T = unknown> {
  success: boolean;
  data?: T;
  paymentRequired?: X402PaymentInfo;
  error?: string;
  statusCode: number;
}

export interface X402ExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  paymentMade?: {
    amount: string;
    txHash?: string;
    recipient: string;
  };
  error?: string;
  durationMs: number;
}

/**
 * Parse 402 Payment Required response to extract payment info
 */
export function parsePaymentRequired(headers: Headers, body?: unknown): X402PaymentInfo | null {
  // Check for X-Payment header (common x402 format)
  const xPayment = headers.get('X-Payment');
  if (xPayment) {
    try {
      return JSON.parse(xPayment);
    } catch {
      // Continue to other methods
    }
  }

  // Check for WWW-Authenticate header with payment scheme
  const wwwAuth = headers.get('WWW-Authenticate');
  if (wwwAuth && wwwAuth.includes('X402')) {
    // Parse X402 realm="...", payTo="...", amount="..."
    const payTo = wwwAuth.match(/payTo="([^"]+)"/)?.[1];
    const amount = wwwAuth.match(/amount="([^"]+)"/)?.[1];
    const asset = wwwAuth.match(/asset="([^"]+)"/)?.[1];
    const network = wwwAuth.match(/network="([^"]+)"/)?.[1];

    if (payTo && amount) {
      return {
        payTo,
        amount,
        asset: asset || 'USDC',
        network: network || 'arc-testnet',
      };
    }
  }

  // Check response body for payment info
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (b.payTo && b.amount) {
      return {
        payTo: String(b.payTo),
        amount: String(b.amount),
        asset: String(b.asset || 'USDC'),
        network: String(b.network || 'arc-testnet'),
      };
    }
    // Nested payment object
    if (b.payment && typeof b.payment === 'object') {
      const p = b.payment as Record<string, unknown>;
      if (p.payTo && p.amount) {
        return {
          payTo: String(p.payTo),
          amount: String(p.amount),
          asset: String(p.asset || 'USDC'),
          network: String(p.network || 'arc-testnet'),
        };
      }
    }
  }

  return null;
}

/**
 * Make a request to an x402 service
 * Returns payment info if 402 is received, or data if successful
 */
export async function makeX402Request<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<X402Response<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    // Try to parse response body
    let body: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      try {
        const text = await response.text();
        // Try to parse as JSON anyway
        try {
          body = JSON.parse(text);
        } catch {
          body = { text };
        }
      } catch {
        body = null;
      }
    }

    // Handle 402 Payment Required
    if (response.status === 402) {
      const paymentInfo = parsePaymentRequired(response.headers, body);
      return {
        success: false,
        paymentRequired: paymentInfo || undefined,
        error: 'Payment required',
        statusCode: 402,
      };
    }

    // Handle success
    if (response.ok) {
      return {
        success: true,
        data: body as T,
        statusCode: response.status,
      };
    }

    // Handle other errors
    return {
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      statusCode: 0,
    };
  }
}

/**
 * Make a paid x402 request with payment header
 */
export async function makeX402PaidRequest<T = unknown>(
  url: string,
  paymentProof: {
    txHash: string;
    amount: string;
    payer: string;
  },
  options: RequestInit = {}
): Promise<X402Response<T>> {
  // Add payment proof to headers
  const paymentHeader = JSON.stringify({
    type: 'x402',
    txHash: paymentProof.txHash,
    amount: paymentProof.amount,
    payer: paymentProof.payer,
  });

  return makeX402Request<T>(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Payment-Proof': paymentHeader,
      'X-Payment': paymentHeader, // Some services use this header
    },
  });
}

/**
 * Format atomic amount to human readable
 */
export function formatAmount(atomicAmount: string, decimals: number = 6): string {
  const value = parseInt(atomicAmount) / Math.pow(10, decimals);
  return value.toFixed(decimals > 4 ? 2 : 4);
}

/**
 * Convert human readable amount to atomic
 */
export function toAtomicAmount(amount: string, decimals: number = 6): string {
  const value = parseFloat(amount) * Math.pow(10, decimals);
  return Math.floor(value).toString();
}
