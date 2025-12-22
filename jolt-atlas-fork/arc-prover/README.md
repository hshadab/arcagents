# Arc Agent JOLT-Atlas zkML Prover

Real zero-knowledge proof generation service for ONNX model inference using [JOLT-Atlas](https://github.com/ICME-Lab/jolt-atlas).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     zkML Proof Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PROOF GENERATION (this service)                             │
│     ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│     │ ONNX Model  │───▶│ JOLT-Atlas   │───▶│ SNARK Proof  │    │
│     │ + Inputs    │    │ Prover       │    │ (off-chain)  │    │
│     └─────────────┘    └──────────────┘    └──────────────┘    │
│                                                                 │
│  2. VERIFICATION (LOCAL - off-chain)                            │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│     │ SNARK Proof  │───▶│ JOLT-Atlas   │───▶│ Valid/Invalid│   │
│     │              │    │ Verifier     │    │              │   │
│     └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                 │
│  3. ATTESTATION (on-chain)                                      │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│     │ Proof Hash   │───▶│ Arc Chain    │───▶│ Attestation  │   │
│     │ + Metadata   │    │ Contract     │    │ Record       │   │
│     └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Verification is LOCAL (off-chain)** - SNARK proofs are verified by this service
- **Only attestation is stored on-chain** - Proof hashes and metadata
- **Anyone can verify** - Download proof from IPFS/storage, verify locally

## Overview

This service generates cryptographic proofs that verify:
- A specific ONNX model was executed
- With specific inputs
- Producing specific outputs
- **Without trusting the prover** - proofs are mathematically verifiable

## Prerequisites

- Rust 1.75+ (nightly recommended)
- 8GB+ RAM (proof generation is memory-intensive)
- ONNX models in `./models/` directory

## Quick Start

### 1. Install Dependencies

```bash
# Install Rust nightly
rustup default nightly
```

### 2. Copy Models

```bash
# Copy ONNX models from UI
cp ../ui/public/models/*.onnx ./models/
```

### 3. Build & Run

The prover is part of the jolt-atlas workspace. Build and run from the project root:

```bash
# From arcagent root directory
cd jolt-atlas

# Build (first build ~12 minutes, subsequent builds much faster)
cargo build --release -p arc-prover

# Run
MODELS_DIR=./arc-prover/models PORT=3001 cargo run --release -p arc-prover
```

**First Build Notes:**
- Initial build compiles the entire JOLT-Atlas workspace (~12 min)
- First proof for each model includes preprocessing (~30s)
- Subsequent proofs use cached preprocessing and are faster

### 4. Docker

```bash
# Build image
docker build -t arc-prover .

# Run with models mounted
docker run -p 3001:3001 -v $(pwd)/models:/app/models arc-prover
```

## API Endpoints

### POST /prove

Generate a zkML proof for model inference.

**Request:**
```json
{
  "model_id": "trading-signal",
  "inputs": [0.5, 0.3, 0.8, ...],
  "tag": "decision"
}
```

**Response:**
```json
{
  "success": true,
  "proof": {
    "proof": "0x...",
    "proof_hash": "0xbf5320eeb4d21e47...",
    "metadata": {
      "model_hash": "0xdc568010ab721d90...",
      "input_hash": "0x...",
      "output_hash": "0x...",
      "proof_size": 55586,
      "generation_time": 4743,
      "prover_version": "jolt-atlas-snark-v1.0.0"
    },
    "tag": "decision",
    "timestamp": 1702900000
  },
  "inference": {
    "output": 1.0,
    "raw_output": [1.0],
    "decision": "approve",
    "confidence": 1.0
  },
  "generation_time_ms": 4743
}
```

### POST /verify

Verify a zkML proof.

**Request:**
```json
{
  "proof": "0x...",
  "model_id": "trading-signal",
  "model_hash": "0x64f8079d...",
  "program_io": "{...}"
}
```

**Response:**
```json
{
  "valid": true,
  "verification_time_ms": 143
}
```

### GET /models

List available models.

### GET /health

Health check.

## Performance

Estimated benchmark results using HyperKZG polynomial commitments over BN254 (not verified by ICME Labs):

| Model | Input Shape | Proof Time | Proof Size | Verify Time |
|-------|-------------|-----------|------------|-------------|
| **spending-model** | [1, 8] | ~2s | ~50KB | <150ms |
| threshold-checker | [1, 4] | ~5s | ~55KB | <150ms |
| anomaly-detector | [1, 4] | ~5s | ~45KB | <150ms |
| sentiment-classifier | [1, 5] | ~6s | ~40KB | <150ms |
| opportunity-detector | [1, 8] | ~8s | ~45KB | <150ms |
| trading-signal | [1, 64] | ~12s | ~55KB | <150ms |
| risk-scorer | [1, 64] | ~12s | ~55KB | <150ms |

**Notes:**
- First proof includes model preprocessing (~30s additional)
- Memory usage: 5-6GB during proof generation
- Proof sizes are cryptographic SNARK proofs, not hash commitments

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODELS_DIR` | `./models` | Directory containing ONNX models |
| `PORT` | `3001` | HTTP server port |
| `RUST_LOG` | `info` | Log level |

## Integration

### With Arc Agent SDK

```typescript
// sdk/src/zkml/prover.ts
const prover = new ZkmlProver({
  joltAtlasUrl: 'http://localhost:3001',
  simulate: false,
});

const result = await prover.generateProof({
  model: 'trading-signal',
  inputs: { price: 100, volume: 50000 },
  tag: 'decision',
});
// result.proof contains real SNARK proof
```

### With UI

Set environment variable in `ui/.env.local`:
```bash
JOLT_ATLAS_SERVICE_URL=http://localhost:3001
```

When the prover is not available, the UI falls back to commitment proofs (256 bytes) instead of real SNARK proofs (45-55KB).

## Proof Structure

The generated proofs use JOLT's polynomial commitment scheme (HyperKZG over BN254):

```
┌─────────────────────────────────────────────┐
│              JOLT SNARK Proof               │
├─────────────────────────────────────────────┤
│ Polynomial commitments (HyperKZG)           │
│ Sumcheck proofs                             │
│ Lookup table proofs                         │
│ Memory checking proofs                      │
└─────────────────────────────────────────────┘
```

Unlike commitment proofs (just hashes), JOLT proofs are:
- **Cryptographically sound** - Can't be forged
- **Publicly verifiable** - Anyone can verify
- **Zero-knowledge** - Inputs can be hidden

## Troubleshooting

### Out of Memory

Proof generation requires ~5-6GB RAM. Increase swap or use a larger instance.

### Model Not Found

Ensure ONNX models are in `MODELS_DIR`:
```bash
ls -la $MODELS_DIR/*.onnx
```

### Slow Proof Generation

Expected proof times are 4-12 seconds depending on model complexity. First proof for each model includes one-time preprocessing (~30s additional). Subsequent proofs use cached preprocessing.

If proofs are taking much longer:
- Ensure using release build (`cargo build --release`)
- Check memory availability (5-6GB required)

## Limitations

This prover has the following known limitations:

- **Batch size must be 1**: Input shape must be `[1, ...]`. Batched inputs (e.g., `[N, ...]` where N > 1) will panic or produce incorrect proofs.
- **Simple MLP models only**: Tested with feedforward networks using MatMul → Add → ReLU patterns. Complex architectures (transformers, attention layers with batch > 1) are not supported.
- **Single-sample inference**: Designed for proving one input at a time.

The included `spending-model.onnx` is compatible with these constraints.

## License

MIT
