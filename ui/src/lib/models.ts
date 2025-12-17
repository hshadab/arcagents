/**
 * Decision Models Library (Browser-compatible)
 *
 * These models are shipped with Arc Agents and auto-assigned based on
 * the x402 service type. Each model is an ONNX file that can be proven
 * with JOLT-Atlas zkML.
 */

import type { ServiceCategory } from '@arc-agent/sdk';

/**
 * Available premade decision model IDs
 */
export type DecisionModelId =
  | 'trading-signal'
  | 'opportunity-detector'
  | 'risk-scorer'
  | 'sentiment-classifier'
  | 'threshold-checker'
  | 'anomaly-detector';

/**
 * Decision model definition from the premade library
 */
export interface DecisionModel {
  /** Unique model ID */
  id: DecisionModelId;
  /** Human-readable name */
  name: string;
  /** What the model does */
  description: string;
  /** Hash of the ONNX model for verification */
  modelHash: string;
  /** Default threshold for decision (0-1) */
  defaultThreshold: number;
  /** Input schema description */
  inputDescription: string;
  /** Output description */
  outputDescription: string;
  /** Service categories this model is appropriate for */
  forCategories: ServiceCategory[];
}

/**
 * Registry of all premade decision models
 */
export const DECISION_MODELS: Record<DecisionModelId, DecisionModel> = {
  'trading-signal': {
    id: 'trading-signal',
    name: 'Trading Signal Classifier',
    description: 'Analyzes market data and outputs a buy/sell/hold signal. Used before executing trades.',
    modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    defaultThreshold: 0.7,
    inputDescription: 'Price data, volume, technical indicators',
    outputDescription: '0-1 score where >0.7 = buy signal, <0.3 = sell signal',
    forCategories: ['oracle', 'data'],
  },

  'opportunity-detector': {
    id: 'opportunity-detector',
    name: 'Opportunity Detector',
    description: 'Detects profitable opportunities from DeFi pool data, yield rates, or arbitrage conditions.',
    modelHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    defaultThreshold: 0.6,
    inputDescription: 'Pool TVL, APY, liquidity depth, historical performance',
    outputDescription: '0-1 score indicating opportunity quality',
    forCategories: ['data', 'oracle', 'api'],
  },

  'risk-scorer': {
    id: 'risk-scorer',
    name: 'Risk Assessment Scorer',
    description: 'Evaluates risk level of tokens, protocols, or counterparties before interaction.',
    modelHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    defaultThreshold: 0.8,
    inputDescription: 'Token metadata, contract analysis, holder distribution',
    outputDescription: '0-1 safety score where >0.8 = low risk',
    forCategories: ['data', 'ai', 'api'],
  },

  'sentiment-classifier': {
    id: 'sentiment-classifier',
    name: 'Sentiment Classifier',
    description: 'Analyzes news, social media, or market sentiment to determine market mood.',
    modelHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
    defaultThreshold: 0.65,
    inputDescription: 'Text content, social metrics, news headlines',
    outputDescription: '0-1 sentiment score where >0.65 = positive',
    forCategories: ['ai', 'data', 'api'],
  },

  'threshold-checker': {
    id: 'threshold-checker',
    name: 'Threshold Checker',
    description: 'Simple model that checks if input values meet configured thresholds. General purpose.',
    modelHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
    defaultThreshold: 0.5,
    inputDescription: 'Numeric values to check against thresholds',
    outputDescription: '0 or 1 based on threshold check',
    forCategories: ['data', 'oracle', 'api', 'other'],
  },

  'anomaly-detector': {
    id: 'anomaly-detector',
    name: 'Anomaly Detector',
    description: 'Detects unusual patterns or outliers in data. Used for security or monitoring.',
    modelHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
    defaultThreshold: 0.9,
    inputDescription: 'Time series data, transaction patterns, metrics',
    outputDescription: '0-1 normality score where >0.9 = normal (no anomaly)',
    forCategories: ['data', 'ai', 'api'],
  },
};

/**
 * Get a decision model by ID
 */
export function getDecisionModel(id: DecisionModelId): DecisionModel | undefined {
  return DECISION_MODELS[id];
}

/**
 * Get all available decision models
 */
export function getAllDecisionModels(): DecisionModel[] {
  return Object.values(DECISION_MODELS);
}

/**
 * Get models appropriate for a service category
 */
export function getModelsForCategory(category: ServiceCategory): DecisionModel[] {
  return Object.values(DECISION_MODELS).filter(model =>
    model.forCategories.includes(category)
  );
}

/**
 * Suggest a model based on service category and name
 * Returns the most appropriate model for the given service
 */
export function suggestModelForService(
  category: ServiceCategory | undefined,
  serviceName: string
): DecisionModelId {
  const nameLower = serviceName.toLowerCase();

  // Check name-based hints first
  if (nameLower.includes('trade') || nameLower.includes('swap') || nameLower.includes('exchange')) {
    return 'trading-signal';
  }
  if (nameLower.includes('risk') || nameLower.includes('security') || nameLower.includes('audit')) {
    return 'risk-scorer';
  }
  if (nameLower.includes('sentiment') || nameLower.includes('news') || nameLower.includes('social')) {
    return 'sentiment-classifier';
  }
  if (nameLower.includes('yield') || nameLower.includes('pool') || nameLower.includes('defi') || nameLower.includes('rebalance')) {
    return 'opportunity-detector';
  }
  if (nameLower.includes('anomaly') || nameLower.includes('alert') || nameLower.includes('monitor')) {
    return 'anomaly-detector';
  }

  // Fall back to category-based suggestion
  switch (category) {
    case 'oracle':
      return 'trading-signal';
    case 'ai':
      return 'sentiment-classifier';
    case 'data':
      return 'opportunity-detector';
    default:
      return 'threshold-checker';
  }
}
