import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getAgentClient } from '../utils/config';

export const statusCommand = new Command('status')
  .description('Check agent status and balance');

statusCommand
  .command('agent <agent-id>')
  .alias('get')
  .description('Get detailed status for an agent')
  .action(async (agentId: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching agent status...').start();

    try {
      const client = await getAgentClient();

      const agent = await client.getAgent(agentId);
      if (!agent) {
        spinner.fail(`Agent #${agentId} not found`);
        process.exit(1);
      }

      const balance = await client.getBalance(agentId);
      const eligibility = await client.checkEligibility(agentId);

      spinner.stop();

      console.log();
      console.log(chalk.bold(`Agent: ${agent.name}`));
      console.log(chalk.dim('─'.repeat(40)));
      console.log();

      // Identity
      console.log(chalk.bold('Identity'));
      console.log(`  ${chalk.dim('ID:')}         ${agent.id}`);
      console.log(`  ${chalk.dim('Global ID:')}  ${agent.globalId}`);
      console.log(`  ${chalk.dim('Owner:')}      ${agent.owner}`);
      console.log(`  ${chalk.dim('Wallet:')}     ${agent.walletAddress}`);
      console.log(`  ${chalk.dim('Created:')}    ${new Date(agent.createdAt).toLocaleString()}`);
      console.log();

      // KYC & Compliance
      console.log(chalk.bold('Compliance'));
      console.log(`  ${chalk.dim('KYC Status:')} ${getKycStatusText(agent.kycStatus)}`);
      console.log(`  ${chalk.dim('Eligible:')}   ${eligibility.eligible ? chalk.green('Yes') : chalk.red('No')}`);
      if (!eligibility.eligible) {
        console.log(`  ${chalk.dim('Reason:')}     ${chalk.yellow(eligibility.reason)}`);
      }
      console.log();

      // Treasury
      console.log(chalk.bold('Treasury'));
      console.log(`  ${chalk.dim('Available:')} ${chalk.green(`$${balance.available}`)}`);
      console.log(`  ${chalk.dim('Pending:')}   $${balance.pending}`);
      console.log(`  ${chalk.dim('Locked:')}    $${balance.locked}`);
      console.log();

      // Actions
      if (!eligibility.eligible) {
        console.log(chalk.yellow('⚠ Agent is not eligible for transfers.'));
        if (agent.kycStatus === 0) {
          console.log(chalk.dim('  KYC verification may be required.'));
        }
      }

    } catch (error) {
      spinner.fail('Failed to fetch status');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

statusCommand
  .command('eligibility <agent-id>')
  .description('Check if agent is eligible for transfers')
  .action(async (agentId: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Checking eligibility...').start();

    try {
      const client = await getAgentClient();
      const eligibility = await client.checkEligibility(agentId);

      spinner.stop();

      if (eligibility.eligible) {
        console.log(chalk.green('\n✓ Agent is eligible for transfers.'));
      } else {
        console.log(chalk.red('\n✗ Agent is not eligible for transfers.'));
        console.log(`  ${chalk.dim('Reason:')} ${eligibility.reason}`);
      }

    } catch (error) {
      spinner.fail('Check failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

function getKycStatusText(status: number): string {
  switch (status) {
    case 0: return chalk.dim('None');
    case 1: return chalk.yellow('Pending');
    case 2: return chalk.green('Approved');
    case 3: return chalk.red('Rejected');
    default: return chalk.dim('Unknown');
  }
}
