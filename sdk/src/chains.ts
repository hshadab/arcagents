/**
 * Custom chain definitions for Arc networks
 *
 * These are proper viem Chain objects that can be used without type casts.
 */

import { defineChain } from 'viem';

/**
 * Arc Testnet chain definition (Chain ID: 5042002)
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

/**
 * Arc Mainnet chain definition (Chain ID: 5042001)
 * Note: Not yet live
 */
export const arcMainnet = defineChain({
  id: 5042001,
  name: 'Arc Mainnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://arcscan.app',
    },
  },
  testnet: false,
});
