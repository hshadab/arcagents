/**
 * Request validation utilities
 */

import { isValidAddress, isValidHash } from './crypto';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate execute request body
 */
export function validateExecuteRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const req = body as Record<string, unknown>;

  // Required fields
  if (!req.agentId || typeof req.agentId !== 'string') {
    errors.push('agentId is required and must be a string');
  }

  if (!req.serviceUrl || typeof req.serviceUrl !== 'string') {
    errors.push('serviceUrl is required and must be a string');
  } else {
    try {
      new URL(req.serviceUrl as string);
    } catch {
      errors.push('serviceUrl must be a valid URL');
    }
  }

  // Optional address fields
  if (req.walletAddress && !isValidAddress(req.walletAddress)) {
    errors.push('walletAddress must be a valid Ethereum address');
  }

  if (req.treasuryAddress && !isValidAddress(req.treasuryAddress)) {
    errors.push('treasuryAddress must be a valid Ethereum address');
  }

  if (req.servicePayTo && !isValidAddress(req.servicePayTo)) {
    errors.push('servicePayTo must be a valid Ethereum address');
  }

  // Numeric field validation
  if (req.dailyLimitUsdc !== undefined) {
    const limit = Number(req.dailyLimitUsdc);
    if (isNaN(limit) || limit < 0) {
      errors.push('dailyLimitUsdc must be a non-negative number');
    }
  }

  if (req.maxSinglePurchaseUsdc !== undefined) {
    const max = Number(req.maxSinglePurchaseUsdc);
    if (isNaN(max) || max < 0) {
      errors.push('maxSinglePurchaseUsdc must be a non-negative number');
    }
  }

  if (req.serviceSuccessRate !== undefined) {
    const rate = Number(req.serviceSuccessRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      errors.push('serviceSuccessRate must be between 0 and 1');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate zkml prove request body
 */
export function validateProveRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const req = body as Record<string, unknown>;

  if (!req.modelId || typeof req.modelId !== 'string') {
    errors.push('modelId is required and must be a string');
  }

  if (!req.inputs) {
    errors.push('inputs is required');
  }

  if (req.tag && typeof req.tag !== 'string') {
    errors.push('tag must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate compliance check request
 */
export function validateComplianceRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const req = body as Record<string, unknown>;

  if (!req.address && !req.sender) {
    errors.push('address or sender is required');
  }

  if (req.address && !isValidAddress(req.address)) {
    errors.push('address must be a valid Ethereum address');
  }

  if (req.sender && !isValidAddress(req.sender)) {
    errors.push('sender must be a valid Ethereum address');
  }

  if (req.recipient && !isValidAddress(req.recipient)) {
    errors.push('recipient must be a valid Ethereum address');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate wallet request
 */
export function validateWalletRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const req = body as Record<string, unknown>;

  if (!req.agentId || typeof req.agentId !== 'string') {
    errors.push('agentId is required and must be a string');
  }

  if (req.name && typeof req.name !== 'string') {
    errors.push('name must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Allowed model IDs (whitelist for path traversal prevention)
 */
export const ALLOWED_MODEL_IDS = [
  'spending-model',
  'trading-signal',
  'opportunity-detector',
  'risk-scorer',
  'sentiment-classifier',
  'threshold-checker',
  'anomaly-detector',
] as const;

/**
 * Validate model ID is in whitelist (prevents path traversal)
 */
export function isValidModelId(modelId: string): boolean {
  return ALLOWED_MODEL_IDS.includes(modelId as typeof ALLOWED_MODEL_IDS[number]);
}
