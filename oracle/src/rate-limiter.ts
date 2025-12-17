/**
 * @fileoverview Rate limiter for Arc Compliance Oracle Service
 * Implements token bucket algorithm for rate limiting requests
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for identification */
  keyPrefix?: string;
}

/**
 * Rate limit entry for tracking request counts
 */
interface RateLimitEntry {
  /** Number of requests made in current window */
  count: number;
  /** Timestamp when window started */
  windowStart: number;
}

/**
 * Token bucket rate limiter
 *
 * Implements a sliding window rate limiter to prevent abuse
 * of the oracle service.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000, // 1 minute
 * });
 *
 * if (limiter.isAllowed('address-screening')) {
 *   // Proceed with request
 * } else {
 *   // Rate limited - wait or reject
 * }
 * ```
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      keyPrefix: config.keyPrefix || 'rate-limit',
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Check if a request is allowed for the given key
   * @param key - Unique identifier for the rate limit (e.g., IP, address, action type)
   * @returns Whether the request is allowed
   */
  isAllowed(key: string): boolean {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const entry = this.entries.get(fullKey);

    if (!entry) {
      // First request for this key
      this.entries.set(fullKey, { count: 1, windowStart: now });
      return true;
    }

    // Check if window has expired
    if (now - entry.windowStart >= this.config.windowMs) {
      // Reset window
      this.entries.set(fullKey, { count: 1, windowStart: now });
      return true;
    }

    // Check if under limit
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  /**
   * Consume a token and check if allowed
   * Same as isAllowed but with explicit naming
   * @param key - Unique identifier for the rate limit
   * @returns Whether the request is allowed
   */
  tryConsume(key: string): boolean {
    return this.isAllowed(key);
  }

  /**
   * Get remaining requests for a key
   * @param key - Unique identifier for the rate limit
   * @returns Number of remaining requests in current window
   */
  getRemainingRequests(key: string): number {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const entry = this.entries.get(fullKey);

    if (!entry) {
      return this.config.maxRequests;
    }

    // Check if window has expired
    if (now - entry.windowStart >= this.config.windowMs) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets for a key
   * @param key - Unique identifier for the rate limit
   * @returns Milliseconds until reset, or 0 if not rate limited
   */
  getResetTime(key: string): number {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const entry = this.entries.get(fullKey);

    if (!entry) {
      return 0;
    }

    const windowEnd = entry.windowStart + this.config.windowMs;
    const timeUntilReset = windowEnd - now;

    return Math.max(0, timeUntilReset);
  }

  /**
   * Reset rate limit for a specific key
   * @param key - Unique identifier for the rate limit
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    this.entries.delete(fullKey);
  }

  /**
   * Clear all rate limit entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    // Don't prevent Node.js from exiting
    this.cleanupInterval.unref?.();
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart >= this.config.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.entries.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[RateLimiter] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }
}

/**
 * Create a rate limiter with default Oracle settings
 * @param overrides - Optional config overrides
 * @returns Configured RateLimiter instance
 */
export function createOracleRateLimiter(
  overrides?: Partial<RateLimiterConfig>
): RateLimiter {
  return new RateLimiter({
    // Default: 60 requests per minute per key
    maxRequests: 60,
    windowMs: 60000,
    keyPrefix: 'oracle',
    ...overrides,
  });
}

/**
 * Rate limiter for address screening requests
 * More restrictive than general rate limiting
 */
export function createScreeningRateLimiter(
  overrides?: Partial<RateLimiterConfig>
): RateLimiter {
  return new RateLimiter({
    // Default: 30 screening requests per minute
    maxRequests: 30,
    windowMs: 60000,
    keyPrefix: 'screening',
    ...overrides,
  });
}
