/**
 * Shared cryptographic utilities
 */

import type { Hash } from 'viem';

/**
 * Convert a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Validate a hex hash (32 bytes / 64 hex chars)
 */
export function isValidHash(hash: unknown): hash is Hash {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: unknown): address is `0x${string}` {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Sigmoid function for neural network outputs
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Softmax function for probability distributions
 */
export function softmax(arr: number[]): number[] {
  const maxVal = Math.max(...arr);
  const expArr = arr.map(v => Math.exp(v - maxVal));
  const sumExp = expArr.reduce((a, b) => a + b, 0);
  return expArr.map(v => v / sumExp);
}
