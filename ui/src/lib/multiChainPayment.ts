/**
 * Multi-Chain Payment Helper
 * Supports USDC payments on Base and Solana for x402 services
 */

import { createWalletClient, createPublicClient, http, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';

// USDC Contract Addresses
export const USDC_ADDRESSES: Record<string, Address> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

// Solana USDC (SPL Token)
export const SOLANA_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const SOLANA_USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Chain configurations
const CHAIN_CONFIGS = {
  'base': { chain: base },
  'base-sepolia': { chain: baseSepolia },
} as const;

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
  network: string;
  simulated: boolean;
}

export interface WalletInfo {
  evm: {
    address: string;
    privateKey: string;
  };
  solana: {
    address: string;
    privateKey: string; // Base58 encoded
  };
}

/**
 * Detect network from x402 payment info
 */
export function detectNetwork(paymentInfo: {
  network?: string;
  asset?: string;
  payTo?: string;
}): string {
  const network = paymentInfo.network?.toLowerCase() || '';

  // Direct network match
  if (network.includes('base')) return network.includes('sepolia') ? 'base-sepolia' : 'base';
  if (network.includes('solana')) return network.includes('devnet') ? 'solana-devnet' : 'solana';
  if (network.includes('ethereum')) return 'ethereum';

  // Detect from asset address
  if (paymentInfo.asset) {
    const asset = paymentInfo.asset.toLowerCase();
    // EVM addresses start with 0x
    if (asset.startsWith('0x')) {
      if (asset === USDC_ADDRESSES.base.toLowerCase()) return 'base';
      if (asset === USDC_ADDRESSES['base-sepolia'].toLowerCase()) return 'base-sepolia';
    }
    // Solana addresses are base58
    if (asset === SOLANA_USDC_MINT.toBase58()) return 'solana';
    if (asset === SOLANA_USDC_DEVNET.toBase58()) return 'solana-devnet';
  }

  // Detect from payTo address format
  if (paymentInfo.payTo) {
    if (paymentInfo.payTo.startsWith('0x') && paymentInfo.payTo.length === 42) {
      return 'base'; // Default EVM to Base
    }
    // Solana addresses are 32-44 chars base58
    if (!paymentInfo.payTo.startsWith('0x') && paymentInfo.payTo.length >= 32) {
      return 'solana';
    }
  }

  return 'base'; // Default to Base
}

/**
 * Send USDC payment on EVM chain (Base, Ethereum, etc.)
 */
export async function sendEvmPayment(
  privateKey: Hex,
  to: Address,
  amountAtomic: string,
  network: string = 'base'
): Promise<PaymentResult> {
  const chainConfig = CHAIN_CONFIGS[network as keyof typeof CHAIN_CONFIGS];
  const usdcAddress = USDC_ADDRESSES[network];

  if (!chainConfig || !usdcAddress) {
    return {
      success: false,
      error: `Unsupported EVM network: ${network}`,
      network,
      simulated: false,
    };
  }

  try {
    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: chainConfig.chain as typeof base,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain as typeof base,
      transport: http(),
    });

    console.log(`[MultiChain] Sending ${formatUnits(BigInt(amountAtomic), 6)} USDC on ${network} to ${to}`);

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
        simulated: false,
      };
    }

    // Send transfer
    const hash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amountAtomic)],
    });

    console.log(`[MultiChain] TX submitted on ${network}: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    return {
      success: receipt.status === 'success',
      txHash: hash,
      network,
      simulated: false,
      error: receipt.status !== 'success' ? 'Transaction reverted' : undefined,
    };
  } catch (error) {
    console.error(`[MultiChain] EVM payment failed on ${network}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'EVM payment failed',
      network,
      simulated: false,
    };
  }
}

/**
 * Send USDC payment on Solana
 */
export async function sendSolanaPayment(
  privateKeyBase58: string,
  to: string,
  amountAtomic: string,
  network: string = 'solana'
): Promise<PaymentResult> {
  try {
    const isDevnet = network.includes('devnet');
    const connection = new Connection(
      isDevnet ? clusterApiUrl('devnet') : 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    // Decode private key
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    const fromPubkey = keypair.publicKey;
    const toPubkey = new PublicKey(to);
    const usdcMint = isDevnet ? SOLANA_USDC_DEVNET : SOLANA_USDC_MINT;

    console.log(`[MultiChain] Sending ${Number(amountAtomic) / 1e6} USDC on ${network} to ${to}`);

    // Get associated token accounts
    const fromAta = await getAssociatedTokenAddress(usdcMint, fromPubkey);
    const toAta = await getAssociatedTokenAddress(usdcMint, toPubkey);

    // Check balance
    const fromAccount = await connection.getTokenAccountBalance(fromAta);
    const balance = BigInt(fromAccount.value.amount);

    if (balance < BigInt(amountAtomic)) {
      return {
        success: false,
        error: `Insufficient USDC on ${network}. Have: ${Number(balance) / 1e6}, Need: ${Number(amountAtomic) / 1e6}`,
        network,
        simulated: false,
      };
    }

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      fromAta,
      toAta,
      fromPubkey,
      BigInt(amountAtomic),
      [],
      TOKEN_PROGRAM_ID
    );

    // Build and send transaction
    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    transaction.sign(keypair);

    const signature = await connection.sendRawTransaction(transaction.serialize());

    console.log(`[MultiChain] TX submitted on ${network}: ${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      success: true,
      txHash: signature,
      network,
      simulated: false,
    };
  } catch (error) {
    console.error(`[MultiChain] Solana payment failed on ${network}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Solana payment failed',
      network,
      simulated: false,
    };
  }
}

/**
 * Send USDC payment on any supported network
 */
export async function sendPayment(
  wallets: WalletInfo,
  to: string,
  amountAtomic: string,
  network: string
): Promise<PaymentResult> {
  const normalizedNetwork = network.toLowerCase();

  // Route to appropriate chain
  if (normalizedNetwork.includes('solana')) {
    return sendSolanaPayment(
      wallets.solana.privateKey,
      to,
      amountAtomic,
      normalizedNetwork
    );
  }

  // EVM chains (Base, Ethereum, etc.)
  return sendEvmPayment(
    wallets.evm.privateKey as Hex,
    to as Address,
    amountAtomic,
    normalizedNetwork
  );
}

/**
 * Simulate payment (for demo when no funds available)
 */
export function simulatePayment(network: string): PaymentResult {
  return {
    success: true,
    txHash: `0xsim_${network}_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
    network,
    simulated: true,
  };
}

/**
 * Get USDC balance on a network
 */
export async function getBalance(
  wallets: WalletInfo,
  network: string
): Promise<{ balance: string; formatted: string }> {
  const normalizedNetwork = network.toLowerCase();

  try {
    if (normalizedNetwork.includes('solana')) {
      const isDevnet = normalizedNetwork.includes('devnet');
      const connection = new Connection(
        isDevnet ? clusterApiUrl('devnet') : 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      const pubkey = new PublicKey(wallets.solana.address);
      const usdcMint = isDevnet ? SOLANA_USDC_DEVNET : SOLANA_USDC_MINT;
      const ata = await getAssociatedTokenAddress(usdcMint, pubkey);

      try {
        const account = await connection.getTokenAccountBalance(ata);
        return {
          balance: account.value.amount,
          formatted: (Number(account.value.amount) / 1e6).toFixed(2),
        };
      } catch {
        return { balance: '0', formatted: '0.00' };
      }
    }

    // EVM chains
    const chainConfig = CHAIN_CONFIGS[normalizedNetwork as keyof typeof CHAIN_CONFIGS];
    const usdcAddress = USDC_ADDRESSES[normalizedNetwork];

    if (!chainConfig || !usdcAddress) {
      return { balance: '0', formatted: '0.00' };
    }

    const publicClient = createPublicClient({
      chain: chainConfig.chain as typeof base,
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallets.evm.address as Address],
    }) as bigint;

    return {
      balance: balance.toString(),
      formatted: formatUnits(balance, 6),
    };
  } catch (error) {
    console.error(`[MultiChain] Failed to get balance on ${network}:`, error);
    return { balance: '0', formatted: '0.00' };
  }
}

/**
 * Format amount for display
 */
export function formatUsdcAmount(atomicAmount: string): string {
  return (Number(atomicAmount) / 1e6).toFixed(2);
}
