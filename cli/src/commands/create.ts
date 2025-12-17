import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig, getAgentClient } from '../utils/config';

export const createCommand = new Command('create')
  .description('Spawn a new Arc Agent');

createCommand
  .command('agent')
  .description('Create a new Arc Agent')
  .option('-n, --name <name>', 'Agent name')
  .option('-w, --wallet <address>', 'Circle wallet address')
  .option('-d, --deposit <amount>', 'Initial USDC deposit')
  .option('-s, --service <url>', 'x402 service URL to connect to')
  .option('--interactive', 'Interactive mode', false)
  .action(async (options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    let agentConfig = {
      name: options.name,
      walletAddress: options.wallet,
      initialDeposit: options.deposit,
    };

    // Interactive mode
    if (options.interactive || !options.name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Agent name:',
          default: options.name || `agent-${Date.now()}`,
        },
        {
          type: 'input',
          name: 'walletAddress',
          message: 'Circle wallet address (leave empty to use your address):',
          default: options.wallet || '',
        },
        {
          type: 'input',
          name: 'initialDeposit',
          message: 'Initial USDC deposit:',
          default: options.deposit || '0',
        },
        {
          type: 'confirm',
          name: 'connectService',
          message: 'Connect to an x402 service?',
          default: !!options.service,
        },
      ]);

      agentConfig = { ...agentConfig, ...answers };

      if (answers.connectService && !options.service) {
        const serviceAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'service',
            message: 'x402 service URL:',
          },
        ]);
        options.service = serviceAnswer.service;
      }
    }

    const spinner = ora('Creating Arc Agent...').start();

    try {
      const client = await getAgentClient();

      const agent = await client.createAgent({
        name: agentConfig.name,
        walletAddress: agentConfig.walletAddress as `0x${string}` | undefined,
        initialDeposit: agentConfig.initialDeposit,
      });

      spinner.succeed('Arc Agent created!');

      console.log();
      console.log(chalk.bold('Agent Details:'));
      console.log(`  ${chalk.dim('ID:')}        ${agent.id}`);
      console.log(`  ${chalk.dim('Global ID:')} ${agent.globalId}`);
      console.log(`  ${chalk.dim('Name:')}      ${agent.name}`);
      console.log(`  ${chalk.dim('Wallet:')}    ${agent.walletAddress}`);
      console.log(`  ${chalk.dim('KYC:')}       ${getKycStatusText(agent.kycStatus)}`);

      if (agentConfig.initialDeposit && parseFloat(agentConfig.initialDeposit) > 0) {
        console.log(`  ${chalk.dim('Deposited:')} ${chalk.green(`$${agentConfig.initialDeposit} USDC`)}`);
      }

      console.log();
      console.log(chalk.dim('Next steps:'));
      console.log(`  • Fund your agent: ${chalk.cyan(`arc-agent fund ${agent.id} <amount>`)}`);
      console.log(`  • Make a paid call: ${chalk.cyan(`arc-agent call ${agent.id} <service-url>`)}`);
      console.log(`  • Check status: ${chalk.cyan(`arc-agent status ${agent.id}`)}`);

    } catch (error) {
      spinner.fail('Failed to create agent');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Quick spawn from service URL
createCommand
  .command('for-service <service-url>')
  .description('Spawn an agent configured for a specific x402 service')
  .option('-n, --name <name>', 'Agent name')
  .option('-d, --deposit <amount>', 'Initial USDC deposit', '1')
  .action(async (serviceUrl: string, options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Creating agent for service...').start();

    try {
      const { bazaar } = await import('@arc-agent/sdk');

      // Probe service to verify it supports x402
      spinner.text = 'Verifying service supports x402...';
      const service = await bazaar.probeEndpoint(serviceUrl);

      if (!service) {
        spinner.fail('Service does not support x402 payments');
        process.exit(1);
      }

      spinner.text = 'Creating Arc Agent...';
      const client = await getAgentClient();

      const agentName = options.name || `${service.name}-agent`;

      const agent = await client.createAgent({
        name: agentName,
        initialDeposit: options.deposit,
        metadata: {
          connectedService: serviceUrl,
          serviceName: service.name,
        },
      });

      spinner.succeed('Agent created for service!');

      console.log();
      console.log(chalk.bold('Agent Details:'));
      console.log(`  ${chalk.dim('ID:')}        ${agent.id}`);
      console.log(`  ${chalk.dim('Name:')}      ${agent.name}`);
      console.log(`  ${chalk.dim('Service:')}   ${service.name} (${chalk.green(`$${service.price}/req`)})`);
      console.log(`  ${chalk.dim('Balance:')}   ${chalk.green(`$${options.deposit} USDC`)}`);

      console.log();
      console.log(chalk.dim('Make a request:'));
      console.log(`  ${chalk.cyan(`arc-agent call ${agent.id} ${serviceUrl}`)}`);

    } catch (error) {
      spinner.fail('Failed to create agent');
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
