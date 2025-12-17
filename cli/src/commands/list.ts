import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getAgentClient } from '../utils/config';

export const listCommand = new Command('list')
  .description('List your Arc Agents');

listCommand
  .command('agents')
  .alias('all')
  .description('List all your agents')
  .option('-o, --owner <address>', 'Filter by owner address')
  .action(async (options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching agents...').start();

    try {
      const client = await getAgentClient();
      const agents = await client.listAgents(options.owner as `0x${string}` | undefined);

      spinner.stop();

      if (agents.length === 0) {
        console.log(chalk.yellow('\nNo agents found.'));
        console.log(chalk.dim('Create one with: arc-agent create agent'));
        return;
      }

      console.log(chalk.bold(`\nYour Arc Agents (${agents.length}):\n`));

      for (const agent of agents) {
        const balance = await client.getBalance(agent.id);
        printAgentRow(agent, balance.available);
      }
    } catch (error) {
      spinner.fail('Failed to fetch agents');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

function printAgentRow(agent: any, balance: string) {
  const statusIcon = getKycIcon(agent.kycStatus);
  const balanceStr = chalk.green(`$${balance}`);

  console.log(`${statusIcon} ${chalk.bold(agent.name)} ${chalk.dim(`(#${agent.id})`)}`);
  console.log(`   ${chalk.dim('Balance:')} ${balanceStr}  ${chalk.dim('•')}  ${chalk.dim('KYC:')} ${getKycStatusText(agent.kycStatus)}`);
  console.log(`   ${chalk.dim(agent.globalId)}`);
  console.log();
}

function getKycIcon(status: number): string {
  switch (status) {
    case 0: return '○';
    case 1: return chalk.yellow('◐');
    case 2: return chalk.green('●');
    case 3: return chalk.red('●');
    default: return '○';
  }
}

function getKycStatusText(status: number): string {
  switch (status) {
    case 0: return chalk.dim('None');
    case 1: return chalk.yellow('Pending');
    case 2: return chalk.green('Approved');
    case 3: return chalk.red('Rejected');
    default: return chalk.dim('Unknown');
  }
}
