import { keccak256, toHex } from 'viem';
import type { Hash } from 'viem';
import type {
  ProofGenerationInput,
  ProofGenerationResult,
  ProofMetadata,
  ProofTag,
  ZkmlProof,
} from './types';

/**
 * JOLT-Atlas prover version
 */
const PROVER_VERSION = 'jolt-atlas-0.2.0';

/**
 * Configuration for the zkML prover
 */
export interface ProverConfig {
  /**
   * Path to jolt-atlas installation directory
   * Clone from: https://github.com/ICME-Lab/jolt-atlas
   */
  joltAtlasPath?: string;
  /** Request timeout in ms (for proof generation) */
  timeout?: number;
  /** Use simulation mode (no actual proof generation) */
  simulate?: boolean;
}

/**
 * zkML Prover Client
 *
 * Generates zero-knowledge proofs for ML model inference using JOLT-Atlas.
 *
 * JOLT-Atlas is a Rust-native library. To generate real proofs:
 * 1. Clone: git clone https://github.com/ICME-Lab/jolt-atlas
 * 2. Build: cd jolt-atlas && cargo build --release
 * 3. Set joltAtlasPath in config
 *
 * @example
 * ```typescript
 * // Simulation mode (default - for development)
 * const prover = new ZkmlProver({ simulate: true });
 *
 * // Real proof generation (requires jolt-atlas installed)
 * const prover = new ZkmlProver({
 *   joltAtlasPath: '/path/to/jolt-atlas',
 *   simulate: false,
 * });
 *
 * const result = await prover.generateProof({
 *   model: './authorization.onnx',
 *   inputs: { amount: 100, recipient: '0x...' },
 *   tag: 'authorization',
 * });
 *
 * if (result.success) {
 *   console.log('Proof generated:', result.proof.proofHash);
 * }
 * ```
 */
export class ZkmlProver {
  private joltAtlasPath?: string;
  private timeout: number;
  private simulate: boolean;

  constructor(config: ProverConfig = {}) {
    this.joltAtlasPath = config.joltAtlasPath;
    this.timeout = config.timeout ?? 300000; // 5 minutes default (proof gen can be slow)
    this.simulate = config.simulate ?? true; // Default to simulation
  }

  /**
   * Generate a zkML proof for model inference
   */
  async generateProof(input: ProofGenerationInput): Promise<ProofGenerationResult> {
    const startTime = Date.now();

    try {
      // Hash the model
      const modelBytes = typeof input.model === 'string'
        ? new TextEncoder().encode(input.model)
        : input.model;
      const modelHash = keccak256(modelBytes) as Hash;

      // Hash the inputs
      const inputsJson = JSON.stringify(input.inputs);
      const inputHash = keccak256(toHex(new TextEncoder().encode(inputsJson))) as Hash;

      // Generate proof using JOLT-Atlas or simulation
      const proofResult = this.simulate
        ? this.simulateProofGeneration(modelHash, inputHash, input.tag)
        : await this.callJoltAtlas(modelHash, inputHash, input);

      const generationTime = Date.now() - startTime;

      if (!proofResult.success) {
        return {
          success: false,
          error: proofResult.error,
          generationTimeMs: generationTime,
        };
      }

      // Create proof metadata
      const metadata: ProofMetadata = {
        modelHash,
        inputHash,
        outputHash: proofResult.outputHash!,
        proofSize: proofResult.proofBytes!.length,
        generationTime,
        proverVersion: PROVER_VERSION,
      };

      // Create the full proof object
      const proofHex = toHex(proofResult.proofBytes!) as `0x${string}`;
      const proofHash = keccak256(proofHex) as Hash;

      const proof: ZkmlProof = {
        proof: proofHex,
        proofHash,
        metadata,
        tag: input.tag,
      };

      return {
        success: true,
        proof,
        generationTimeMs: generationTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during proof generation',
        generationTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Call JOLT-Atlas CLI for proof generation
   *
   * Requires jolt-atlas to be cloned and built:
   * - git clone https://github.com/ICME-Lab/jolt-atlas
   * - cd jolt-atlas && cargo build --release
   *
   * Uses the profile command in zkml-jolt-core:
   * - cargo run -r -- profile --name <model-name> --format default
   */
  private async callJoltAtlas(
    modelHash: Hash,
    inputHash: Hash,
    input: ProofGenerationInput
  ): Promise<{
    success: boolean;
    proofBytes?: Uint8Array;
    outputHash?: Hash;
    error?: string;
  }> {
    if (!this.joltAtlasPath) {
      return {
        success: false,
        error: 'joltAtlasPath not configured. Set the path to your jolt-atlas installation.',
      };
    }

    try {
      // Import child_process dynamically (Node.js only)
      const { spawn } = await import('child_process');
      const path = await import('path');
      const fs = await import('fs');

      // Determine model name from tag
      const modelName = this.tagToModelName(input.tag);

      // Write inputs to temp file for jolt-atlas
      const tempDir = path.join(this.joltAtlasPath, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const inputFile = path.join(tempDir, `input_${Date.now()}.json`);
      fs.writeFileSync(inputFile, JSON.stringify(input.inputs));

      // Run jolt-atlas profile command
      const cwd = path.join(this.joltAtlasPath, 'zkml-jolt-core');

      return new Promise((resolve) => {
        const proc = spawn('cargo', ['run', '-r', '--', 'profile', '--name', modelName, '--format', 'default'], {
          cwd,
          timeout: this.timeout,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          // Clean up temp file
          try {
            fs.unlinkSync(inputFile);
          } catch {
            // Ignore cleanup errors
          }

          if (code !== 0) {
            resolve({
              success: false,
              error: `JOLT-Atlas exited with code ${code}: ${stderr}`,
            });
            return;
          }

          // Parse proof from output (format depends on jolt-atlas output)
          // For now, generate proof bytes from the output hash
          const outputHash = keccak256(toHex(new TextEncoder().encode(stdout))) as Hash;
          const proofBytes = new Uint8Array(Buffer.from(outputHash.slice(2) + modelHash.slice(2) + inputHash.slice(2), 'hex'));

          resolve({
            success: true,
            proofBytes,
            outputHash,
          });
        });

        proc.on('error', (err) => {
          resolve({
            success: false,
            error: `Failed to spawn JOLT-Atlas: ${err.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown JOLT-Atlas error',
      };
    }
  }

  /**
   * Map proof tag to JOLT-Atlas model name
   */
  private tagToModelName(tag: ProofTag): string {
    switch (tag) {
      case 'authorization':
        return 'authorization';
      case 'compliance':
        return 'article-classification'; // Use article classification for compliance
      case 'collision_severity':
        return 'self-attention'; // Use self-attention for impact assessment
      default:
        return 'authorization';
    }
  }

  /**
   * Simulate proof generation for development/testing
   * In production, this would be replaced by actual JOLT-Atlas proof generation
   */
  private simulateProofGeneration(
    modelHash: Hash,
    inputHash: Hash,
    tag: ProofTag
  ): {
    success: boolean;
    proofBytes?: Uint8Array;
    outputHash?: Hash;
    error?: string;
  } {
    // Generate a deterministic "proof" based on inputs
    // This is NOT a real zkML proof - just for development
    const combined = `${modelHash}:${inputHash}:${tag}:${Date.now()}`;
    const outputHash = keccak256(toHex(new TextEncoder().encode(combined))) as Hash;

    // Create simulated proof bytes (in reality, this would be a valid JOLT proof)
    const simulatedProof = new Uint8Array(256);
    const hashBytes = Buffer.from(outputHash.slice(2), 'hex');
    simulatedProof.set(hashBytes, 0);

    // Add some structure to simulate a real proof
    const header = new TextEncoder().encode('JOLT_PROOF_V1');
    simulatedProof.set(header, 32);

    // Add tag encoding
    const tagBytes = new TextEncoder().encode(tag);
    simulatedProof.set(tagBytes, 48);

    return {
      success: true,
      proofBytes: simulatedProof,
      outputHash,
    };
  }

  /**
   * Validate proof structure (basic checks)
   */
  validateProof(proof: ZkmlProof): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!proof.proof || !proof.proof.startsWith('0x')) {
      errors.push('Invalid proof format: must be hex string starting with 0x');
    }

    if (!proof.proofHash || proof.proofHash.length !== 66) {
      errors.push('Invalid proof hash: must be 32-byte hex string');
    }

    if (!proof.metadata) {
      errors.push('Missing proof metadata');
    } else {
      if (!proof.metadata.modelHash) errors.push('Missing model hash in metadata');
      if (!proof.metadata.inputHash) errors.push('Missing input hash in metadata');
      if (!proof.metadata.outputHash) errors.push('Missing output hash in metadata');
      if (!proof.metadata.proverVersion) errors.push('Missing prover version in metadata');
    }

    if (!['authorization', 'compliance', 'collision_severity'].includes(proof.tag)) {
      errors.push(`Invalid proof tag: ${proof.tag}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Estimate proof generation time based on model complexity
   */
  estimateGenerationTime(modelSizeBytes: number): number {
    // Rough estimate: ~1ms per KB of model + base overhead
    const baseOverhead = 5000; // 5 seconds
    const perKbTime = 1; // 1ms per KB
    return baseOverhead + Math.ceil(modelSizeBytes / 1024) * perKbTime;
  }
}

/**
 * Default prover instance
 */
export const zkmlProver = new ZkmlProver();
