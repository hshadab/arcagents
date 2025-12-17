import Conf from 'conf';
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ArcAgentClient,
  ARC_TESTNET,
  ARC_MAINNET,
  createNetworkConfig,
  type NetworkConfig,
} from '@arc-agent/sdk';

export interface CLIConfig {
  network?: 'testnet' | 'mainnet';
  rpcUrl?: string;
  privateKey?: string;
}

const config = new Conf<CLIConfig>({
  projectName: 'arc-agent',
  schema: {
    network: {
      type: 'string',
      enum: ['testnet', 'mainnet'],
    },
    rpcUrl: {
      type: 'string',
    },
    privateKey: {
      type: 'string',
    },
  },
});

export function getConfig(): CLIConfig {
  return {
    network: config.get('network'),
    rpcUrl: config.get('rpcUrl'),
    privateKey: config.get('privateKey'),
  };
}

export function setConfig(newConfig: CLIConfig): void {
  if (newConfig.network !== undefined) {
    config.set('network', newConfig.network);
  }
  if (newConfig.rpcUrl !== undefined) {
    config.set('rpcUrl', newConfig.rpcUrl);
  }
  if (newConfig.privateKey !== undefined) {
    config.set('privateKey', newConfig.privateKey);
  }
}

export function clearConfig(): void {
  config.clear();
}

export function getNetworkConfig(): NetworkConfig {
  const cliConfig = getConfig();

  let networkConfig = cliConfig.network === 'mainnet' ? ARC_MAINNET : ARC_TESTNET;

  // Override RPC if custom one is set
  if (cliConfig.rpcUrl) {
    networkConfig = {
      ...networkConfig,
      rpcUrl: cliConfig.rpcUrl,
    };
  }

  return networkConfig;
}

export function getPublicClient(): PublicClient {
  const networkConfig = getNetworkConfig();

  return createPublicClient({
    chain: {
      id: networkConfig.chainId,
      name: networkConfig.name,
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
      rpcUrls: {
        default: { http: [networkConfig.rpcUrl] },
      },
    },
    transport: http(networkConfig.rpcUrl),
  });
}

export function getWalletClient(): WalletClient {
  const cliConfig = getConfig();
  const networkConfig = getNetworkConfig();

  if (!cliConfig.privateKey) {
    throw new Error('No private key configured. Run `arc-agent config set-key` first.');
  }

  const account = privateKeyToAccount(cliConfig.privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain: {
      id: networkConfig.chainId,
      name: networkConfig.name,
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
      rpcUrls: {
        default: { http: [networkConfig.rpcUrl] },
      },
    },
    transport: http(networkConfig.rpcUrl),
  });
}

export async function getAgentClient(): Promise<ArcAgentClient> {
  const networkConfig = getNetworkConfig();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  return new ArcAgentClient({
    network: networkConfig,
    publicClient: publicClient as any,
    wallet: walletClient as any,
  });
}
