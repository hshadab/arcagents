import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getAgentClient } from '../utils/config';
import { bazaar } from '@arc-agent/sdk';

export const callCommand = new Command('call')
  .description('Make a paid request using an agent');

callCommand
  .command('request <agent-id> <url>')
  .description('Make an x402 paid request')
  .option('-m, --method <method>', 'HTTP method', 'GET')
  .option('-d, --data <json>', 'Request body (JSON)')
  .option('-H, --header <header...>', 'Additional headers (key:value)')
  .option('-p, --path <path>', 'Additional path to append to URL')
  .option('-o, --output <file>', 'Write response to file')
  .option('--raw', 'Output raw response without formatting')
  .action(async (agentId: string, url: string, options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Preparing request...').start();

    try {
      const client = await getAgentClient();

      // Verify agent exists
      const agent = await client.getAgent(agentId);
      if (!agent) {
        spinner.fail(`Agent #${agentId} not found`);
        process.exit(1);
      }

      // Check balance
      const balance = await client.getBalance(agentId);

      // Probe service for price
      spinner.text = 'Checking service price...';
      const service = await bazaar.probeEndpoint(url);

      if (service) {
        const price = parseFloat(service.price);
        const available = parseFloat(balance.available);

        if (available < price) {
          spinner.fail(`Insufficient balance. Need $${service.price}, have $${balance.available}`);
          process.exit(1);
        }

        spinner.text = `Making paid request ($${service.price})...`;
      } else {
        spinner.text = 'Making request...';
      }

      // Create x402 client for agent
      const x402Client = client.createX402Client(agentId);

      // Build full URL
      const fullUrl = options.path ? `${url}${options.path}` : url;

      // Parse headers
      const headers: Record<string, string> = {};
      if (options.header) {
        for (const h of options.header) {
          const [key, ...valueParts] = h.split(':');
          headers[key.trim()] = valueParts.join(':').trim();
        }
      }

      // Make request
      const response = await x402Client.fetch(fullUrl, {
        method: options.method,
        headers,
        body: options.data,
      });

      spinner.stop();

      if (!response.ok) {
        console.log(chalk.red(`\nRequest failed: ${response.status} ${response.statusText}`));
        const errorBody = await response.text();
        if (errorBody) {
          console.log(chalk.dim(errorBody));
        }
        process.exit(1);
      }

      // Parse response
      const contentType = response.headers.get('content-type') || '';
      let body: any;

      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // Check for payment info
      const paymentResponse = response.headers.get('payment-response')
        || response.headers.get('x-payment-response');

      console.log(chalk.green('\n✓ Request successful'));

      if (paymentResponse) {
        try {
          // Use Buffer for Node.js compatibility (replaces atob)
          const payment = JSON.parse(Buffer.from(paymentResponse, 'base64').toString('utf-8'));
          console.log(chalk.dim(`  Paid: $${(parseInt(payment.amount) / 1_000_000).toFixed(6)} USDC`));
          if (payment.txHash) {
            console.log(chalk.dim(`  Tx: ${payment.txHash}`));
          }
        } catch {
          // Ignore parse errors
        }
      }

      console.log();

      // Output response
      if (options.raw) {
        console.log(typeof body === 'string' ? body : JSON.stringify(body));
      } else if (typeof body === 'object') {
        console.log(chalk.bold('Response:'));
        console.log(JSON.stringify(body, null, 2));
      } else {
        console.log(chalk.bold('Response:'));
        console.log(body);
      }

      // Write to file if requested
      if (options.output) {
        const fs = await import('fs');
        const content = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        fs.writeFileSync(options.output, content);
        console.log(chalk.dim(`\nWritten to ${options.output}`));
      }

    } catch (error) {
      spinner.fail('Request failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Interactive service browser + call
callCommand
  .command('browse <agent-id>')
  .description('Browse services and make a request')
  .action(async (agentId: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const inquirer = await import('inquirer');
    const spinner = ora('Fetching available services...').start();

    try {
      const services = await bazaar.listServices({ limit: 20 });
      spinner.stop();

      if (services.length === 0) {
        console.log(chalk.yellow('No services available.'));
        return;
      }

      const { service } = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'service',
          message: 'Select a service:',
          choices: services.map(s => ({
            name: `${s.name} - $${s.price}/req`,
            value: s,
          })),
        },
      ]);

      const { path } = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Path (optional):',
          default: '',
        },
      ]);

      const { confirm } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Make request to ${service.name} for $${service.price}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        console.log('Cancelled.');
        return;
      }

      // Execute request
      const callSpinner = ora('Making paid request...').start();

      const client = await getAgentClient();
      const x402Client = client.createX402Client(agentId);
      const fullUrl = path ? `${service.url}${path}` : service.url;

      const response = await x402Client.fetch(fullUrl);

      if (!response.ok) {
        callSpinner.fail(`Request failed: ${response.status}`);
        return;
      }

      const body = await response.json();
      callSpinner.succeed('Request successful!');

      console.log();
      console.log(chalk.bold('Response:'));
      console.log(JSON.stringify(body, null, 2));

    } catch (error) {
      spinner.fail('Failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
