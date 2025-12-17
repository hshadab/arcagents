import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { bazaar, type X402Service, type ServiceCategory } from '@arc-agent/sdk';

export const servicesCommand = new Command('services')
  .description('Browse and search x402 services from Bazaar');

// List all services
servicesCommand
  .command('list')
  .description('List available x402 services')
  .option('-c, --category <category>', 'Filter by category (data, ai, compute, storage, oracle, api)')
  .option('-n, --network <network>', 'Filter by network')
  .option('-m, --max-price <price>', 'Filter by max price in USDC')
  .option('-l, --limit <number>', 'Limit results', '20')
  .action(async (options) => {
    const spinner = ora('Fetching x402 services from Bazaar...').start();

    try {
      const services = await bazaar.listServices({
        category: options.category as ServiceCategory,
        network: options.network,
        maxPrice: options.maxPrice,
        limit: parseInt(options.limit),
      });

      spinner.stop();

      if (services.length === 0) {
        console.log(chalk.yellow('No services found matching your criteria.'));
        return;
      }

      console.log(chalk.bold(`\nFound ${services.length} x402 services:\n`));

      for (const service of services) {
        printService(service);
      }
    } catch (error) {
      spinner.fail('Failed to fetch services');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Search services
servicesCommand
  .command('search <query>')
  .description('Search for x402 services')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (query: string, options) => {
    const spinner = ora(`Searching for "${query}"...`).start();

    try {
      const services = await bazaar.searchServices(query, {
        limit: parseInt(options.limit),
      });

      spinner.stop();

      if (services.length === 0) {
        console.log(chalk.yellow(`No services found for "${query}".`));
        return;
      }

      console.log(chalk.bold(`\nFound ${services.length} services matching "${query}":\n`));

      for (const service of services) {
        printService(service);
      }
    } catch (error) {
      spinner.fail('Search failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Get service details
servicesCommand
  .command('info <url>')
  .description('Get details for a specific service')
  .action(async (url: string) => {
    const spinner = ora('Fetching service details...').start();

    try {
      // First try to find in Bazaar
      let service = await bazaar.getService(url);

      // If not found, try probing the endpoint directly
      if (!service) {
        spinner.text = 'Service not in Bazaar, probing endpoint...';
        service = await bazaar.probeEndpoint(url);
      }

      spinner.stop();

      if (!service) {
        console.log(chalk.yellow('Service not found or does not support x402.'));
        return;
      }

      console.log(chalk.bold('\nService Details:\n'));
      printServiceDetailed(service);
    } catch (error) {
      spinner.fail('Failed to get service details');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Probe an endpoint for x402 support
servicesCommand
  .command('probe <url>')
  .description('Check if an endpoint supports x402 payments')
  .action(async (url: string) => {
    const spinner = ora(`Probing ${url}...`).start();

    try {
      const service = await bazaar.probeEndpoint(url);

      spinner.stop();

      if (service) {
        console.log(chalk.green('\n✓ Endpoint supports x402 payments!\n'));
        printServiceDetailed(service);
      } else {
        console.log(chalk.yellow('\n✗ Endpoint does not appear to support x402 payments.'));
      }
    } catch (error) {
      spinner.fail('Probe failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

function printService(service: X402Service) {
  const categoryIcon = getCategoryIcon(service.category);
  const priceStr = chalk.green(`$${service.price}`);

  console.log(`${categoryIcon} ${chalk.bold(service.name)}`);
  console.log(`   ${chalk.dim(service.url)}`);
  console.log(`   ${priceStr}/req  •  ${chalk.dim(service.network)}`);
  if (service.description) {
    console.log(`   ${chalk.dim(service.description.slice(0, 60))}${service.description.length > 60 ? '...' : ''}`);
  }
  console.log();
}

function printServiceDetailed(service: X402Service) {
  console.log(`${chalk.bold('Name:')}     ${service.name}`);
  console.log(`${chalk.bold('URL:')}      ${service.url}`);
  console.log(`${chalk.bold('Price:')}    ${chalk.green(`$${service.price}`)} (${service.priceAtomic} atomic)`);
  console.log(`${chalk.bold('Asset:')}    ${service.asset}`);
  console.log(`${chalk.bold('Network:')}  ${service.network}`);
  console.log(`${chalk.bold('Pay To:')}   ${service.payTo}`);
  console.log(`${chalk.bold('Category:')} ${service.category || 'unknown'}`);
  if (service.description) {
    console.log(`${chalk.bold('Description:')} ${service.description}`);
  }
}

function getCategoryIcon(category?: string): string {
  switch (category) {
    case 'data': return '📊';
    case 'ai': return '🧠';
    case 'compute': return '⚡';
    case 'storage': return '💾';
    case 'oracle': return '🔮';
    case 'api': return '🔌';
    default: return '📦';
  }
}
