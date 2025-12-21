/**
 * API Authentication utilities
 *
 * Provides optional API key authentication for server-to-server calls.
 * Client-side browser requests use wallet-based authentication.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * API key validation result
 */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
  apiKeyId?: string;
}

/**
 * Check if request has valid API key
 *
 * API keys can be provided via:
 * - X-API-Key header
 * - Authorization: Bearer <key> header
 *
 * If API_KEYS env var is not set, authentication is skipped (development mode)
 */
export function validateApiKey(request: NextRequest): AuthResult {
  const apiKeysEnv = process.env.API_KEYS;

  // No API keys configured = development mode, skip auth
  if (!apiKeysEnv) {
    return { authenticated: true, apiKeyId: 'dev-mode' };
  }

  // Parse configured API keys (comma-separated key:name pairs)
  const apiKeys = new Map<string, string>();
  try {
    apiKeysEnv.split(',').forEach(entry => {
      const [key, name] = entry.split(':');
      if (key && name) {
        apiKeys.set(key.trim(), name.trim());
      }
    });
  } catch {
    return { authenticated: false, error: 'Invalid API_KEYS configuration' };
  }

  // Check X-API-Key header
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey && apiKeys.has(xApiKey)) {
    return { authenticated: true, apiKeyId: apiKeys.get(xApiKey) };
  }

  // Check Authorization: Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (apiKeys.has(token)) {
      return { authenticated: true, apiKeyId: apiKeys.get(token) };
    }
  }

  // Check if request is from same origin (browser request)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigin = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3000';

  if (origin === allowedOrigin || referer?.startsWith(allowedOrigin)) {
    return { authenticated: true, apiKeyId: 'browser' };
  }

  return { authenticated: false, error: 'Invalid or missing API key' };
}

/**
 * Middleware helper to reject unauthenticated requests
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  const auth = validateApiKey(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Authenticated, continue processing
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'arc_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
