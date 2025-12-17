/**
 * Arc Agent Compliance Oracle
 *
 * Bridges Circle Compliance Engine to the ArcComplianceOracle contract.
 *
 * Usage:
 *   npm run dev                    # Development mode with hot reload
 *   npm run build && npm start     # Production mode
 *
 * Environment Variables:
 *   ARC_RPC_URL                    - Arc network RPC endpoint
 *   ARC_CHAIN_ID                   - Chain ID (default: 5042002 for testnet)
 *   ORACLE_PRIVATE_KEY             - Private key for the oracle (must be authorized)
 *   ARC_COMPLIANCE_ORACLE_ADDRESS  - ArcComplianceOracle contract address
 *   CIRCLE_API_KEY                 - Circle API key (optional, uses mock if not set)
 *   CIRCLE_BASE_URL                - Circle API base URL (optional)
 *   POLLING_INTERVAL               - Event polling interval in ms (default: 5000)
 */

import 'dotenv/config';
import { ComplianceOracleService } from './oracle-service.js';
import type { Hash, Address } from 'viem';

// Export for programmatic use
export { ComplianceOracleService } from './oracle-service.js';
export {
  CircleComplianceClient,
  MockCircleComplianceClient,
  type ScreeningResponse,
  type RiskCategory,
  type RiskLevel,
  type RiskSignal,
} from './circle-compliance.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Arc Agent Compliance Oracle');
  console.log('='.repeat(60));

  // Validate required environment variables
  const requiredEnvVars = [
    'ARC_RPC_URL',
    'ORACLE_PRIVATE_KEY',
    'ARC_COMPLIANCE_ORACLE_ADDRESS',
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error('\nCopy .env.example to .env and configure the values.');
    process.exit(1);
  }

  // Create and start the oracle service
  const service = new ComplianceOracleService({
    rpcUrl: process.env.ARC_RPC_URL!,
    chainId: parseInt(process.env.ARC_CHAIN_ID || '5042002'),
    oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY as Hash,
    oracleContractAddress: process.env.ARC_COMPLIANCE_ORACLE_ADDRESS as Address,
    circleApiKey: process.env.CIRCLE_API_KEY,
    circleBaseUrl: process.env.CIRCLE_BASE_URL,
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000'),
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    service.stop();
    process.exit(0);
  });

  try {
    await service.start();

    // Keep the process running
    console.log('\nOracle is running. Press Ctrl+C to stop.\n');

    // Optional: Run a manual test screen
    if (process.env.TEST_ADDRESS) {
      console.log(`\nRunning test screening for ${process.env.TEST_ADDRESS}...`);
      const result = await service.manualScreen(process.env.TEST_ADDRESS as Address);
      console.log('Test result:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Failed to start oracle service:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main().catch(console.error);
