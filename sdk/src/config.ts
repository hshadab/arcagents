import type { Address } from 'viem';
import type { NetworkConfig } from './types';

/**
 * Contract addresses for Arc networks.
 *
 * These are the deployed contract addresses on Arc Testnet.
 * Environment variables can override these defaults.
 */

// Zero address for comparison/validation
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Deployed contract addresses on Arc Testnet (Chain ID: 5042002)
 */
const ARC_TESTNET_CONTRACTS = {
  arcAgent: '0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384' as Address,
  arcIdentity: '0x60287b849721EB7ed3C6BbdB34B46be02E0e2678' as Address,
  arcReputation: '0x106e73c96da621826d6923faA3361004e2db72a7' as Address,
  arcProofAttestation: '0xBE9a5DF7C551324CB872584C6E5bF56799787952' as Address,
  arcTreasury: '0x75E016aC75678344275fd47d6524433B81e46d0B' as Address,
  arcComplianceOracle: '0xdB4E18Cc9290a234eB128f1321643B6c1B5936d1' as Address,
  usdc: ZERO_ADDRESS, // Set via ARC_USDC_ADDRESS env var
} as const;

/**
 * USDC contract addresses by network (for x402 payments)
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
};

/**
 * Load contract addresses from environment variables if available
 */
function getEnvAddress(key: string, fallback: Address): Address {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as Address;
  }
  return fallback;
}

/**
 * Arc Testnet configuration (Chain ID: 5042002)
 */
export const ARC_TESTNET_CONFIG: NetworkConfig = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: process.env?.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network',
  contracts: {
    arcAgent: getEnvAddress('ARC_AGENT_ADDRESS', ARC_TESTNET_CONTRACTS.arcAgent),
    arcIdentity: getEnvAddress('ARC_IDENTITY_ADDRESS', ARC_TESTNET_CONTRACTS.arcIdentity),
    arcReputation: getEnvAddress('ARC_REPUTATION_ADDRESS', ARC_TESTNET_CONTRACTS.arcReputation),
    arcProofAttestation: getEnvAddress('ARC_PROOF_ATTESTATION_ADDRESS', ARC_TESTNET_CONTRACTS.arcProofAttestation),
    arcTreasury: getEnvAddress('ARC_TREASURY_ADDRESS', ARC_TESTNET_CONTRACTS.arcTreasury),
    arcComplianceOracle: getEnvAddress('ARC_COMPLIANCE_ORACLE_ADDRESS', ARC_TESTNET_CONTRACTS.arcComplianceOracle),
    usdc: getEnvAddress('ARC_USDC_ADDRESS', ARC_TESTNET_CONTRACTS.usdc),
  },
  explorer: 'https://testnet.arcscan.app',
};

/**
 * Arc Mainnet configuration (Chain ID: 5042001 - not yet live)
 */
export const ARC_MAINNET_CONFIG: NetworkConfig = {
  chainId: 5042001,
  name: 'Arc Mainnet',
  rpcUrl: process.env?.ARC_MAINNET_RPC || 'https://rpc.arc.network',
  contracts: {
    arcAgent: getEnvAddress('ARC_AGENT_ADDRESS_MAINNET', ZERO_ADDRESS),
    arcIdentity: getEnvAddress('ARC_IDENTITY_ADDRESS_MAINNET', ZERO_ADDRESS),
    arcReputation: getEnvAddress('ARC_REPUTATION_ADDRESS_MAINNET', ZERO_ADDRESS),
    arcProofAttestation: getEnvAddress('ARC_PROOF_ATTESTATION_ADDRESS_MAINNET', ZERO_ADDRESS),
    arcTreasury: getEnvAddress('ARC_TREASURY_ADDRESS_MAINNET', ZERO_ADDRESS),
    arcComplianceOracle: getEnvAddress('ARC_COMPLIANCE_ORACLE_ADDRESS_MAINNET', ZERO_ADDRESS),
    usdc: getEnvAddress('ARC_USDC_ADDRESS_MAINNET', ZERO_ADDRESS),
  },
  explorer: 'https://arcscan.app',
};

/**
 * Create a network config with custom contract addresses
 */
export function createNetworkConfig(
  base: NetworkConfig,
  addresses: Partial<NetworkConfig['contracts']>
): NetworkConfig {
  return {
    ...base,
    contracts: {
      ...base.contracts,
      ...addresses,
    },
  };
}

/**
 * Validate that contract addresses are configured (not zero address)
 */
export function validateNetworkConfig(config: NetworkConfig): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const [key, address] of Object.entries(config.contracts)) {
    if (address === ZERO_ADDRESS) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate network config and throw if invalid.
 * Use this at startup to fail fast if configuration is incomplete.
 */
export function requireValidNetworkConfig(config: NetworkConfig, requiredContracts?: string[]): void {
  const { valid, missing } = validateNetworkConfig(config);

  // If specific contracts required, only check those
  const toCheck = requiredContracts ?? Object.keys(config.contracts);
  const actuallyMissing = missing.filter(m => toCheck.includes(m));

  if (actuallyMissing.length > 0) {
    throw new Error(
      `Network configuration invalid for ${config.name}: ` +
      `missing addresses for [${actuallyMissing.join(', ')}]. ` +
      `Set via environment variables or update sdk/src/config.ts`
    );
  }
}

/**
 * Get USDC address for a network
 */
export function getUsdcAddressForNetwork(network: string): Address | null {
  return USDC_ADDRESSES[network] ?? null;
}

/**
 * Check if an address is the zero address
 */
export function isZeroAddress(address: Address): boolean {
  return address === ZERO_ADDRESS;
}
