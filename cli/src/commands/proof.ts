import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, getAgentClient, getPublicClient, getWalletClient, getNetworkConfig } from '../utils/config';
import {
  ZkmlProver,
  ZkmlVerifier,
  ValidationResponse,
  type ProofTag,
  type ZkmlProof,
} from '@arc-agent/sdk';

export const proofCommand = new Command('proof')
  .description('Generate and manage zkML proofs');

// ============================================================================
// proof generate
// ============================================================================

proofCommand
  .command('generate')
  .description('Generate a zkML proof for model inference')
  .requiredOption('-m, --model <path>', 'Path to ONNX model file')
  .requiredOption('-i, --inputs <path>', 'Path to JSON file with model inputs')
  .requiredOption('-t, --tag <type>', 'Proof type: authorization, compliance, or collision_severity')
  .option('-o, --output <path>', 'Output path for generated proof (default: ./proof.json)')
  .option('--jolt-atlas <path>', 'Path to jolt-atlas installation (enables real proof generation)')
  .option('--simulate', 'Use simulation mode (default if --jolt-atlas not provided)')
  .action(async (options) => {
    const spinner = ora('Generating zkML proof...').start();

    try {
      // Read model file
      if (!fs.existsSync(options.model)) {
        spinner.fail(`Model file not found: ${options.model}`);
        process.exit(1);
      }
      const modelBytes = fs.readFileSync(options.model);

      // Read inputs file
      if (!fs.existsSync(options.inputs)) {
        spinner.fail(`Inputs file not found: ${options.inputs}`);
        process.exit(1);
      }
      const inputsJson = fs.readFileSync(options.inputs, 'utf-8');
      const inputs = JSON.parse(inputsJson);

      // Validate tag
      const validTags: ProofTag[] = ['authorization', 'compliance', 'collision_severity', 'decision'];
      if (!validTags.includes(options.tag)) {
        spinner.fail(`Invalid tag: ${options.tag}. Must be one of: ${validTags.join(', ')}`);
        process.exit(1);
      }

      // Determine mode: real JOLT-Atlas or simulation
      const useSimulation = !options.joltAtlas || options.simulate;

      // Initialize prover
      const prover = new ZkmlProver({
        joltAtlasPath: options.joltAtlas,
        simulate: useSimulation,
      });

      if (useSimulation) {
        spinner.text = 'Generating proof (simulation mode)...';
      } else {
        spinner.text = `Generating proof using JOLT-Atlas at ${options.joltAtlas}...`;
      }

      const result = await prover.generateProof({
        model: modelBytes,
        inputs,
        tag: options.tag as ProofTag,
      });

      if (!result.success || !result.proof) {
        spinner.fail(`Proof generation failed: ${result.error}`);
        process.exit(1);
      }

      // Save proof to file
      const outputPath = options.output ?? './proof.json';
      const proofData = {
        proof: result.proof.proof,
        proofHash: result.proof.proofHash,
        tag: result.proof.tag,
        metadata: result.proof.metadata,
        generatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(outputPath, JSON.stringify(proofData, null, 2));

      spinner.succeed(`Proof generated successfully`);
      console.log();
      console.log(chalk.bold('Proof Details'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  ${chalk.dim('Hash:')}         ${result.proof.proofHash}`);
      console.log(`  ${chalk.dim('Tag:')}          ${result.proof.tag}`);
      console.log(`  ${chalk.dim('Model Hash:')}   ${result.proof.metadata.modelHash}`);
      console.log(`  ${chalk.dim('Input Hash:')}   ${result.proof.metadata.inputHash}`);
      console.log(`  ${chalk.dim('Output Hash:')}  ${result.proof.metadata.outputHash}`);
      console.log(`  ${chalk.dim('Proof Size:')}   ${result.proof.metadata.proofSize} bytes`);
      console.log(`  ${chalk.dim('Gen Time:')}     ${result.generationTimeMs}ms`);
      console.log(`  ${chalk.dim('Prover:')}       ${result.proof.metadata.proverVersion}`);
      console.log();
      console.log(chalk.green(`Proof saved to: ${path.resolve(outputPath)}`));

    } catch (error) {
      spinner.fail('Proof generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// proof submit
// ============================================================================

proofCommand
  .command('submit <agent-id>')
  .description('Submit a proof attestation to Arc chain')
  .requiredOption('-p, --proof <path>', 'Path to proof JSON file')
  .action(async (agentId: string, options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Submitting proof...').start();

    try {
      // Read proof file
      if (!fs.existsSync(options.proof)) {
        spinner.fail(`Proof file not found: ${options.proof}`);
        process.exit(1);
      }
      const proofData = JSON.parse(fs.readFileSync(options.proof, 'utf-8'));

      // Reconstruct proof object
      const proof: ZkmlProof = {
        proof: proofData.proof,
        proofHash: proofData.proofHash,
        tag: proofData.tag,
        metadata: proofData.metadata,
      };

      // Get verifier client
      const networkConfig = getNetworkConfig();
      const publicClient = getPublicClient();
      const walletClient = getWalletClient();

      const verifier = new ZkmlVerifier({
        network: networkConfig,
        publicClient,
        walletClient,
      });

      spinner.text = 'Submitting proof attestation to Arc chain...';

      const result = await verifier.submitProof({
        agentId,
        proof,
      });

      if (!result.success) {
        spinner.fail(`Submission failed: ${result.error}`);
        process.exit(1);
      }

      spinner.succeed('Proof submitted successfully');
      console.log();
      console.log(chalk.bold('Submission Details'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  ${chalk.dim('Agent ID:')}     ${agentId}`);
      console.log(`  ${chalk.dim('Proof Hash:')}   ${result.requestHash}`);
      console.log(`  ${chalk.dim('Tx Hash:')}      ${result.txHash}`);
      console.log();
      console.log(chalk.dim(`Check status: arc-agent proof status ${result.requestHash}`));

    } catch (error) {
      spinner.fail('Submission failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// proof status
// ============================================================================

proofCommand
  .command('status <proof-hash>')
  .description('Check the validation status of a proof')
  .action(async (proofHash: string) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Checking proof status...').start();

    try {
      const networkConfig = getNetworkConfig();
      const publicClient = getPublicClient();

      const verifier = new ZkmlVerifier({
        network: networkConfig,
        publicClient,
      });

      const status = await verifier.getProofStatus(proofHash as `0x${string}`);

      spinner.stop();

      if (!status.exists) {
        console.log(chalk.yellow('\nProof not found on-chain.'));
        console.log(chalk.dim('This proof may not have been submitted yet.'));
        process.exit(1);
      }

      console.log();
      console.log(chalk.bold('Proof Status'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  ${chalk.dim('Proof Hash:')}   ${proofHash}`);
      console.log(`  ${chalk.dim('Status:')}       ${getValidationStatusText(status.response)}`);
      console.log(`  ${chalk.dim('Validated:')}    ${status.isValidated ? chalk.green('Yes') : chalk.yellow('No')}`);

      if (status.record) {
        console.log(`  ${chalk.dim('Agent ID:')}     ${status.record.agentId}`);
        console.log(`  ${chalk.dim('Validator:')}    ${status.record.validatorAddress}`);
        console.log(`  ${chalk.dim('Submitted:')}    ${new Date(Number(status.record.requestTimestamp) * 1000).toLocaleString()}`);
        if (status.isValidated) {
          console.log(`  ${chalk.dim('Responded:')}    ${new Date(Number(status.record.responseTimestamp) * 1000).toLocaleString()}`);
        }
      }

      if (status.metadata) {
        console.log();
        console.log(chalk.bold('Proof Metadata'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`  ${chalk.dim('Model Hash:')}   ${status.metadata.modelHash}`);
        console.log(`  ${chalk.dim('Input Hash:')}   ${status.metadata.inputHash}`);
        console.log(`  ${chalk.dim('Output Hash:')}  ${status.metadata.outputHash}`);
        console.log(`  ${chalk.dim('Proof Size:')}   ${status.metadata.proofSize} bytes`);
        console.log(`  ${chalk.dim('Gen Time:')}     ${status.metadata.generationTime}ms`);
        console.log(`  ${chalk.dim('Prover:')}       ${status.metadata.proverVersion}`);
      }

    } catch (error) {
      spinner.fail('Status check failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// proof list
// ============================================================================

proofCommand
  .command('list <agent-id>')
  .description('List all proofs for an agent')
  .option('-t, --tag <type>', 'Filter by proof type')
  .option('--valid', 'Show only validated proofs')
  .option('--pending', 'Show only pending proofs')
  .option('-l, --limit <n>', 'Limit results', '10')
  .action(async (agentId: string, options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Fetching proofs...').start();

    try {
      const networkConfig = getNetworkConfig();
      const publicClient = getPublicClient();

      const verifier = new ZkmlVerifier({
        network: networkConfig,
        publicClient,
      });

      // Build filter options
      const listOptions: any = {
        agentId,
        limit: parseInt(options.limit) || 10,
      };

      if (options.tag) {
        listOptions.tag = options.tag;
      }

      if (options.valid) {
        listOptions.response = ValidationResponse.Valid;
      } else if (options.pending) {
        listOptions.response = ValidationResponse.Pending;
      }

      const proofs = await verifier.listProofs(listOptions);

      spinner.stop();

      if (proofs.length === 0) {
        console.log(chalk.yellow('\nNo proofs found for this agent.'));
        return;
      }

      // Get summary stats
      const validCount = await verifier.getAgentValidProofCount(agentId);

      console.log();
      console.log(chalk.bold(`Proofs for Agent #${agentId}`));
      console.log(chalk.dim(`Total valid: ${validCount}`));
      console.log(chalk.dim('─'.repeat(70)));

      for (const proof of proofs) {
        const statusIcon = getStatusIcon(proof.response);
        const tag = chalk.cyan(proof.tag.padEnd(18));
        const hash = chalk.dim(proof.requestHash.slice(0, 18) + '...');
        const date = new Date(proof.timestamp * 1000).toLocaleDateString();

        console.log(`  ${statusIcon} ${tag} ${hash} ${chalk.dim(date)}`);
      }

      console.log();
      console.log(chalk.dim(`Showing ${proofs.length} proof(s). Use --limit to see more.`));

    } catch (error) {
      spinner.fail('Failed to list proofs');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// proof verify
// ============================================================================

proofCommand
  .command('verify <proof-hash>')
  .description('Attempt on-chain verification of a proof (Phase 2)')
  .requiredOption('-p, --proof <path>', 'Path to proof JSON file')
  .action(async (proofHash: string, options) => {
    const config = getConfig();

    if (!config.privateKey) {
      console.log(chalk.red('No wallet configured. Run `arc-agent config set-key` first.'));
      process.exit(1);
    }

    const spinner = ora('Attempting on-chain verification...').start();

    try {
      // Read proof file
      if (!fs.existsSync(options.proof)) {
        spinner.fail(`Proof file not found: ${options.proof}`);
        process.exit(1);
      }
      const proofData = JSON.parse(fs.readFileSync(options.proof, 'utf-8'));

      const networkConfig = getNetworkConfig();
      const publicClient = getPublicClient();

      const verifier = new ZkmlVerifier({
        network: networkConfig,
        publicClient,
      });

      const result = await verifier.verifyOnChain({
        requestHash: proofHash as `0x${string}`,
        proof: proofData.proof,
      });

      spinner.stop();

      if (!result.supported) {
        console.log(chalk.yellow('\nOn-chain verification is not yet available.'));
        console.log(chalk.dim(result.error ?? 'Phase 2 implementation pending.'));
        console.log();
        console.log(chalk.dim('Currently, proofs are validated by trusted validators.'));
        console.log(chalk.dim('On-chain JOLT verification will be available in a future update.'));
      } else {
        if (result.verified) {
          console.log(chalk.green('\n✓ Proof verified successfully on-chain.'));
        } else {
          console.log(chalk.red('\n✗ Proof verification failed.'));
        }
      }

    } catch (error) {
      spinner.fail('Verification failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// Helper functions
// ============================================================================

function getValidationStatusText(status: ValidationResponse): string {
  switch (status) {
    case ValidationResponse.Pending:
      return chalk.yellow('Pending');
    case ValidationResponse.Valid:
      return chalk.green('Valid');
    case ValidationResponse.Invalid:
      return chalk.red('Invalid');
    case ValidationResponse.Inconclusive:
      return chalk.dim('Inconclusive');
    default:
      return chalk.dim('Unknown');
  }
}

function getStatusIcon(status: ValidationResponse): string {
  switch (status) {
    case ValidationResponse.Pending:
      return chalk.yellow('○');
    case ValidationResponse.Valid:
      return chalk.green('✓');
    case ValidationResponse.Invalid:
      return chalk.red('✗');
    case ValidationResponse.Inconclusive:
      return chalk.dim('?');
    default:
      return chalk.dim('·');
  }
}
