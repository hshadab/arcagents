/**
 * Centralized constants for network and payment configuration
 */

import type { Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// ============================================
// Request Configuration
// ============================================

/** Default timeout for HTTP requests in milliseconds */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/** Timeout for payment transactions in milliseconds */
export const PAYMENT_TIMEOUT_MS = 60000;

// ============================================
// Supported Networks
// ============================================

export type SupportedNetwork = 'base' | 'base-sepolia';

export const SUPPORTED_NETWORKS: SupportedNetwork[] = ['base', 'base-sepolia'];

export const DEFAULT_NETWORK: SupportedNetwork = 'base';

// ============================================
// Chain Configurations
// ============================================

export const CHAIN_CONFIGS = {
  'base': { chain: base, name: 'Base', explorer: 'https://basescan.org' },
  'base-sepolia': { chain: baseSepolia, name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org' },
} as const;

// ============================================
// USDC Contract Addresses
// ============================================

export const USDC_ADDRESSES: Record<SupportedNetwork, Address> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

/** USDC has 6 decimal places */
export const USDC_DECIMALS = 6;

// ============================================
// ERC-20 ABI (minimal for USDC transfers)
// ============================================

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ============================================
// x402 Payment Headers
// ============================================

export const X402_HEADERS = {
  PAYMENT: 'X-Payment',
  PAYMENT_PROOF: 'X-Payment-Proof',
  WWW_AUTHENTICATE: 'WWW-Authenticate',
} as const;

// ============================================
// Arc Testnet Configuration (for proofs/contracts)
// ============================================

export const ARC_TESTNET = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.arc.dev',
  explorer: 'https://explorer.arc.dev',
} as const;

// ============================================
// Smart Contract Addresses (Arc Testnet)
// ============================================

export const ARC_CONTRACTS = {
  AGENT_IDENTITY: '0x60287b849721EB7ed3C6BbdB34B46be02E0e2678',
  AGENT_REPUTATION: '0x106e73c96da621826d6923faA3361004e2db72a7',
  PROOF_ATTESTATION: '0xBE9a5DF7C551324CB872584C6E5bF56799787952',
  TREASURY: '0x75E016aC75678344275fd47d6524433B81e46d0B',
  COMPLIANCE_ORACLE: '0xdB4E18Cc9290a234eB128f1321643B6c1B5936d1',
  AGENT_FACADE: '0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384',
} as const;

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a network is supported
 */
export function isSupportedNetwork(network: string): network is SupportedNetwork {
  return SUPPORTED_NETWORKS.includes(network as SupportedNetwork);
}

/**
 * Get USDC address for a network
 */
export function getUsdcAddress(network: string): Address | null {
  if (!isSupportedNetwork(network)) return null;
  return USDC_ADDRESSES[network];
}

/**
 * Get chain config for a network
 */
export function getChainConfig(network: string) {
  if (!isSupportedNetwork(network)) return null;
  return CHAIN_CONFIGS[network];
}

/**
 * Format atomic amount to human readable (assumes 6 decimals)
 */
export function formatUsdcAmount(atomicAmount: string | bigint): string {
  const value = typeof atomicAmount === 'bigint'
    ? Number(atomicAmount)
    : parseInt(atomicAmount);
  return (value / Math.pow(10, USDC_DECIMALS)).toFixed(2);
}

/**
 * Convert human readable amount to atomic (6 decimals)
 */
export function toAtomicAmount(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.floor(value * Math.pow(10, USDC_DECIMALS)).toString();
}
