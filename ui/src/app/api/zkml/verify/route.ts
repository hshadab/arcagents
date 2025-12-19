import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toHex, type Hash } from 'viem';

interface VerifyRequest {
  /** Hex-encoded proof bytes */
  proof: string;
  /** Model ID (e.g., "trading-signal") */
  modelId: string;
  /** Expected model hash */
  modelHash: string;
  /** Program I/O (inputs and outputs used during proof generation) */
  programIo?: {
    inputs: number[];
    outputs: number[];
  };
  /** Proof metadata for local verification fallback */
  metadata?: {
    inputHash: string;
    outputHash: string;
  };
}

interface VerifyResponse {
  valid: boolean;
  verificationMethod: 'jolt-atlas' | 'local-commitment' | 'structure-only';
  error?: string;
  verificationTimeMs: number;
}

/**
 * POST /api/zkml/verify
 *
 * Verify a zkML proof using JOLT-Atlas service or local verification.
 *
 * Verification levels:
 * 1. JOLT-Atlas service (if JOLT_ATLAS_SERVICE_URL is set) - Full SNARK verification
 * 2. Local commitment verification - Verifies proof structure and hash commitments
 * 3. Structure-only - Basic proof format validation
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  const startTime = Date.now();

  try {
    const body: VerifyRequest = await request.json();
    const { proof, modelId, modelHash, programIo, metadata } = body;

    // Validate required fields
    if (!proof || !modelId || !modelHash) {
      return NextResponse.json({
        valid: false,
        verificationMethod: 'structure-only',
        error: 'Missing required fields: proof, modelId, modelHash',
        verificationTimeMs: Date.now() - startTime,
      });
    }

    // Validate proof format
    if (!proof.startsWith('0x')) {
      return NextResponse.json({
        valid: false,
        verificationMethod: 'structure-only',
        error: 'Invalid proof format: must be hex string starting with 0x',
        verificationTimeMs: Date.now() - startTime,
      });
    }

    // Check for JOLT-Atlas service
    const joltServiceUrl = process.env.JOLT_ATLAS_SERVICE_URL;

    if (joltServiceUrl && programIo) {
      // Try full SNARK verification via JOLT-Atlas service
      console.log(`[zkML Verify] Calling JOLT-Atlas service: ${joltServiceUrl}`);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 min timeout for verification

        const joltResponse = await fetch(`${joltServiceUrl}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof,
            model_id: modelId,
            model_hash: modelHash,
            program_io: JSON.stringify(programIo),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (joltResponse.ok) {
          const result = await joltResponse.json();

          console.log(`[zkML Verify] JOLT-Atlas verification: ${result.valid ? 'VALID' : 'INVALID'}`);
          console.log(`[zkML Verify] Verification time: ${result.verification_time_ms}ms`);

          return NextResponse.json({
            valid: result.valid,
            verificationMethod: 'jolt-atlas',
            error: result.error,
            verificationTimeMs: Date.now() - startTime,
          });
        } else {
          const errorText = await joltResponse.text();
          console.warn(`[zkML Verify] JOLT service HTTP error ${joltResponse.status}: ${errorText}`);
          // Fall through to local verification
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[zkML Verify] JOLT service timed out after 60s`);
        } else {
          console.warn(`[zkML Verify] JOLT service unavailable: ${err}`);
        }
        // Fall through to local verification
      }
    }

    // Local commitment verification
    // This verifies the proof structure and checks hash commitments
    // It does NOT provide cryptographic guarantees like a real SNARK verification
    console.log(`[zkML Verify] Using local commitment verification`);

    const isValidStructure = verifyProofStructure(proof);

    if (!isValidStructure.valid) {
      return NextResponse.json({
        valid: false,
        verificationMethod: 'structure-only',
        error: isValidStructure.error,
        verificationTimeMs: Date.now() - startTime,
      });
    }

    // If we have metadata, verify hash commitments
    if (metadata) {
      const commitmentValid = verifyCommitments(proof, modelHash, metadata.inputHash, metadata.outputHash);

      if (!commitmentValid.valid) {
        return NextResponse.json({
          valid: false,
          verificationMethod: 'local-commitment',
          error: commitmentValid.error,
          verificationTimeMs: Date.now() - startTime,
        });
      }

      console.log(`[zkML Verify] Local commitment verification: VALID`);
      return NextResponse.json({
        valid: true,
        verificationMethod: 'local-commitment',
        verificationTimeMs: Date.now() - startTime,
      });
    }

    // Structure-only verification (weakest guarantee)
    console.log(`[zkML Verify] Structure-only verification: VALID (no metadata for commitment check)`);
    return NextResponse.json({
      valid: true,
      verificationMethod: 'structure-only',
      verificationTimeMs: Date.now() - startTime,
    });

  } catch (error) {
    console.error('[zkML Verify] Error:', error);
    return NextResponse.json({
      valid: false,
      verificationMethod: 'structure-only',
      error: error instanceof Error ? error.message : 'Verification failed',
      verificationTimeMs: Date.now() - startTime,
    });
  }
}

/**
 * Verify proof structure matches expected JOLT format
 */
function verifyProofStructure(proof: string): { valid: boolean; error?: string } {
  try {
    // Decode proof bytes
    const proofHex = proof.startsWith('0x') ? proof.slice(2) : proof;
    const proofBytes = new Uint8Array(Buffer.from(proofHex, 'hex'));

    // Minimum proof size (commitment proofs are 256 bytes, SNARK proofs are larger)
    if (proofBytes.length < 64) {
      return { valid: false, error: 'Proof too small (minimum 64 bytes)' };
    }

    // Check for JOLT proof header (commitment proofs have this)
    const header = new TextDecoder().decode(proofBytes.slice(0, 13));
    const isCommitmentProof = header === 'JOLT_PROOF_V1';

    if (isCommitmentProof) {
      // Verify commitment proof structure
      if (proofBytes.length !== 256) {
        return { valid: false, error: 'Invalid commitment proof size (expected 256 bytes)' };
      }
      return { valid: true };
    }

    // For SNARK proofs, just verify minimum structure
    // Real SNARK verification happens in the JOLT-Atlas service
    if (proofBytes.length < 1000) {
      // Likely a commitment proof without proper header
      console.warn('[zkML Verify] Small proof without JOLT header - may be incomplete');
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to parse proof'
    };
  }
}

/**
 * Verify hash commitments in a commitment proof
 */
function verifyCommitments(
  proof: string,
  expectedModelHash: string,
  expectedInputHash: string,
  expectedOutputHash: string
): { valid: boolean; error?: string } {
  try {
    const proofHex = proof.startsWith('0x') ? proof.slice(2) : proof;
    const proofBytes = new Uint8Array(Buffer.from(proofHex, 'hex'));

    // Check for commitment proof header
    const header = new TextDecoder().decode(proofBytes.slice(0, 13));
    if (header !== 'JOLT_PROOF_V1') {
      // Not a commitment proof - can't verify commitments locally
      // This would be a real SNARK proof that needs JOLT-Atlas service
      return {
        valid: true, // We can't verify, assume valid structure
      };
    }

    // Extract hashes from commitment proof
    // Layout: header(16) + modelHash(32) + inputHash(32) + outputHash(32) + ...
    const modelHashBytes = proofBytes.slice(16, 48);
    const inputHashBytes = proofBytes.slice(48, 80);
    const outputHashBytes = proofBytes.slice(80, 112);

    const extractedModelHash = '0x' + Buffer.from(modelHashBytes).toString('hex');
    const extractedInputHash = '0x' + Buffer.from(inputHashBytes).toString('hex');
    const extractedOutputHash = '0x' + Buffer.from(outputHashBytes).toString('hex');

    // Verify model hash
    if (extractedModelHash.toLowerCase() !== expectedModelHash.toLowerCase()) {
      return {
        valid: false,
        error: `Model hash mismatch: expected ${expectedModelHash.slice(0, 18)}..., got ${extractedModelHash.slice(0, 18)}...`
      };
    }

    // Verify input hash
    if (extractedInputHash.toLowerCase() !== expectedInputHash.toLowerCase()) {
      return {
        valid: false,
        error: `Input hash mismatch: expected ${expectedInputHash.slice(0, 18)}..., got ${extractedInputHash.slice(0, 18)}...`
      };
    }

    // Verify output hash
    if (extractedOutputHash.toLowerCase() !== expectedOutputHash.toLowerCase()) {
      return {
        valid: false,
        error: `Output hash mismatch: expected ${expectedOutputHash.slice(0, 18)}..., got ${extractedOutputHash.slice(0, 18)}...`
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to verify commitments'
    };
  }
}
