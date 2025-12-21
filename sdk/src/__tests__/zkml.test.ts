import { describe, it, expect, beforeEach } from 'vitest';
import { ZkmlProver } from '../zkml/prover';
import type { ProofTag, ZkmlProof } from '../zkml/types';

describe('ZkmlProver', () => {
  let prover: ZkmlProver;

  beforeEach(() => {
    // Create prover in simulation mode (default)
    prover = new ZkmlProver({ simulate: true });
  });

  describe('generateProof', () => {
    it('should generate a proof for authorization tag', async () => {
      const result = await prover.generateProof({
        model: 'test-authorization-model.onnx',
        inputs: { amount: 100, recipient: '0x1234567890abcdef' },
        tag: 'authorization',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof!.tag).toBe('authorization');
      expect(result.proof!.proof).toMatch(/^0x/);
      expect(result.proof!.proofHash).toMatch(/^0x/);
      expect(result.proof!.proofHash.length).toBe(66); // 0x + 64 hex chars
      expect(result.generationTimeMs).toBeGreaterThan(0);
    });

    it('should generate a proof for compliance tag', async () => {
      const result = await prover.generateProof({
        model: 'compliance-checker.onnx',
        inputs: {
          address: '0xabcdef1234567890',
          riskScore: 0.3,
          isPEP: false,
        },
        tag: 'compliance',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof!.tag).toBe('compliance');
    });

    it('should generate a proof for collision_severity tag', async () => {
      const result = await prover.generateProof({
        model: 'collision-model.onnx',
        inputs: {
          velocity: 35.5,
          angle: 45,
          distance: 10,
        },
        tag: 'collision_severity',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof!.tag).toBe('collision_severity');
    });

    it('should generate a proof for decision tag', async () => {
      const result = await prover.generateProof({
        model: 'trading-signal.onnx',
        inputs: {
          price: 45000,
          volume: 1000000,
          rsi: 65,
        },
        tag: 'decision',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof!.tag).toBe('decision');
    });

    it('should include proper metadata in proof', async () => {
      const result = await prover.generateProof({
        model: 'test-model.onnx',
        inputs: { value: 42 },
        tag: 'authorization',
      });

      expect(result.success).toBe(true);
      expect(result.proof!.metadata).toBeDefined();
      expect(result.proof!.metadata.modelHash).toMatch(/^0x/);
      expect(result.proof!.metadata.inputHash).toMatch(/^0x/);
      expect(result.proof!.metadata.outputHash).toMatch(/^0x/);
      expect(result.proof!.metadata.proofSize).toBeGreaterThan(0);
      expect(result.proof!.metadata.generationTime).toBeGreaterThanOrEqual(0);
      expect(result.proof!.metadata.proverVersion).toBe('jolt-atlas-0.2.0');
    });

    it('should generate different proofs for different inputs', async () => {
      const result1 = await prover.generateProof({
        model: 'test-model.onnx',
        inputs: { value: 1 },
        tag: 'authorization',
      });

      const result2 = await prover.generateProof({
        model: 'test-model.onnx',
        inputs: { value: 2 },
        tag: 'authorization',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Different inputs should produce different input hashes
      expect(result1.proof!.metadata.inputHash).not.toBe(result2.proof!.metadata.inputHash);
    });

    it('should generate different proofs for different models', async () => {
      const result1 = await prover.generateProof({
        model: 'model-a.onnx',
        inputs: { value: 1 },
        tag: 'authorization',
      });

      const result2 = await prover.generateProof({
        model: 'model-b.onnx',
        inputs: { value: 1 },
        tag: 'authorization',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Different models should produce different model hashes
      expect(result1.proof!.metadata.modelHash).not.toBe(result2.proof!.metadata.modelHash);
    });

    it('should accept model as Uint8Array', async () => {
      const modelBytes = new Uint8Array([0x4f, 0x4e, 0x4e, 0x58]); // "ONNX" header

      const result = await prover.generateProof({
        model: modelBytes,
        inputs: { value: 1 },
        tag: 'authorization',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
    });

    it('should handle complex nested inputs', async () => {
      const result = await prover.generateProof({
        model: 'complex-model.onnx',
        inputs: {
          user: {
            id: '123',
            address: '0xabc',
          },
          transaction: {
            amount: 100,
            token: 'USDC',
            destination: '0xdef',
          },
          metadata: {
            timestamp: Date.now(),
            nonce: 42,
          },
        },
        tag: 'authorization',
      });

      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
    });
  });

  describe('validateProof', () => {
    it('should validate a correctly structured proof', async () => {
      const result = await prover.generateProof({
        model: 'test-model.onnx',
        inputs: { value: 1 },
        tag: 'authorization',
      });

      expect(result.success).toBe(true);

      const validation = prover.validateProof(result.proof!);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject proof with invalid format', () => {
      const invalidProof = {
        proof: 'not-hex',
        proofHash: '0x1234',
        metadata: {
          modelHash: '0x' + '1'.repeat(64),
          inputHash: '0x' + '2'.repeat(64),
          outputHash: '0x' + '3'.repeat(64),
          proofSize: 256,
          generationTime: 100,
          proverVersion: 'jolt-atlas-0.2.0',
        },
        tag: 'authorization' as ProofTag,
      };

      const validation = prover.validateProof(invalidProof as ZkmlProof);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject proof with missing metadata', () => {
      const incompleteProof = {
        proof: '0x' + '1'.repeat(512),
        proofHash: '0x' + '1'.repeat(64),
        tag: 'authorization' as ProofTag,
      } as ZkmlProof;

      const validation = prover.validateProof(incompleteProof);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing proof metadata');
    });

    it('should reject proof with invalid tag', () => {
      const invalidTagProof = {
        proof: '0x' + '1'.repeat(512),
        proofHash: '0x' + '1'.repeat(64),
        metadata: {
          modelHash: '0x' + '1'.repeat(64),
          inputHash: '0x' + '2'.repeat(64),
          outputHash: '0x' + '3'.repeat(64),
          proofSize: 256,
          generationTime: 100,
          proverVersion: 'jolt-atlas-0.2.0',
        },
        tag: 'invalid_tag' as ProofTag,
      };

      const validation = prover.validateProof(invalidTagProof as ZkmlProof);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid proof tag'))).toBe(true);
    });
  });

  describe('estimateGenerationTime', () => {
    it('should estimate generation time based on model size', () => {
      const smallModelTime = prover.estimateGenerationTime(1024); // 1KB
      const largeModelTime = prover.estimateGenerationTime(1024 * 1024); // 1MB

      expect(smallModelTime).toBeGreaterThan(0);
      expect(largeModelTime).toBeGreaterThan(smallModelTime);
    });

    it('should include base overhead in estimate', () => {
      const zeroSizeTime = prover.estimateGenerationTime(0);
      expect(zeroSizeTime).toBeGreaterThan(0); // Base overhead
    });
  });

  describe('prover configuration', () => {
    it('should default to simulation mode', () => {
      const defaultProver = new ZkmlProver();
      // Test by generating a proof - it should succeed in simulation mode
      return defaultProver.generateProof({
        model: 'test.onnx',
        inputs: { x: 1 },
        tag: 'authorization',
      }).then(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should accept custom timeout configuration', () => {
      const customProver = new ZkmlProver({ timeout: 60000 });
      // Prover should be created without errors
      expect(customProver).toBeDefined();
    });

    it('should fall back to simulation when no real prover is configured', async () => {
      // When simulate=false but no joltAtlasPath/joltAtlasUrl is configured,
      // the prover gracefully falls back to simulation mode
      const realProver = new ZkmlProver({ simulate: false });

      const result = await realProver.generateProof({
        model: 'test.onnx',
        inputs: { x: 1 },
        tag: 'authorization',
      });

      // Should succeed with a simulated proof (fallback behavior)
      expect(result.success).toBe(true);
      expect(result.proof).toBeDefined();
    });
  });
});

describe('Proof Tags', () => {
  const prover = new ZkmlProver({ simulate: true });
  const allTags: ProofTag[] = ['authorization', 'compliance', 'collision_severity', 'decision'];

  it.each(allTags)('should successfully generate proof for tag: %s', async (tag) => {
    const result = await prover.generateProof({
      model: `${tag}-model.onnx`,
      inputs: { testInput: true },
      tag,
    });

    expect(result.success).toBe(true);
    expect(result.proof!.tag).toBe(tag);
  });
});

describe('Edge Cases', () => {
  const prover = new ZkmlProver({ simulate: true });

  it('should handle empty inputs object', async () => {
    const result = await prover.generateProof({
      model: 'test.onnx',
      inputs: {},
      tag: 'authorization',
    });

    expect(result.success).toBe(true);
  });

  it('should handle very large inputs', async () => {
    const largeInput: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      largeInput[`field_${i}`] = Math.random();
    }

    const result = await prover.generateProof({
      model: 'test.onnx',
      inputs: largeInput,
      tag: 'authorization',
    });

    expect(result.success).toBe(true);
  });

  it('should handle special characters in inputs', async () => {
    const result = await prover.generateProof({
      model: 'test.onnx',
      inputs: {
        message: 'Hello "World"! \n\t Special: <>&\'',
        unicode: '日本語 中文 한국어',
      },
      tag: 'authorization',
    });

    expect(result.success).toBe(true);
  });

  it('should handle inputs with null and undefined values', async () => {
    const result = await prover.generateProof({
      model: 'test.onnx',
      inputs: {
        nullValue: null,
        defined: 'value',
      },
      tag: 'authorization',
    });

    expect(result.success).toBe(true);
  });
});
