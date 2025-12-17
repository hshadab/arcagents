/**
 * Arc Testnet Payment Helper
 * Uses viem to send USDC transfers for x402 payments
 */

import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';

// Arc Testnet configuration
export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.network' },
  },
} as const;

// USDC contract on Arc Testnet (6 decimals)
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238') as Address;
const USDC_DECIMALS = 6;

// ERC-20 Transfer ABI
const ERC20_ABI = [
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
] as const;

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: string;
}

export interface BalanceResult {
  balance: string;
  balanceFormatted: string;
}

/**
 * Create a public client for reading from Arc Testnet
 */
export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
}

/**
 * Create a wallet client for signing transactions
 */
export function getWalletClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
}

/**
 * Get USDC balance for an address
 */
export async function getUsdcBalance(address: Address): Promise<BalanceResult> {
  const client = getPublicClient();

  try {
    const balance = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    return {
      balance: balance.toString(),
      balanceFormatted: formatUnits(balance, USDC_DECIMALS),
    };
  } catch (error) {
    console.error('[ArcPayment] Failed to get balance:', error);
    return {
      balance: '0',
      balanceFormatted: '0',
    };
  }
}

/**
 * Send USDC payment on Arc Testnet
 */
export async function sendUsdcPayment(
  privateKey: Hex,
  to: Address,
  amountAtomic: string
): Promise<PaymentResult> {
  try {
    const walletClient = getWalletClient(privateKey);
    const publicClient = getPublicClient();
    const account = privateKeyToAccount(privateKey);

    console.log(`[ArcPayment] Sending ${formatUnits(BigInt(amountAtomic), USDC_DECIMALS)} USDC to ${to}`);

    // Check balance first
    const balance = await getUsdcBalance(account.address);
    if (BigInt(balance.balance) < BigInt(amountAtomic)) {
      return {
        success: false,
        error: `Insufficient USDC balance. Have: ${balance.balanceFormatted}, Need: ${formatUnits(BigInt(amountAtomic), USDC_DECIMALS)}`,
      };
    }

    // Send the transfer
    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amountAtomic)],
    });

    console.log(`[ArcPayment] Transaction submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    console.log(`[ArcPayment] Transaction confirmed in block ${receipt.blockNumber}`);

    return {
      success: receipt.status === 'success',
      txHash: hash,
      gasUsed: receipt.gasUsed.toString(),
      error: receipt.status !== 'success' ? 'Transaction reverted' : undefined,
    };
  } catch (error) {
    console.error('[ArcPayment] Payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Format atomic amount to human readable
 */
export function formatUsdcAmount(atomicAmount: string): string {
  return formatUnits(BigInt(atomicAmount), USDC_DECIMALS);
}

/**
 * Convert human readable amount to atomic
 */
export function toAtomicUsdcAmount(amount: string): string {
  return parseUnits(amount, USDC_DECIMALS).toString();
}
