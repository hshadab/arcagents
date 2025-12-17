import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import type { Chain } from 'wagmi/chains';

// Define Arc Testnet chain
export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network']
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
};

// Define Arc Mainnet chain (not yet live)
export const arcMainnet: Chain = {
  id: 5042001,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_MAINNET_RPC || 'https://rpc.arc.network']
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://arcscan.app' },
  },
};

// Create wagmi config directly (no connectkit dependency for SSR compatibility)
export const config = createConfig({
  chains: [arcTestnet, arcMainnet],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    [arcMainnet.id]: http(arcMainnet.rpcUrls.default.http[0]),
  },
  connectors: [
    coinbaseWallet({
      appName: 'Arc Agents',
      preference: 'smartWalletOnly',
    }),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

// Export chain IDs for easy access
export const CHAIN_IDS = {
  ARC_TESTNET: 5042002,
  ARC_MAINNET: 5042001,
} as const;
