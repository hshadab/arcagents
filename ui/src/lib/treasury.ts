// Shared Treasury for all agents
// User funds one wallet, all agents draw from it

import { createPublicClient, http, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export interface Treasury {
  address: string;
  privateKey: string;  // Hex encoded (0x...)
  fundedAt?: number;
}

export interface SpendingPolicy {
  dailyLimitUsdc: number;
  maxSinglePurchaseUsdc: number;
  minSuccessRate: number;
  minBudgetBuffer: number;
}

const TREASURY_KEY = 'arc-treasury';
const SPENDING_POLICY_KEY = 'arc-spending-policy';

// USDC contract addresses
const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function getTreasury(): Treasury | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(TREASURY_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function saveTreasury(treasury: Treasury): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TREASURY_KEY, JSON.stringify({
    ...treasury,
    fundedAt: treasury.fundedAt || Date.now(),
  }));
}

export function clearTreasury(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TREASURY_KEY);
}

export function hasTreasury(): boolean {
  return getTreasury() !== null;
}

/**
 * Get USDC balance of treasury wallet
 */
export async function getTreasuryBalance(
  network: 'base' | 'base-sepolia' = 'base-sepolia'
): Promise<{ balanceUsdc: number; balanceRaw: string }> {
  const treasury = getTreasury();
  if (!treasury) {
    return { balanceUsdc: 0, balanceRaw: '0' };
  }

  try {
    const chain = network === 'base-sepolia' ? baseSepolia : base;
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const usdcAddress = USDC_ADDRESSES[network];
    if (!usdcAddress) {
      console.warn(`[Treasury] No USDC address for network: ${network}`);
      return { balanceUsdc: 0, balanceRaw: '0' };
    }

    const balance = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [treasury.address as `0x${string}`],
    });

    const balanceUsdc = parseFloat(formatUnits(balance, 6)); // USDC has 6 decimals

    return {
      balanceUsdc,
      balanceRaw: balance.toString(),
    };
  } catch (error) {
    console.error('[Treasury] Balance query failed:', error);
    return { balanceUsdc: 0, balanceRaw: '0' };
  }
}

/**
 * Get spending policy for agents
 */
export function getSpendingPolicy(): SpendingPolicy {
  if (typeof window === 'undefined') {
    return getDefaultSpendingPolicy();
  }

  try {
    const saved = localStorage.getItem(SPENDING_POLICY_KEY);
    if (!saved) return getDefaultSpendingPolicy();
    return JSON.parse(saved);
  } catch {
    return getDefaultSpendingPolicy();
  }
}

/**
 * Save spending policy
 */
export function saveSpendingPolicy(policy: SpendingPolicy): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPENDING_POLICY_KEY, JSON.stringify(policy));
}

/**
 * Default spending policy
 */
export function getDefaultSpendingPolicy(): SpendingPolicy {
  return {
    dailyLimitUsdc: 1.0,         // $1/day max
    maxSinglePurchaseUsdc: 0.10, // $0.10 max per purchase
    minSuccessRate: 0.5,         // 50% minimum success rate
    minBudgetBuffer: 0.01,       // Keep $0.01 in treasury
  };
}
