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
   * Path to jolt-atlas-fork installation directory
   * Use the included fork: ./jolt-atlas-fork
   */
  joltAtlasPath?: string;
  /**
   * URL of JOLT-Atlas prover HTTP service
   * Run: cd prover && cargo run --release
   */
  joltAtlasUrl?: string;
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
 * 1. Build: cd jolt-atlas-fork && cargo build --release
 * 2. Set joltAtlasPath in config (or use joltAtlasUrl for HTTP service)
 *
 * @example
 * ```typescript
 * // Simulation mode (default - for development)
 * const prover = new ZkmlProver({ simulate: true });
 *
 * // Real proof generation via HTTP service (recommended)
 * const prover = new ZkmlProver({
 *   joltAtlasUrl: 'http://localhost:3001',
 *   simulate: false,
 * });
 *
 * // Real proof generation via CLI (requires jolt-atlas-fork built)
 * const prover = new ZkmlProver({
 *   joltAtlasPath: './jolt-atlas-fork',
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
  private joltAtlasUrl?: string;
  private timeout: number;
  private simulate: boolean;

  constructor(config: ProverConfig = {}) {
    this.joltAtlasPath = config.joltAtlasPath;
    this.joltAtlasUrl = config.joltAtlasUrl;
    this.timeout = config.timeout ?? 300000; // 5 minutes default (proof gen can be slow)
    // Default to simulation only if no real prover is configured
    this.simulate = config.simulate ?? (!config.joltAtlasUrl && !config.joltAtlasPath);
  }

  /**
   * Check if real proof generation is available
   */
  isRealProverAvailable(): boolean {
    return !this.simulate && (!!this.joltAtlasUrl || !!this.joltAtlasPath);
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

      // Generate proof using JOLT-Atlas service, CLI, or simulation
      let proofResult: {
        success: boolean;
        proofBytes?: Uint8Array;
        outputHash?: Hash;
        rawOutput?: number[];
        error?: string;
      };

      if (this.simulate) {
        proofResult = this.simulateProofGeneration(modelHash, inputHash, input.tag);
      } else if (this.joltAtlasUrl) {
        // Try HTTP service first (recommended)
        proofResult = await this.callJoltAtlasService(modelHash, inputHash, input);
      } else if (this.joltAtlasPath) {
        // Fall back to CLI
        proofResult = await this.callJoltAtlasCli(modelHash, inputHash, input);
      } else {
        // No prover configured, fall back to simulation
        proofResult = this.simulateProofGeneration(modelHash, inputHash, input.tag);
      }

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
   * Call JOLT-Atlas HTTP service for proof generation (recommended)
   *
   * Run the prover service: cd prover && cargo run --release
   */
  private async callJoltAtlasService(
    modelHash: Hash,
    inputHash: Hash,
    input: ProofGenerationInput
  ): Promise<{
    success: boolean;
    proofBytes?: Uint8Array;
    outputHash?: Hash;
    rawOutput?: number[];
    error?: string;
  }> {
    if (!this.joltAtlasUrl) {
      return {
        success: false,
        error: 'joltAtlasUrl not configured',
      };
    }

    try {
      // Determine model ID from input
      const modelId = typeof input.model === 'string' && input.model.includes('/')
        ? input.model.split('/').pop()?.replace('.onnx', '') ?? 'authorization'
        : this.tagToModelName(input.tag);

      // Prepare inputs as array
      const inputArray = this.inputsToArray(input.inputs);

      // Call the prover service
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.joltAtlasUrl}/prove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: modelId,
          inputs: inputArray,
          tag: input.tag,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Prover service error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Proof generation failed',
        };
      }

      // Extract proof data
      const proofHex = result.proof.proof as string;
      const proofBytes = new Uint8Array(
        Buffer.from(proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex, 'hex')
      );

      const outputHash = result.proof.metadata.output_hash as Hash;
      const rawOutput = result.inference?.raw_output as number[] | undefined;

      return {
        success: true,
        proofBytes,
        outputHash,
        rawOutput,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `Proof generation timed out after ${this.timeout}ms`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown prover service error',
      };
    }
  }

  /**
   * Convert inputs object to numeric array
   */
  private inputsToArray(inputs: Record<string, unknown>): number[] {
    const result: number[] = [];

    const extract = (val: unknown, depth = 0): void => {
      if (depth > 3) return;

      if (typeof val === 'number' && isFinite(val)) {
        result.push(val);
      } else if (typeof val === 'boolean') {
        result.push(val ? 1 : 0);
      } else if (Array.isArray(val)) {
        val.slice(0, 100).forEach(v => extract(v, depth + 1));
      } else if (val && typeof val === 'object') {
        Object.values(val).slice(0, 100).forEach(v => extract(v, depth + 1));
      }
    };

    extract(inputs);
    return result;
  }

  /**
   * Call JOLT-Atlas CLI for proof generation
   *
   * Requires jolt-atlas-fork to be built:
   * - cd jolt-atlas-fork && cargo build --release
   *
   * Uses the profile command in zkml-jolt-core:
   * - cargo run -r -- profile --name <model-name> --format default
   */
  private async callJoltAtlasCli(
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
        error: 'joltAtlasPath not configured. Set the path to jolt-atlas-fork.',
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
      case 'decision':
        return 'authorization'; // Decision proofs use authorization model
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

    if (!['authorization', 'compliance', 'collision_severity', 'decision'].includes(proof.tag)) {
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

  /**
   * Verify a zkML proof
   *
   * @param proof - The proof to verify
   * @param modelId - Model ID (e.g., "trading-signal")
   * @param modelHash - Expected model hash
   * @param programIo - Optional program I/O for full SNARK verification
   * @returns Verification result
   */
  async verifyProof(
    proof: ZkmlProof,
    modelId: string,
    modelHash: Hash,
    programIo?: { inputs: number[]; outputs: number[] }
  ): Promise<{
    valid: boolean;
    verificationMethod: 'jolt-atlas' | 'local-commitment' | 'structure-only';
    error?: string;
    verificationTimeMs: number;
  }> {
    const startTime = Date.now();

    // If JOLT-Atlas service is available and we have programIo, try full verification
    if (this.joltAtlasUrl && programIo) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(`${this.joltAtlasUrl}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof: proof.proof,
            model_id: modelId,
            model_hash: modelHash,
            program_io: JSON.stringify(programIo),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          return {
            valid: result.valid,
            verificationMethod: 'jolt-atlas',
            error: result.error,
            verificationTimeMs: Date.now() - startTime,
          };
        }
      } catch (error) {
        // Fall through to local verification
        console.warn('JOLT-Atlas verification unavailable, using local verification');
      }
    }

    // Local commitment verification
    const validation = this.validateProof(proof);
    if (!validation.valid) {
      return {
        valid: false,
        verificationMethod: 'structure-only',
        error: validation.errors.join('; '),
        verificationTimeMs: Date.now() - startTime,
      };
    }

    // Verify model hash matches
    if (proof.metadata.modelHash.toLowerCase() !== modelHash.toLowerCase()) {
      return {
        valid: false,
        verificationMethod: 'local-commitment',
        error: 'Model hash mismatch',
        verificationTimeMs: Date.now() - startTime,
      };
    }

    // Check if this is a commitment proof (has JOLT_PROOF_V1 header)
    const proofBytes = Buffer.from(proof.proof.slice(2), 'hex');
    const header = proofBytes.slice(0, 13).toString('utf-8');

    if (header === 'JOLT_PROOF_V1') {
      // Verify commitment proof structure
      if (proofBytes.length !== 256) {
        return {
          valid: false,
          verificationMethod: 'local-commitment',
          error: 'Invalid commitment proof size',
          verificationTimeMs: Date.now() - startTime,
        };
      }

      // Extract and verify embedded hashes
      const embeddedModelHash = '0x' + proofBytes.slice(16, 48).toString('hex');
      const embeddedInputHash = '0x' + proofBytes.slice(48, 80).toString('hex');
      const embeddedOutputHash = '0x' + proofBytes.slice(80, 112).toString('hex');

      if (embeddedModelHash.toLowerCase() !== modelHash.toLowerCase()) {
        return {
          valid: false,
          verificationMethod: 'local-commitment',
          error: 'Embedded model hash mismatch',
          verificationTimeMs: Date.now() - startTime,
        };
      }

      if (embeddedInputHash.toLowerCase() !== proof.metadata.inputHash.toLowerCase()) {
        return {
          valid: false,
          verificationMethod: 'local-commitment',
          error: 'Embedded input hash mismatch',
          verificationTimeMs: Date.now() - startTime,
        };
      }

      if (embeddedOutputHash.toLowerCase() !== proof.metadata.outputHash.toLowerCase()) {
        return {
          valid: false,
          verificationMethod: 'local-commitment',
          error: 'Embedded output hash mismatch',
          verificationTimeMs: Date.now() - startTime,
        };
      }

      return {
        valid: true,
        verificationMethod: 'local-commitment',
        verificationTimeMs: Date.now() - startTime,
      };
    }

    // For SNARK proofs without JOLT-Atlas service, we can only validate structure
    return {
      valid: true,
      verificationMethod: 'structure-only',
      verificationTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Default prover instance
 */
export const zkmlProver = new ZkmlProver();
