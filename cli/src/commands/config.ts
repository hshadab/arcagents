import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfig, clearConfig, type CLIConfig } from '../utils/config';
import { ARC_TESTNET, ARC_MAINNET } from '@arc-agent/sdk';

export const configCommand = new Command('config')
  .description('Configure CLI settings');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();

    console.log(chalk.bold('\nArc Agent CLI Configuration\n'));

    console.log(`${chalk.dim('Network:')}     ${config.network || chalk.yellow('Not set')}`);
    console.log(`${chalk.dim('RPC URL:')}     ${config.rpcUrl || chalk.yellow('Default')}`);
    console.log(`${chalk.dim('Private Key:')} ${config.privateKey ? chalk.green('Set (hidden)') : chalk.yellow('Not set')}`);

    console.log();

    if (!config.privateKey) {
      console.log(chalk.yellow('⚠ No wallet configured. Run `arc-agent config set-key` to set up.'));
    }
  });

configCommand
  .command('set-key')
  .description('Set your private key for signing transactions')
  .option('-k, --key <key>', 'Private key (will prompt if not provided)')
  .action(async (options) => {
    let privateKey = options.key;

    if (!privateKey) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'privateKey',
          message: 'Enter your private key:',
          mask: '*',
          validate: (input) => {
            if (!input) return 'Private key is required';
            if (!input.startsWith('0x')) return 'Private key must start with 0x';
            if (input.length !== 66) return 'Private key must be 64 hex characters (+ 0x prefix)';
            return true;
          },
        },
      ]);
      privateKey = answers.privateKey;
    }

    const config = getConfig();
    setConfig({ ...config, privateKey });

    console.log(chalk.green('\n✓ Private key saved.'));
    console.log(chalk.dim('  Your key is stored locally and never transmitted.'));
  });

configCommand
  .command('set-network <network>')
  .description('Set the network (testnet or mainnet)')
  .action((network: string) => {
    if (network !== 'testnet' && network !== 'mainnet') {
      console.log(chalk.red('Network must be "testnet" or "mainnet"'));
      process.exit(1);
    }

    const config = getConfig();
    const networkConfig = network === 'mainnet' ? ARC_MAINNET : ARC_TESTNET;

    setConfig({
      ...config,
      network,
      rpcUrl: networkConfig.rpcUrl,
    });

    console.log(chalk.green(`\n✓ Network set to ${network}`));
    console.log(chalk.dim(`  RPC: ${networkConfig.rpcUrl}`));
  });

configCommand
  .command('set-rpc <url>')
  .description('Set a custom RPC URL')
  .action((url: string) => {
    const config = getConfig();
    setConfig({ ...config, rpcUrl: url });

    console.log(chalk.green('\n✓ RPC URL set.'));
  });

configCommand
  .command('clear')
  .description('Clear all configuration')
  .option('-f, --force', 'Skip confirmation')
  .action(async (options) => {
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear all configuration?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log('Cancelled.');
        return;
      }
    }

    clearConfig();
    console.log(chalk.green('\n✓ Configuration cleared.'));
  });

configCommand
  .command('init')
  .description('Initialize configuration interactively')
  .action(async () => {
    console.log(chalk.bold('\nArc Agent CLI Setup\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: [
          { name: 'Arc Testnet (recommended for development)', value: 'testnet' },
          { name: 'Arc Mainnet', value: 'mainnet' },
        ],
      },
      {
        type: 'password',
        name: 'privateKey',
        message: 'Enter your private key:',
        mask: '*',
        validate: (input) => {
          if (!input) return 'Private key is required';
          if (!input.startsWith('0x')) return 'Private key must start with 0x';
          if (input.length !== 66) return 'Private key must be 64 hex characters (+ 0x prefix)';
          return true;
        },
      },
    ]);

    const networkConfig = answers.network === 'mainnet' ? ARC_MAINNET : ARC_TESTNET;

    setConfig({
      network: answers.network,
      rpcUrl: networkConfig.rpcUrl,
      privateKey: answers.privateKey,
    });

    console.log(chalk.green('\n✓ Configuration saved!'));
    console.log();
    console.log(chalk.dim('Next steps:'));
    console.log(`  • Browse services: ${chalk.cyan('arc-agent services list')}`);
    console.log(`  • Create an agent: ${chalk.cyan('arc-agent create agent')}`);
  });
