/**
 * Spending Model for Arc Agents
 *
 * All agents use zkML proofs for spending decisions. The spending model
 * evaluates whether a purchase should proceed based on price, budget,
 * daily limits, and service reputation.
 *
 * The proof verifies CORRECT EXECUTION - proving your agent computed
 * its spending decision using the stated model, not arbitrary logic.
 *
 * Source: https://github.com/ICME-Lab/jolt-atlas
 */

/**
 * Spending model ID
 */
export type SpendingModelId = 'spending-model';

/**
 * JOLT-Atlas model reference
 */
interface JoltAtlasModel {
  /** Model name in JOLT-Atlas repo */
  joltModel: string;
  /** Path to model in repo */
  modelPath: string;
  /** Typical proof time in seconds (with real JOLT-Atlas prover) */
  proofTimeSec: number;
  /** Proof size in KB */
  proofSizeKB: number;
}

/**
 * Spending model definition
 */
export interface SpendingModel {
  /** Unique model ID */
  id: SpendingModelId;
  /** Human-readable name */
  name: string;
  /** What the model does */
  description: string;
  /** SHA-256 hash of the ONNX model file */
  modelHash: string;
  /** Model file size */
  modelSize: string;
  /** Input shape [batch, ...dims] */
  inputShape: number[];
  /** Output shape */
  outputShape: number[];
  /** Input type */
  inputType: 'float32';
  /** What the input represents */
  inputDescription: string;
  /** What the output represents */
  outputDescription: string;
  /** JOLT-Atlas model reference */
  joltAtlas: JoltAtlasModel;
}

/**
 * The universal spending model used by ALL agents
 */
export const SPENDING_MODEL: SpendingModel = {
  id: 'spending-model',
  name: 'Spending Decision',
  description: 'Universal spending model for ALL agents. Evaluates whether a purchase should proceed based on price, budget, daily limits, and service reputation.',
  modelHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  modelSize: '1.7 KB',
  inputShape: [1, 8],
  outputShape: [1, 3],
  inputType: 'float32',
  inputDescription: '8 spending features: price, budget, spentToday, dailyLimit, successRate, totalCalls, purchasesInCategory, timeSinceLastPurchase',
  outputDescription: '3 values: shouldBuy (0-1), confidence (0-1), riskScore (0-1)',
  joltAtlas: {
    joltModel: 'spending_model',
    modelPath: 'arc-prover/models/spending-model',
    proofTimeSec: 5,
    proofSizeKB: 40,
  },
};

/**
 * Get the spending model
 */
export function getSpendingModel(): SpendingModel {
  return SPENDING_MODEL;
}

// Legacy exports for backwards compatibility during transition
export type DecisionModelId = SpendingModelId;
export type DecisionModel = SpendingModel;
export const DECISION_MODELS: Record<SpendingModelId, SpendingModel> = {
  'spending-model': SPENDING_MODEL,
};
export function getDecisionModel(id: string): SpendingModel | undefined {
  return id === 'spending-model' ? SPENDING_MODEL : undefined;
}
