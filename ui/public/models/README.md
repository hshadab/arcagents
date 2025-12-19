# ONNX Models for Arc Agents zkML

This directory contains ONNX models used by ML Agents for verifiable inference.

## How ML Agents Work

1. **Probe** - Agent probes the x402 service for metadata
2. **Inference** - Model runs on probe data to produce a decision score (0-1)
3. **Proof** - JOLT-Atlas proof is generated for the inference
4. **Verify** - Proof is verified locally (and optionally on-chain)
5. **Decision** - If score >= threshold, proceed to payment
6. **Pay** - USDC payment on Base
7. **Execute** - Service is called with payment proof

## Supported Models (JOLT-Atlas)

These are real ONNX models from the [JOLT-Atlas](https://github.com/ICME-Lab/jolt-atlas) repo:

| Model | File | JOLT Model | Input Shape | Output Shape | Proof Time | Description |
|-------|------|------------|-------------|--------------|------------|-------------|
| Trading Signal | `trading-signal.onnx` | authorization | [1, 64] | [1, 4] | ~16ms | Market buy/sell/hold signals |
| Opportunity Detector | `opportunity-detector.onnx` | simple_mlp | [1, 8] | [1, 4] | ~26ms | DeFi opportunity scoring |
| Risk Scorer | `risk-scorer.onnx` | authorization | [1, 64] | [1, 4] | ~6ms | Protocol/token risk assessment |
| Sentiment Classifier | `sentiment-classifier.onnx` | sentiment0 | [1, 5] | [1, 1] | ~40ms | Text sentiment (token IDs) |
| Threshold Checker | `threshold-checker.onnx` | perceptron | [1, 4] | [1, 3] | ~3ms | General threshold checking |
| Anomaly Detector | `anomaly-detector.onnx` | simple_mlp_small | [1, 4] | [1, 4] | ~8ms | Outlier detection |

**Model Hashes (SHA-256):**
- `trading-signal`: `0x64f8079d6f44d488e6a0220b59caab08b638c53577544f8740bb31458254fd0a`
- `opportunity-detector`: `0xcc8d8c9afab8191a25967f35a58fea9abb4920946f4cbc43b5f9b17eebc1a967`
- `risk-scorer`: `0x64f8079d6f44d488e6a0220b59caab08b638c53577544f8740bb31458254fd0a`
- `sentiment-classifier`: `0x190d1cebac1eb7c65268fd3762dfeb5e4517330594e4de17b35848e42155cb81`
- `threshold-checker`: `0xdc568010ab721d90ec93ff9b7d755010c84767932d9559b705025b2c7d6b86ab`
- `anomaly-detector`: `0xfd58069b46ab7a53066ec58a3994dd4b73d32be0ad31dbf55f1d3a97539170f3`

## Creating Custom Models

### Using PyTorch

```python
import torch
import torch.nn as nn

class ThresholdChecker(nn.Module):
    def __init__(self, input_size=4):
        super().__init__()
        self.fc1 = nn.Linear(input_size, 16)
        self.fc2 = nn.Linear(16, 8)
        self.fc3 = nn.Linear(8, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.sigmoid(self.fc3(x))
        return x

# Create and export model
model = ThresholdChecker()
dummy_input = torch.randn(1, 4)

torch.onnx.export(
    model,
    dummy_input,
    "threshold-checker.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}}
)
```

### Using Scikit-learn + skl2onnx

```python
from sklearn.linear_model import LogisticRegression
from skl2onnx import to_onnx
import numpy as np

# Train model
X = np.random.randn(1000, 4)
y = (X.sum(axis=1) > 0).astype(int)
model = LogisticRegression()
model.fit(X, y)

# Export to ONNX
onnx_model = to_onnx(model, X[:1].astype(np.float32))
with open("threshold-checker.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())
```

## Model Requirements

1. **Input**: Single tensor, float32, shape [batch, features]
2. **Output**: Single tensor, float32, shape [batch, 1] with values 0-1
3. **Operators**: Use ONNX opset 13+ for best compatibility
4. **Size**: Keep models under 10MB for browser loading

## Testing Models

```typescript
import { runModelInference, modelExists } from '@/lib/onnxInference';

// Check if model exists
const exists = await modelExists('threshold-checker');
console.log('Model exists:', exists);

// Run inference
const result = await runModelInference(
  'threshold-checker',
  [0.5, 0.3, 0.8, 0.2],  // Input features
  0.7  // Decision threshold
);

console.log('Output:', result.output);
console.log('Decision:', result.decision);
```

## Deterministic Fallback

When ONNX models are not available, the system uses deterministic hash-based
inference. This produces consistent results for the same inputs but does not
execute actual model logic. The fallback is useful for:

- Development/testing without trained models
- Demo environments
- Consistent behavior across deployments

## zkML API Endpoint

The `/api/zkml/prove` endpoint runs real ONNX inference and generates proofs:

```bash
curl -X POST http://localhost:3000/api/zkml/prove \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "trading-signal",
    "inputs": {"price": 45000, "volume": 1000000},
    "tag": "authorization",
    "threshold": 0.7
  }'
```

Response includes:
- Real ONNX inference results
- Model hash (SHA-256 of ONNX file)
- JOLT-Atlas compatible proof structure

## Real SNARK Proofs with JOLT-Atlas

For production SNARK proofs, set the `JOLT_ATLAS_SERVICE_URL` environment variable
to point to a deployed JOLT-Atlas prover service:

```bash
JOLT_ATLAS_SERVICE_URL=http://localhost:8080 npm run dev
```

To set up JOLT-Atlas:
1. Clone: `git clone https://github.com/ICME-Lab/jolt-atlas`
2. Build: `cd jolt-atlas && cargo build --release`
3. Run the prover service

The current implementation generates JOLT-Atlas compatible proof structures
with cryptographic commitments (SHA-256/Keccak256 hashes). The proof includes:
- Real model hash (SHA-256 of the ONNX file)
- Input/output hashes
- JOLT-Atlas format structure

For true zero-knowledge SNARK proofs, integrate with the Rust-based JOLT prover.

## Proof Structure

Proofs follow the JOLT-Atlas format:

```
Offset  Size  Field
0       16    Header ("JOLT_PROOF_V1")
16      32    Model Hash (Keccak256)
48      32    Input Hash (Keccak256)
80      32    Output Hash (Keccak256)
112     16    Proof Tag
128     8     Timestamp
136     32    Prover Version
168     32    Agent Hash
200     56    Padding/Signature
```

Proofs can be submitted to `ArcProofAttestation` contract on Arc Testnet:
`0xBE9a5DF7C551324CB872584C6E5bF56799787952`
