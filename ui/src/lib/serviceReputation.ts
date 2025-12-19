/**
 * Service Reputation Tracking
 *
 * Tracks success/failure rate per service URL.
 * Used by the spending model to avoid unreliable services.
 */

const REPUTATION_KEY = 'arc-service-reputation';
const SPENDING_HISTORY_KEY = 'arc-spending-history';

interface ServiceRecord {
  url: string;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  totalSpentUsdc: number;
}

interface SpendingRecord {
  timestamp: number;
  serviceUrl: string;
  category: string;
  amountUsdc: number;
  success: boolean;
}

/**
 * Get all service reputation records
 */
export function getAllServiceRecords(): Record<string, ServiceRecord> {
  if (typeof window === 'undefined') return {};

  try {
    const saved = localStorage.getItem(REPUTATION_KEY);
    if (!saved) return {};
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

/**
 * Get reputation for a specific service
 */
export function getServiceReputation(serviceUrl: string): {
  successRate: number;
  totalCalls: number;
  lastUsed: number | null;
} {
  const records = getAllServiceRecords();
  const normalizedUrl = normalizeUrl(serviceUrl);
  const record = records[normalizedUrl];

  if (!record) {
    return {
      successRate: 1.0, // Benefit of the doubt for new services
      totalCalls: 0,
      lastUsed: null,
    };
  }

  const totalCalls = record.successCount + record.failureCount;
  const successRate = totalCalls > 0 ? record.successCount / totalCalls : 1.0;

  return {
    successRate,
    totalCalls,
    lastUsed: record.lastUsed,
  };
}

/**
 * Record a service call result
 */
export function recordServiceCall(
  serviceUrl: string,
  success: boolean,
  amountUsdc: number
): void {
  if (typeof window === 'undefined') return;

  const records = getAllServiceRecords();
  const normalizedUrl = normalizeUrl(serviceUrl);

  const existing = records[normalizedUrl] || {
    url: normalizedUrl,
    successCount: 0,
    failureCount: 0,
    lastUsed: 0,
    totalSpentUsdc: 0,
  };

  if (success) {
    existing.successCount++;
  } else {
    existing.failureCount++;
  }
  existing.lastUsed = Date.now();
  existing.totalSpentUsdc += amountUsdc;

  records[normalizedUrl] = existing;
  localStorage.setItem(REPUTATION_KEY, JSON.stringify(records));
}

/**
 * Get spending history
 */
export function getSpendingHistory(): SpendingRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = localStorage.getItem(SPENDING_HISTORY_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

/**
 * Record a spending event
 */
export function recordSpending(
  serviceUrl: string,
  category: string,
  amountUsdc: number,
  success: boolean
): void {
  if (typeof window === 'undefined') return;

  const history = getSpendingHistory();

  history.push({
    timestamp: Date.now(),
    serviceUrl: normalizeUrl(serviceUrl),
    category,
    amountUsdc,
    success,
  });

  // Keep last 1000 records
  const trimmed = history.slice(-1000);
  localStorage.setItem(SPENDING_HISTORY_KEY, JSON.stringify(trimmed));

  // Also update service reputation
  recordServiceCall(serviceUrl, success, amountUsdc);
}

/**
 * Get total spent today
 */
export function getSpentToday(): number {
  const history = getSpendingHistory();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  return history
    .filter(r => r.timestamp >= todayStart && r.success)
    .reduce((sum, r) => sum + r.amountUsdc, 0);
}

/**
 * Get recent purchases in a category
 */
export function getRecentPurchasesInCategory(
  category: string,
  windowHours: number = 24
): number {
  const history = getSpendingHistory();
  const cutoff = Date.now() - (windowHours * 60 * 60 * 1000);

  return history.filter(r =>
    r.timestamp >= cutoff &&
    r.category === category &&
    r.success
  ).length;
}

/**
 * Get time since last purchase (any service)
 */
export function getTimeSinceLastPurchase(): number {
  const history = getSpendingHistory();
  if (history.length === 0) return Infinity;

  const lastPurchase = history[history.length - 1];
  return Math.floor((Date.now() - lastPurchase.timestamp) / 1000);
}

/**
 * Normalize URL for consistent tracking
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query params and trailing slash for consistency
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Clear all reputation data (for testing)
 */
export function clearReputationData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REPUTATION_KEY);
  localStorage.removeItem(SPENDING_HISTORY_KEY);
}
