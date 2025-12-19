/**
 * Spending Decision Model
 *
 * This model decides WHETHER an agent should purchase a service.
 * zkML proves the agent ran this model correctly before spending.
 *
 * Input: pre-payment data (price, budget, reputation, history)
 * Output: buy/don't_buy decision with confidence
 */

import type { ServiceCategory } from '@arc-agent/sdk';

/**
 * Input to the spending decision model
 * All data available BEFORE payment
 */
export interface SpendingModelInput {
  // Service info (from Bazaar/x402)
  serviceUrl: string;
  serviceName: string;
  serviceCategory: ServiceCategory | string;
  priceUsdc: number;           // Price in USDC (e.g., 0.001)

  // Agent's financial state
  budgetUsdc: number;          // Treasury balance in USDC
  spentTodayUsdc: number;      // Already spent today
  dailyLimitUsdc: number;      // Max daily spend (agent config)

  // Service reputation (tracked locally)
  serviceSuccessRate: number;  // 0-1, historical success rate
  serviceTotalCalls: number;   // How many times we've used this service

  // Agent behavior
  purchasesInCategory: number; // Recent purchases in same category
  timeSinceLastPurchase: number; // Seconds since last purchase (any service)
}

/**
 * Output from the spending decision model
 */
export interface SpendingModelOutput {
  shouldBuy: boolean;
  confidence: number;          // 0-1
  reasons: string[];           // Human-readable explanations
  riskScore: number;           // 0-1, higher = riskier purchase
}

/**
 * Spending model configuration per agent
 */
export interface SpendingPolicy {
  dailyLimitUsdc: number;      // Max spend per day
  maxSinglePurchaseUsdc: number; // Max single transaction
  minSuccessRate: number;      // Won't buy from services below this
  minBudgetBuffer: number;     // Keep at least this much in treasury
  categoryLimits?: Record<string, number>; // Per-category daily limits
}

// Default spending policy
export const DEFAULT_SPENDING_POLICY: SpendingPolicy = {
  dailyLimitUsdc: 1.0,         // $1/day max
  maxSinglePurchaseUsdc: 0.10, // $0.10 max per purchase
  minSuccessRate: 0.5,         // 50% success rate minimum
  minBudgetBuffer: 0.01,       // Keep $0.01 minimum in treasury
};

/**
 * Run the spending decision model
 *
 * This is a deterministic model that can be proven with zkML.
 * The logic is transparent and verifiable.
 */
export function runSpendingModel(
  input: SpendingModelInput,
  policy: SpendingPolicy = DEFAULT_SPENDING_POLICY
): SpendingModelOutput {
  const reasons: string[] = [];
  let riskScore = 0;

  // === HARD BLOCKS (shouldBuy = false, no exceptions) ===

  // 1. Price exceeds single purchase limit
  if (input.priceUsdc > policy.maxSinglePurchaseUsdc) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Price $${input.priceUsdc.toFixed(4)} exceeds max single purchase $${policy.maxSinglePurchaseUsdc.toFixed(4)}`],
      riskScore: 1.0,
    };
  }

  // 2. Would exceed daily limit
  const projectedDailySpend = input.spentTodayUsdc + input.priceUsdc;
  if (projectedDailySpend > policy.dailyLimitUsdc) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Would exceed daily limit: $${projectedDailySpend.toFixed(4)} > $${policy.dailyLimitUsdc.toFixed(4)}`],
      riskScore: 1.0,
    };
  }

  // 3. Insufficient budget (including buffer)
  const availableBudget = input.budgetUsdc - policy.minBudgetBuffer;
  if (input.priceUsdc > availableBudget) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Insufficient budget: need $${input.priceUsdc.toFixed(4)}, have $${availableBudget.toFixed(4)} available`],
      riskScore: 1.0,
    };
  }

  // 4. Service has bad reputation (if we have history)
  if (input.serviceTotalCalls >= 3 && input.serviceSuccessRate < policy.minSuccessRate) {
    return {
      shouldBuy: false,
      confidence: 0.9,
      reasons: [`Service success rate ${(input.serviceSuccessRate * 100).toFixed(0)}% below minimum ${(policy.minSuccessRate * 100).toFixed(0)}%`],
      riskScore: 0.9,
    };
  }

  // === SOFT FACTORS (affect confidence and risk score) ===

  // Factor 1: Price relative to budget
  const budgetRatio = input.priceUsdc / input.budgetUsdc;
  if (budgetRatio > 0.5) {
    riskScore += 0.3;
    reasons.push(`High budget ratio: ${(budgetRatio * 100).toFixed(0)}% of treasury`);
  } else if (budgetRatio < 0.1) {
    reasons.push(`Low budget impact: ${(budgetRatio * 100).toFixed(1)}% of treasury`);
  }

  // Factor 2: Service reputation
  if (input.serviceTotalCalls === 0) {
    riskScore += 0.2;
    reasons.push('New service (no history)');
  } else if (input.serviceSuccessRate >= 0.9) {
    riskScore -= 0.1;
    reasons.push(`Trusted service: ${(input.serviceSuccessRate * 100).toFixed(0)}% success rate`);
  } else if (input.serviceSuccessRate < 0.7) {
    riskScore += 0.2;
    reasons.push(`Moderate success rate: ${(input.serviceSuccessRate * 100).toFixed(0)}%`);
  }

  // Factor 3: Daily spend progress
  const dailyProgress = input.spentTodayUsdc / policy.dailyLimitUsdc;
  if (dailyProgress > 0.8) {
    riskScore += 0.15;
    reasons.push(`Near daily limit: ${(dailyProgress * 100).toFixed(0)}% used`);
  }

  // Factor 4: Rapid spending detection
  if (input.timeSinceLastPurchase < 60) { // Less than 1 minute
    riskScore += 0.1;
    reasons.push('Rapid spending detected');
  }

  // Factor 5: Category concentration
  if (input.purchasesInCategory > 5) {
    riskScore += 0.1;
    reasons.push(`High category concentration: ${input.purchasesInCategory} recent purchases`);
  }

  // Normalize risk score
  riskScore = Math.max(0, Math.min(1, riskScore));

  // Calculate confidence (inverse of risk for "buy" decisions)
  const confidence = 1 - (riskScore * 0.5); // Risk affects confidence but doesn't flip decision

  // Decision: buy if risk is acceptable
  const shouldBuy = riskScore < 0.8;

  if (shouldBuy) {
    reasons.unshift(`Approved: price $${input.priceUsdc.toFixed(4)} within policy limits`);
  } else {
    reasons.unshift(`Rejected: accumulated risk score ${riskScore.toFixed(2)} too high`);
  }

  return {
    shouldBuy,
    confidence,
    reasons,
    riskScore,
  };
}

/**
 * Convert spending model input to numeric array for ONNX inference
 * This allows the same logic to be run as an ONNX model for real zkML proofs
 */
export function spendingInputToNumeric(input: SpendingModelInput): number[] {
  return [
    input.priceUsdc,
    input.budgetUsdc,
    input.spentTodayUsdc,
    input.dailyLimitUsdc,
    input.serviceSuccessRate,
    input.serviceTotalCalls / 100, // Normalize
    input.purchasesInCategory / 10, // Normalize
    Math.min(input.timeSinceLastPurchase / 3600, 1), // Normalize to hours, cap at 1
  ];
}

/**
 * Hash the spending decision for proof
 */
export function hashSpendingDecision(
  input: SpendingModelInput,
  output: SpendingModelOutput
): string {
  const data = JSON.stringify({ input, output });
  // Simple hash for now - in production use keccak256
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}
