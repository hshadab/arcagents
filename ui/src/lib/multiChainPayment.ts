/**
 * EVM Payment Helper
 * Supports USDC payments on Base for x402 services
 */

import { createWalletClient, createPublicClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';
import {
  USDC_ADDRESSES,
  CHAIN_CONFIGS,
  ERC20_ABI,
  DEFAULT_NETWORK,
  isSupportedNetwork,
  type SupportedNetwork,
} from './constants';

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  network: string;
}

export interface WalletInfo {
  address: string;
  privateKey: string;
}

/**
 * Detect network from x402 payment info
 * Only supports EVM networks (Base, Base Sepolia)
 */
export function detectNetwork(paymentInfo: {
  network?: string;
  asset?: string;
  payTo?: string;
}): SupportedNetwork {
  const network = paymentInfo.network?.toLowerCase() || '';

  // Direct network match
  if (network.includes('base')) {
    return network.includes('sepolia') ? 'base-sepolia' : 'base';
  }

  // Detect from asset address
  if (paymentInfo.asset) {
    const asset = paymentInfo.asset.toLowerCase();
    if (asset.startsWith('0x')) {
      if (asset === USDC_ADDRESSES.base.toLowerCase()) return 'base';
      if (asset === USDC_ADDRESSES['base-sepolia'].toLowerCase()) return 'base-sepolia';
    }
  }

  // Detect from payTo address format (EVM addresses start with 0x)
  if (paymentInfo.payTo) {
    if (paymentInfo.payTo.startsWith('0x') && paymentInfo.payTo.length === 42) {
      return DEFAULT_NETWORK;
    }
  }

  // Log when defaulting to help with debugging
  if (network && !network.includes('base')) {
    console.warn(`[Payment] Unsupported network "${network}", defaulting to ${DEFAULT_NETWORK}`);
  }

  return DEFAULT_NETWORK;
}

/**
 * Send USDC payment on EVM chain (Base)
 */
export async function sendEvmPayment(
  privateKey: Hex,
  to: Address,
  amountAtomic: string,
  network: SupportedNetwork = 'base'
): Promise<PaymentResult> {
  if (!isSupportedNetwork(network)) {
    return {
      success: false,
      error: `Unsupported network: ${network}. Only Base networks are supported.`,
      network,
    };
  }

  const chainConfig = CHAIN_CONFIGS[network];
  const usdcAddress = USDC_ADDRESSES[network];

  try {
    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(),
    });

    console.log(`[Payment] Sending ${formatUnits(BigInt(amountAtomic), 6)} USDC on ${network} to ${to}`);

    // Check balance first
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }) as bigint;

    if (balance < BigInt(amountAtomic)) {
      return {
        success: false,
        error: `Insufficient USDC on ${network}. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(BigInt(amountAtomic), 6)}`,
        network,
      };
    }

    // Send transfer
    const hash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amountAtomic)],
    });

    console.log(`[Payment] TX submitted on ${network}: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status !== 'success') {
      return {
        success: false,
        txHash: hash,
        error: 'Transaction reverted',
        network,
      };
    }

    console.log(`[Payment] TX confirmed on ${network}: ${hash}`);

    return {
      success: true,
      txHash: hash,
      network,
    };
  } catch (error) {
    console.error(`[Payment] EVM payment failed on ${network}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'EVM payment failed',
      network,
    };
  }
}

/**
 * Send USDC payment - main entry point
 */
export async function sendPayment(
  wallet: WalletInfo,
  to: string,
  amountAtomic: string,
  network: string
): Promise<PaymentResult> {
  const supportedNetwork = isSupportedNetwork(network) ? network : DEFAULT_NETWORK;

  if (!wallet.privateKey) {
    return {
      success: false,
      error: 'No wallet private key provided',
      network: supportedNetwork,
    };
  }

  return sendEvmPayment(
    wallet.privateKey as Hex,
    to as Address,
    amountAtomic,
    supportedNetwork
  );
}

/**
 * Get USDC balance on a network
 */
export async function getBalance(
  wallet: WalletInfo,
  network: string
): Promise<{ balance: string; formatted: string }> {
  const supportedNetwork = isSupportedNetwork(network) ? network : DEFAULT_NETWORK;

  try {
    const chainConfig = CHAIN_CONFIGS[supportedNetwork];
    const usdcAddress = USDC_ADDRESSES[supportedNetwork];

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address as Address],
    }) as bigint;

    return {
      balance: balance.toString(),
      formatted: formatUnits(balance, 6),
    };
  } catch (error) {
    console.error(`[Payment] Failed to get balance on ${network}:`, error);
    return { balance: '0', formatted: '0.00' };
  }
}

/**
 * Format amount for display
 */
export function formatUsdcAmount(atomicAmount: string): string {
  return (Number(atomicAmount) / 1e6).toFixed(2);
}
