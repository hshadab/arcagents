/**
 * Arc Agent Runtime - Main Entry Point
 *
 * This service runs autonomous agents on a schedule using x402 for payments.
 * Designed to run on Render.com as a cron job or background worker.
 *
 * Usage:
 *   - Cron job: node dist/index.js
 *   - Single agent: node dist/index.js --agent <agent-id>
 */

import 'dotenv/config';
import { executeAgent, getAgentStats, shouldRunNow } from './runner.js';
import type { AgentRuntimeConfig } from './types.js';

// Agent configurations are loaded from environment or a config store
// In production, this would come from a database or Redis
async function loadAgentConfigs(): Promise<AgentRuntimeConfig[]> {
  const configJson = process.env.AGENT_CONFIGS;
  if (!configJson) {
    console.warn('No AGENT_CONFIGS environment variable found');
    return [];
  }

  try {
    return JSON.parse(configJson);
  } catch (error) {
    console.error('Failed to parse AGENT_CONFIGS:', error);
    return [];
  }
}

/**
 * Run all active agents
 */
async function runAllAgents() {
  console.log('='.repeat(60));
  console.log('Arc Agent Runtime - Starting scheduled run');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const configs = await loadAgentConfigs();

  if (configs.length === 0) {
    console.log('No agents configured. Set AGENT_CONFIGS environment variable.');
    return;
  }

  console.log(`Found ${configs.length} agent(s)`);

  const results = [];

  for (const config of configs) {
    if (!shouldRunNow(config)) {
      console.log(`[${config.name}] Skipping - not scheduled to run now`);
      continue;
    }

    console.log('-'.repeat(40));
    const result = await executeAgent(config);
    results.push(result);

    // Update last run time
    config.lastRunAt = Date.now();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Execution Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length} | Success: ${successful} | Failed: ${failed}`);

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    const amount = result.amountPaid
      ? `${(parseInt(result.amountPaid) / 1_000_000).toFixed(4)} USDC`
      : '-';
    console.log(`  [${status}] ${result.agentId} - ${amount} - ${result.durationMs}ms`);
  }

  console.log('='.repeat(60));
}

/**
 * Run a single agent by ID
 */
async function runSingleAgent(agentId: string) {
  console.log(`Running single agent: ${agentId}`);

  const configs = await loadAgentConfigs();
  const config = configs.find(c => c.id === agentId);

  if (!config) {
    console.error(`Agent not found: ${agentId}`);
    process.exit(1);
  }

  const result = await executeAgent(config);

  if (!result.success) {
    console.error('Execution failed:', result.error);
    process.exit(1);
  }

  console.log('Execution successful');
  console.log('Response:', JSON.stringify(result.serviceResponse, null, 2));
}

/**
 * Show stats for all agents
 */
async function showStats() {
  const configs = await loadAgentConfigs();

  console.log('Agent Statistics');
  console.log('='.repeat(60));

  for (const config of configs) {
    const stats = getAgentStats(config);
    console.log(`\n${stats.name} (${stats.agentId})`);
    console.log(`  Status: ${stats.status}`);
    console.log(`  Today: ${stats.todaySpent} / ${stats.dailyLimit} USDC (${stats.todayRuns} runs)`);
    console.log(`  Last run: ${stats.lastRunAt || 'Never'}`);
  }
}

// CLI parsing
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Arc Agent Runtime

Usage:
  node dist/index.js              Run all active agents
  node dist/index.js --agent ID   Run a specific agent
  node dist/index.js --stats      Show agent statistics
  node dist/index.js --help       Show this help

Environment Variables:
  AGENT_CONFIGS    JSON array of agent configurations
  AGENT_*_KEY      Private keys for each agent (referenced in config)

Example AGENT_CONFIGS:
  [
    {
      "id": "agent-1",
      "name": "DeFi Monitor",
      "owner": "0x...",
      "walletAddress": "0x...",
      "privateKeyEnvVar": "AGENT_1_KEY",
      "service": {
        "url": "https://api.example.com/defi-data",
        "name": "DeFi Data Feed",
        "priceAtomic": "10000",
        "network": "base",
        "payTo": "0x..."
      },
      "schedule": {
        "cron": "0 * * * *",
        "maxRunsPerDay": 24
      },
      "limits": {
        "perTransaction": "100000",
        "daily": "1000000",
        "pauseThreshold": "50000"
      },
      "status": "active",
      "createdAt": 1700000000000
    }
  ]
`);
  process.exit(0);
}

if (args.includes('--stats')) {
  showStats().catch(console.error);
} else if (args.includes('--agent')) {
  const agentIndex = args.indexOf('--agent');
  const agentId = args[agentIndex + 1];
  if (!agentId) {
    console.error('Please provide an agent ID: --agent <id>');
    process.exit(1);
  }
  runSingleAgent(agentId).catch(console.error);
} else {
  runAllAgents().catch(console.error);
}
