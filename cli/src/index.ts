#!/usr/bin/env node
import { Command } from 'commander';
import { servicesCommand } from './commands/services';
import { createCommand } from './commands/create';
import { listCommand } from './commands/list';
import { fundCommand } from './commands/fund';
import { statusCommand } from './commands/status';
import { callCommand } from './commands/call';
import { configCommand } from './commands/config';
import { proofCommand } from './commands/proof';

const program = new Command();

program
  .name('arc-agent')
  .description('CLI for spawning and managing Arc Agents with x402 payment capabilities')
  .version('0.1.0');

// Add all commands directly
program.addCommand(servicesCommand);
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(fundCommand);
program.addCommand(statusCommand);
program.addCommand(callCommand);
program.addCommand(configCommand);
program.addCommand(proofCommand);

program.parse();
