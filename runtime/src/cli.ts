/**
 * Arc Agent CLI - Interactive agent management
 *
 * Usage:
 *   npx tsx src/cli.ts run <agent-id>     Run an agent once
 *   npx tsx src/cli.ts test <service-url> Test an x402 service
 *   npx tsx src/cli.ts balance <address>  Check wallet balance
 */

import 'dotenv/config';
import { createPublicClient, http, formatUnits, type Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { executeAgent, getAgentStats } from './runner.js';
import type { AgentRuntimeConfig } from './types.js';

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

const CHAINS: Record<string, Chain> = {
  'base': base,
  'base-sepolia': baseSepolia,
};

const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

async function checkBalance(address: string, network: string = 'base') {
  const chain = CHAINS[network];
  if (!chain) {
    console.error(`Unknown network: ${network}`);
    return;
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const usdcAddress = USDC_ADDRESSES[network];
  if (!usdcAddress) {
    console.error(`USDC not configured for ${network}`);
    return;
  }

  console.log(`Checking balance on ${network}...`);
  console.log(`Address: ${address}`);
  console.log(`USDC Contract: ${usdcAddress}`);

  try {
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    console.log(`Balance: ${formatUnits(balance, 6)} USDC`);
  } catch (error) {
    console.error('Failed to check balance:', error);
  }
}

async function testService(serviceUrl: string) {
  console.log(`Testing x402 service: ${serviceUrl}`);

  try {
    // First, make a request without payment to get the 402 response
    const response = await fetch(serviceUrl);

    if (response.status === 402) {
      console.log('Service requires payment (402)');

      const wwwAuth = response.headers.get('www-authenticate');
      if (wwwAuth) {
        console.log('\nPayment Requirements:');
        console.log(wwwAuth);
      }

      // Try to parse x402 payment info from response body
      try {
        const body = await response.json();
        console.log('\nPayment Details:');
        console.log(JSON.stringify(body, null, 2));
      } catch {
        console.log('(No JSON body in 402 response)');
      }
    } else if (response.ok) {
      console.log('Service returned OK without payment');
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log(`Service returned status ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to test service:', error);
  }
}

async function runAgent(agentId: string) {
  const configJson = process.env.AGENT_CONFIGS;
  if (!configJson) {
    console.error('AGENT_CONFIGS environment variable not set');
    console.log('\nExample config:');
    console.log(JSON.stringify(getExampleConfig(), null, 2));
    return;
  }

  let configs: AgentRuntimeConfig[];
  try {
    configs = JSON.parse(configJson);
  } catch {
    console.error('Failed to parse AGENT_CONFIGS');
    return;
  }

  const config = configs.find(c => c.id === agentId);
  if (!config) {
    console.error(`Agent not found: ${agentId}`);
    console.log('Available agents:', configs.map(c => c.id).join(', '));
    return;
  }

  console.log(`Running agent: ${config.name} (${config.id})`);
  const result = await executeAgent(config);

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Duration: ${result.durationMs}ms`);

  if (result.amountPaid) {
    console.log(`  Amount Paid: ${formatUnits(BigInt(result.amountPaid), 6)} USDC`);
  }

  if (result.proofHash) {
    console.log(`  Proof Hash: ${result.proofHash}`);
  }

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.serviceResponse) {
    console.log('\nService Response:');
    console.log(JSON.stringify(result.serviceResponse, null, 2));
  }
}

function getExampleConfig(): AgentRuntimeConfig {
  return {
    id: 'example-agent-1',
    name: 'Example DeFi Monitor',
    owner: '0x0000000000000000000000000000000000000000',
    walletAddress: '0x0000000000000000000000000000000000000000',
    privateKeyEnvVar: 'AGENT_EXAMPLE_KEY',
    // Services: fetch (data retrieval) then action (execution)
    services: [
      {
        type: 'fetch',
        url: 'https://example.x402.org/api/defi-pools',
        name: 'DeFi Pool Data',
        priceAtomic: '10000', // 0.01 USDC
        network: 'base',
        payTo: '0x0000000000000000000000000000000000000000',
        method: 'GET',
        order: 1,
      },
      {
        type: 'action',
        url: 'https://example.x402.org/api/rebalance',
        name: 'Portfolio Rebalance',
        priceAtomic: '50000', // 0.05 USDC
        network: 'base',
        payTo: '0x0000000000000000000000000000000000000000',
        method: 'POST',
        order: 2,
      },
    ],
    // Local decision model - runs BEFORE action services
    decisionModel: {
      modelId: 'defi-opportunity-detector',
      modelHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      modelPath: './models/defi-opportunity.onnx',
      threshold: 0.7, // Only act if model output >= 0.7
      description: 'Detects profitable DeFi opportunities from pool data',
    },
    schedule: {
      mode: 'scheduled',
      cron: '0 * * * *', // Every hour
      timezone: 'UTC',
      maxRunsPerDay: 24,
    },
    zkml: {
      enabled: true,
      modelHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      proofType: 'decision',
      submitOnChain: true,
    },
    limits: {
      perTransaction: '100000', // 0.1 USDC
      daily: '1000000', // 1 USDC
      pauseThreshold: '50000', // 0.05 USDC
    },
    status: 'active',
    createdAt: Date.now(),
  };
}

function showHelp() {
  console.log(`
Arc Agent CLI

Commands:
  run <agent-id>              Run a specific agent
  test <service-url>          Test an x402 service (check payment requirements)
  balance <address> [network] Check USDC balance (default: base)
  example                     Show example agent config
  help                        Show this help

Networks: base, base-sepolia

Environment Variables:
  AGENT_CONFIGS    JSON array of agent configurations
  AGENT_*_KEY      Private keys for each agent

Examples:
  npx tsx src/cli.ts run my-agent-1
  npx tsx src/cli.ts test https://api.example.com/data
  npx tsx src/cli.ts balance 0x1234... base-sepolia
`);
}

// Main CLI
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'run':
    if (!args[0]) {
      console.error('Please provide an agent ID');
      process.exit(1);
    }
    runAgent(args[0]);
    break;

  case 'test':
    if (!args[0]) {
      console.error('Please provide a service URL');
      process.exit(1);
    }
    testService(args[0]);
    break;

  case 'balance':
    if (!args[0]) {
      console.error('Please provide an address');
      process.exit(1);
    }
    checkBalance(args[0], args[1] || 'base');
    break;

  case 'example':
    console.log('Example Agent Configuration:');
    console.log(JSON.stringify(getExampleConfig(), null, 2));
    break;

  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
