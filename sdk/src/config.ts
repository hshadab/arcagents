import type { Address } from 'viem';
import type { NetworkConfig } from './types';

/**
 * Contract addresses for Arc networks.
 *
 * These are placeholder addresses that should be updated after deployment.
 * You can either:
 * 1. Update these directly after deploying contracts
 * 2. Use environment variables (ARC_AGENT_ADDRESS, etc.)
 * 3. Pass addresses when creating the ArcAgentClient
 */

// Placeholder addresses (all zeros) - update after deployment
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Load contract addresses from environment variables if available
 */
function getEnvAddress(key: string, fallback: Address = ZERO_ADDRESS): Address {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as Address;
  }
  return fallback;
}

/**
 * Arc Testnet configuration
 */
export const ARC_TESTNET_CONFIG: NetworkConfig = {
  chainId: 1134,
  name: 'Arc Testnet',
  rpcUrl: process.env?.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.dev',
  contracts: {
    arcAgent: getEnvAddress('ARC_AGENT_ADDRESS'),
    arcIdentity: getEnvAddress('ARC_IDENTITY_ADDRESS'),
    arcReputation: getEnvAddress('ARC_REPUTATION_ADDRESS'),
    arcProofAttestation: getEnvAddress('ARC_PROOF_ATTESTATION_ADDRESS'),
    arcTreasury: getEnvAddress('ARC_TREASURY_ADDRESS'),
    arcComplianceOracle: getEnvAddress('ARC_COMPLIANCE_ORACLE_ADDRESS'),
    usdc: getEnvAddress('ARC_USDC_ADDRESS'),
  },
  explorer: 'https://testnet.arcscan.app',
};

/**
 * Arc Mainnet configuration
 */
export const ARC_MAINNET_CONFIG: NetworkConfig = {
  chainId: 1135,
  name: 'Arc Mainnet',
  rpcUrl: process.env?.ARC_MAINNET_RPC || 'https://rpc.arc.dev',
  contracts: {
    arcAgent: getEnvAddress('ARC_AGENT_ADDRESS_MAINNET'),
    arcIdentity: getEnvAddress('ARC_IDENTITY_ADDRESS_MAINNET'),
    arcReputation: getEnvAddress('ARC_REPUTATION_ADDRESS_MAINNET'),
    arcProofAttestation: getEnvAddress('ARC_PROOF_ATTESTATION_ADDRESS_MAINNET'),
    arcTreasury: getEnvAddress('ARC_TREASURY_ADDRESS_MAINNET'),
    arcComplianceOracle: getEnvAddress('ARC_COMPLIANCE_ORACLE_ADDRESS_MAINNET'),
    usdc: getEnvAddress('ARC_USDC_ADDRESS_MAINNET'),
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
