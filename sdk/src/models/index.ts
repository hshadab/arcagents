/**
 * Premade Decision Models Library
 *
 * These models are shipped with Arc Agent and auto-assigned based on
 * the x402 service type. Each model is an ONNX file that can be proven
 * with JOLT-Atlas zkML.
 */

import type { Hash } from 'viem';
import type { DecisionModel, DecisionModelId, ServiceCategory } from '../types.js';

/**
 * Registry of all premade decision models
 *
 * Model hashes are SHA256 hashes of the ONNX files in ui/public/models/
 * To regenerate: sha256sum ui/public/models/*.onnx
 */
export const DECISION_MODELS: Record<DecisionModelId, DecisionModel> = {
  'trading-signal': {
    id: 'trading-signal',
    name: 'Trading Signal Classifier',
    description: 'Analyzes market data and outputs a buy/sell/hold signal. Used before executing trades.',
    modelHash: '0x64f8079d6f44d488e6a0220b59caab08b638c53577544f8740bb31458254fd0a' as Hash,
    defaultThreshold: 0.7,
    inputDescription: 'Price data, volume, technical indicators',
    outputDescription: '0-1 score where >0.7 = buy signal, <0.3 = sell signal',
    forCategories: ['oracle', 'data'],
  },

  'opportunity-detector': {
    id: 'opportunity-detector',
    name: 'Opportunity Detector',
    description: 'Detects profitable opportunities from DeFi pool data, yield rates, or arbitrage conditions.',
    modelHash: '0xcc8d8c9afab8191a25967f35a58fea9abb4920946f4cbc43b5f9b17eebc1a967' as Hash,
    defaultThreshold: 0.6,
    inputDescription: 'Pool TVL, APY, liquidity depth, historical performance',
    outputDescription: '0-1 score indicating opportunity quality',
    forCategories: ['data', 'oracle', 'api'],
  },

  'risk-scorer': {
    id: 'risk-scorer',
    name: 'Risk Assessment Scorer',
    description: 'Evaluates risk level of tokens, protocols, or counterparties before interaction.',
    modelHash: '0x64f8079d6f44d488e6a0220b59caab08b638c53577544f8740bb31458254fd0a' as Hash,
    defaultThreshold: 0.8,
    inputDescription: 'Token metadata, contract analysis, holder distribution',
    outputDescription: '0-1 safety score where >0.8 = low risk',
    forCategories: ['data', 'ai', 'api'],
  },

  'sentiment-classifier': {
    id: 'sentiment-classifier',
    name: 'Sentiment Classifier',
    description: 'Analyzes news, social media, or market sentiment to determine market mood.',
    modelHash: '0x190d1cebac1eb7c65268fd3762dfeb5e4517330594e4de17b35848e42155cb81' as Hash,
    defaultThreshold: 0.65,
    inputDescription: 'Text content, social metrics, news headlines',
    outputDescription: '0-1 sentiment score where >0.65 = positive',
    forCategories: ['ai', 'data', 'api'],
  },

  'threshold-checker': {
    id: 'threshold-checker',
    name: 'Threshold Checker',
    description: 'Simple model that checks if input values meet configured thresholds. General purpose.',
    modelHash: '0xdc568010ab721d90ec93ff9b7d755010c84767932d9559b705025b2c7d6b86ab' as Hash,
    defaultThreshold: 0.5,
    inputDescription: 'Numeric values to check against thresholds',
    outputDescription: '0 or 1 based on threshold check',
    forCategories: ['data', 'oracle', 'api', 'other'],
  },

  'anomaly-detector': {
    id: 'anomaly-detector',
    name: 'Anomaly Detector',
    description: 'Detects unusual patterns or outliers in data. Used for security or monitoring.',
    modelHash: '0xfd58069b46ab7a53066ec58a3994dd4b73d32be0ad31dbf55f1d3a97539170f3' as Hash,
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

/**
 * Model file paths (relative to models directory)
 * In production, these would be actual ONNX files
 */
export const MODEL_PATHS: Record<DecisionModelId, string> = {
  'trading-signal': 'trading-signal.onnx',
  'opportunity-detector': 'opportunity-detector.onnx',
  'risk-scorer': 'risk-scorer.onnx',
  'sentiment-classifier': 'sentiment-classifier.onnx',
  'threshold-checker': 'threshold-checker.onnx',
  'anomaly-detector': 'anomaly-detector.onnx',
};
