import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getAgentClient } from '../utils/config';

export const fundCommand = new Command('fund')
  .description('Deposit USDC into an agent treasury');

fundCommand
  .command('deposit <agent-id> <amount>')
  .description('Deposit USDC into an agent')
  .action(async (agentId: string, amount: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora(`Depositing $${amount} USDC into agent #${agentId}...`).start();

    try {
      const client = await getAgentClient();

      // Check agent exists
      const agent = await client.getAgent(agentId);
      if (!agent) {
        spinner.fail(`Agent #${agentId} not found`);
        process.exit(1);
      }

      // Get balance before
      const balanceBefore = await client.getBalance(agentId);

      // Deposit
      spinner.text = 'Approving USDC spend...';
      const txHash = await client.deposit(agentId, amount);

      spinner.text = 'Waiting for confirmation...';

      // Get balance after
      const balanceAfter = await client.getBalance(agentId);

      spinner.succeed(`Deposited $${amount} USDC`);

      console.log();
      console.log(`  ${chalk.dim('Agent:')}       ${agent.name} (#${agentId})`);
      console.log(`  ${chalk.dim('Previous:')}    $${balanceBefore.available}`);
      console.log(`  ${chalk.dim('Deposited:')}   ${chalk.green(`+$${amount}`)}`);
      console.log(`  ${chalk.dim('New Balance:')} ${chalk.bold(`$${balanceAfter.available}`)}`);
      console.log(`  ${chalk.dim('Tx Hash:')}     ${txHash}`);

    } catch (error) {
      spinner.fail('Deposit failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

fundCommand
  .command('balance <agent-id>')
  .description('Check agent treasury balance')
  .action(async (agentId: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching balance...').start();

    try {
      const client = await getAgentClient();

      const agent = await client.getAgent(agentId);
      if (!agent) {
        spinner.fail(`Agent #${agentId} not found`);
        process.exit(1);
      }

      const balance = await client.getBalance(agentId);

      spinner.stop();

      console.log();
      console.log(chalk.bold(`${agent.name} (#${agentId}) Treasury`));
      console.log();
      console.log(`  ${chalk.dim('Available:')} ${chalk.green(`$${balance.available}`)}`);
      console.log(`  ${chalk.dim('Pending:')}   $${balance.pending}`);
      console.log(`  ${chalk.dim('Locked:')}    $${balance.locked}`);

    } catch (error) {
      spinner.fail('Failed to fetch balance');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
