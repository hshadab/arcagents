/**
 * @fileoverview Input validation utilities for Arc Agent SDK
 * @module @arc-agent/sdk/utils/validation
 */

import type { Address } from 'viem';

/**
 * Validation error thrown when input validation fails
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Agent name constraints
 */
export const AGENT_NAME_CONSTRAINTS = {
  minLength: 1,
  maxLength: 64,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
} as const;

/**
 * Deposit amount constraints (in USDC)
 */
export const DEPOSIT_CONSTRAINTS = {
  min: 0,
  max: 1_000_000, // 1M USDC max
} as const;

/**
 * URL constraints for service endpoints
 */
export const URL_CONSTRAINTS = {
  maxLength: 2048,
  allowedProtocols: ['https:', 'http:'],
} as const;

/**
 * Validates an Ethereum address
 * @param address - The address to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If address is invalid
 */
export function validateAddress(address: string, fieldName = 'address'): Address {
  if (!address) {
    throw new ValidationError(`${fieldName} is required`, fieldName, address);
  }

  if (typeof address !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, address);
  }

  // Check format: 0x followed by 40 hex characters
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(address)) {
    throw new ValidationError(
      `${fieldName} must be a valid Ethereum address (0x followed by 40 hex characters)`,
      fieldName,
      address
    );
  }

  return address as Address;
}

/**
 * Validates an agent name
 * @param name - The agent name to validate
 * @throws {ValidationError} If name is invalid
 */
export function validateAgentName(name: string): string {
  if (!name) {
    throw new ValidationError('Agent name is required', 'name', name);
  }

  if (typeof name !== 'string') {
    throw new ValidationError('Agent name must be a string', 'name', name);
  }

  const trimmed = name.trim();

  if (trimmed.length < AGENT_NAME_CONSTRAINTS.minLength) {
    throw new ValidationError(
      `Agent name must be at least ${AGENT_NAME_CONSTRAINTS.minLength} character(s)`,
      'name',
      name
    );
  }

  if (trimmed.length > AGENT_NAME_CONSTRAINTS.maxLength) {
    throw new ValidationError(
      `Agent name must be at most ${AGENT_NAME_CONSTRAINTS.maxLength} characters`,
      'name',
      name
    );
  }

  if (!AGENT_NAME_CONSTRAINTS.pattern.test(trimmed)) {
    throw new ValidationError(
      'Agent name must start with a letter or number and contain only letters, numbers, underscores, and hyphens',
      'name',
      name
    );
  }

  return trimmed;
}

/**
 * Validates a deposit/amount value
 * @param amount - The amount string to validate (e.g., "10.5")
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If amount is invalid
 */
export function validateAmount(amount: string, fieldName = 'amount'): string {
  if (!amount) {
    throw new ValidationError(`${fieldName} is required`, fieldName, amount);
  }

  if (typeof amount !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, amount);
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName, amount);
  }

  if (numAmount < DEPOSIT_CONSTRAINTS.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${DEPOSIT_CONSTRAINTS.min}`,
      fieldName,
      amount
    );
  }

  if (numAmount > DEPOSIT_CONSTRAINTS.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${DEPOSIT_CONSTRAINTS.max.toLocaleString()} USDC`,
      fieldName,
      amount
    );
  }

  // Validate decimal places (USDC has 6 decimals)
  const parts = amount.split('.');
  if (parts.length === 2 && parts[1].length > 6) {
    throw new ValidationError(
      `${fieldName} cannot have more than 6 decimal places (USDC precision)`,
      fieldName,
      amount
    );
  }

  return amount;
}

/**
 * Validates a URL
 * @param url - The URL to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If URL is invalid
 */
export function validateUrl(url: string, fieldName = 'url'): string {
  if (!url) {
    throw new ValidationError(`${fieldName} is required`, fieldName, url);
  }

  if (typeof url !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, url);
  }

  if (url.length > URL_CONSTRAINTS.maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${URL_CONSTRAINTS.maxLength} characters`,
      fieldName,
      url
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`, fieldName, url);
  }

  if (!(URL_CONSTRAINTS.allowedProtocols as readonly string[]).includes(parsed.protocol)) {
    throw new ValidationError(
      `${fieldName} must use HTTPS or HTTP protocol`,
      fieldName,
      url
    );
  }

  return url;
}

/**
 * Validates an agent ID
 * @param agentId - The agent ID to validate
 * @throws {ValidationError} If agent ID is invalid
 */
export function validateAgentId(agentId: string): string {
  if (!agentId) {
    throw new ValidationError('Agent ID is required', 'agentId', agentId);
  }

  if (typeof agentId !== 'string') {
    throw new ValidationError('Agent ID must be a string', 'agentId', agentId);
  }

  // Agent ID should be a numeric string or valid identifier
  const numId = parseInt(agentId, 10);
  if (isNaN(numId) || numId < 0) {
    throw new ValidationError('Agent ID must be a valid positive integer', 'agentId', agentId);
  }

  return agentId;
}

/**
 * Validates a bytes32 hash
 * @param hash - The hash to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If hash is invalid
 */
export function validateBytes32(hash: string, fieldName = 'hash'): `0x${string}` {
  if (!hash) {
    throw new ValidationError(`${fieldName} is required`, fieldName, hash);
  }

  const bytes32Regex = /^0x[a-fA-F0-9]{64}$/;
  if (!bytes32Regex.test(hash)) {
    throw new ValidationError(
      `${fieldName} must be a valid bytes32 hash (0x followed by 64 hex characters)`,
      fieldName,
      hash
    );
  }

  return hash as `0x${string}`;
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * @param input - The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}
