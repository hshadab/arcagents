# Arc Agents

A comprehensive framework for launching and managing autonomous AI agents with integrated x402 payment capabilities on the [Arc L1 blockchain](https://arc.network). This is a demonstration project and is not intended for production use.

## What is Arc Agents?

Arc Agents enables you to deploy autonomous AI agents that can discover, connect to, and pay for services across the internet using cryptocurrency. What makes Arc Agents unique is its **cryptographic accountability** system: every spending decision an agent makes is backed by a zero-knowledge proof (zkML SNARK), providing mathematical guarantees that the agent followed its programmed rules.

### The Problem

Autonomous AI agents need to spend money to access services (APIs, data feeds, compute resources). But how do you trust that an agent is spending wisely? Traditional approaches rely on:
- Simple budget limits (easily gamed)
- Human approval for every transaction (defeats the purpose of autonomy)
- Trusting the agent's logs (can be fabricated)

### The Solution

Arc Agents uses **zkML (zero-knowledge machine learning)** proofs. Before every payment, the agent runs a decision model and generates a cryptographic proof that:
1. The spending decision was made by a specific ML model
2. The model received specific inputs (price, budget, service reputation)
3. The model produced a specific output (approve/reject)

This proof is:
- **Unforgeable**: No one can fake a proof without running the actual model
- **Verifiable**: Anyone can verify the proof in milliseconds
- **On-chain**: Permanently recorded for audit and accountability

## Key Features

- **Autonomous Service Discovery**: Agents discover x402-enabled services from the Coinbase Bazaar marketplace
- **zkML Spending Proofs**: Every payment decision generates a real SNARK proof (45-55KB) using JOLT-Atlas
- **Dual-Sided Compliance**: Both agent creators and payment recipients are screened via Circle Compliance Engine
- **Multi-Chain Architecture**: Proofs and identity on Arc L1, payments on Base (where most x402 services operate)
- **Shared Treasury Model**: Fund one wallet, all your agents draw from it
- **ERC-8004 Identity**: Soulbound NFT identity for each agent with global identifiers

## Key Concepts

### x402 Protocol

[x402](https://x402.org) is an HTTP-native payment standard that enables pay-per-request APIs. When you request a paid resource:

1. Server responds with `HTTP 402 Payment Required` and payment details
2. Client makes the payment (USDC transfer)
3. Client retries the request with payment proof in headers
4. Server returns the data

This enables a new economy of micropayments for AI services, data feeds, and compute resources.

### zkML (Zero-Knowledge Machine Learning)

zkML allows you to prove that a machine learning model was executed correctly without revealing the model's weights or inputs. Arc Agents uses zkML to prove spending decisions:

- **What it proves**: "This neural network received these inputs and produced this output"
- **What it hides**: Nothing in our case (we want transparency), but zkML can hide inputs if needed
- **Why it matters**: Cryptographic guarantee that the agent followed its rules, not just a log entry

### ERC-8004 Standard

ERC-8004 defines a standard for autonomous agent identity on Ethereum-compatible chains. Each Arc Agent has:

- **Global ID**: `eip155:{chainId}:{contract}:{agentId}` (e.g., `eip155:5042002:0x982C...384:0x00000001`)
- **Soulbound NFT**: Non-transferable identity token
- **Reputation**: On-chain feedback and ratings
- **Proof History**: All spending proofs linked to identity

### JOLT-Atlas SNARK Prover

[JOLT-Atlas](https://github.com/ICME-Lab/jolt-atlas) is the zero-knowledge proof system used by Arc Agents. Unlike simple hash commitments, JOLT-Atlas generates real SNARKs:

- **Polynomial Commitments**: HyperKZG over BN254 curve
- **Proof Size**: 45-55KB (real cryptographic proof)
- **Generation Time**: 4-12 seconds
- **Verification Time**: <150ms
- **Security**: Cryptographically sound, publicly verifiable

## Architecture Overview

```
                           USER INTERACTIONS
┌──────────────────────────────────────────────────────────────────────┐
│  Web UI (Next.js)  │  CLI (arc-agent)  │  Runtime (Scheduler)        │
│                    │                   │                              │
│  - Browse services │  - Launch agents  │  - Scheduled execution       │
│  - One-click launch│  - Fund treasury  │  - Auto-pay services         │
│  - View proofs     │  - Make requests  │  - Background processing     │
└─────────┬──────────────────┬────────────────────┬────────────────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             │
               ┌─────────────▼─────────────┐
               │    SDK (@arc-agent/sdk)   │
               │                           │
               │  - ArcAgentClient         │
               │  - BazaarClient (x402)    │
               │  - X402Client (payments)  │
               │  - ZkmlProver/Verifier    │
               │  - CircleWallets          │
               └─────────────┬─────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
   ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
   │ Arc L1    │       │   Base    │       │ JOLT-Atlas│
   │ Testnet   │       │           │       │  Prover   │
   │           │       │           │       │           │
   │ Contracts │       │   x402    │       │   zkML    │
   │ Identity  │       │ Payments  │       │  Proofs   │
   │ Proofs    │       │           │       │           │
   └───────────┘       └───────────┘       └───────────┘
```

### Multi-Chain Design

Arc Agents operates across two networks for practical reasons:

| Network | Chain ID | Purpose |
|---------|----------|---------|
| **Arc Testnet** | 5042002 | Smart contracts, identity, proof attestations |
| **Base** | 8453 | x402 service payments (97% of Bazaar services accept Base USDC) |

Your treasury wallet uses the same address on both networks, making funding simple.

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** (for building the SNARK prover) - Install via [rustup](https://rustup.rs/)
- **Git** for cloning the repository
- **USDC** on Arc Testnet and/or Base for funding agents

## Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/your-org/arcagent.git
cd arcagent
npm install
```

### 2. Build the SNARK Prover (First Time Only)

This takes approximately 10 minutes:

```bash
cd jolt-atlas
cargo build --release -p arc-prover
cd ..
```

### 3. Start the Services

Open two terminals:

**Terminal 1 - SNARK Prover (Port 3001):**
```bash
npm run dev:prover
```

**Terminal 2 - Web UI (Port 3000):**
```bash
npm run dev:ui
```

### 4. Access the Application

Open http://localhost:3000 in your browser.

### 5. Set Up Your Treasury

1. Click the **"Treasury"** button in the header
2. Choose **"Generate New Wallet"** or **"Import Existing"**
3. Fund the treasury address on both networks:
   - **Arc Testnet USDC**: Use [Circle Faucet](https://faucet.circle.com) → select "Arc Testnet"
   - **Base USDC**: Send USDC on Base mainnet, or use faucet for testing

## How Agent Execution Works

When you run an agent, here's the complete flow:

```
1. PROBE SERVICE
   └─ Free metadata request to x402 service
   └─ Get price, payment address, requirements
                    │
                    ▼
2. GATHER INPUTS
   └─ Price from payment offer
   └─ Budget from treasury (on-chain query)
   └─ Daily spending so far (local tracking)
   └─ Service reputation (success/failure history)
                    │
                    ▼
3. RUN SPENDING MODEL
   └─ ONNX neural network inference
   └─ 8 inputs → 3 outputs
   └─ Outputs: [shouldBuy, confidence, riskScore]
                    │
                    ▼
4. GENERATE ZKML PROOF
   └─ JOLT-Atlas SNARK generation (4-12 seconds)
   └─ Proof size: 45-55KB
   └─ Contains: model hash, inputs, outputs
                    │
                    ▼
5. DECISION
   ├─ shouldBuy < 0.5 → REJECT
   │  └─ Return proof of rejection (no payment made)
   │
   └─ shouldBuy >= 0.5 → APPROVE
      │
      ▼
6. COMPLIANCE CHECK
   └─ Screen recipient wallet via Circle Compliance
   └─ Block if sanctioned
                    │
                    ▼
7. PAYMENT
   └─ USDC transfer on Base network
   └─ Sign x402 payment header
                    │
                    ▼
8. EXECUTE SERVICE
   └─ Retry request with payment proof
   └─ Receive service data
                    │
                    ▼
9. ATTEST PROOF
   └─ Submit spending proof to ArcProofAttestation contract
   └─ Permanent on-chain record
```

**Key insight**: Even rejected spending decisions generate proofs. This means every decision your agent makes is cryptographically accountable.

## Spending Decision Model

The spending model is a small ONNX neural network (`ui/public/models/spending-model.onnx`, 1.7KB):

### Inputs (8 features)

| Input | Type | Description |
|-------|------|-------------|
| `priceUsdc` | float | Service price from x402 payment offer |
| `budgetUsdc` | float | Current treasury balance |
| `spentTodayUsdc` | float | Amount already spent today |
| `dailyLimitUsdc` | float | Maximum daily spending limit |
| `serviceSuccessRate` | float (0-1) | Historical success rate of this service |
| `serviceTotalCalls` | int | Number of times this service was used |
| `purchasesInCategory` | int | Recent purchases in same category |
| `timeSinceLastPurchase` | int | Seconds since last purchase |

### Outputs (3 values, sigmoid-normalized 0-1)

| Output | Description |
|--------|-------------|
| `shouldBuy` | Primary decision signal (>0.5 = approve) |
| `confidence` | Model's confidence in the decision |
| `riskScore` | Assessed risk level of the purchase |

## Project Structure

```
arcagent/
│
├── ui/                         # Next.js Web Application
│   ├── src/
│   │   ├── app/               # Pages and API routes
│   │   │   ├── api/execute/   # Agent execution endpoint
│   │   │   ├── api/zkml/      # Proof generation endpoint
│   │   │   ├── agents/        # Agent management page
│   │   │   ├── launch/        # Agent creation page
│   │   │   └── activity/      # Transaction history
│   │   ├── components/        # React components
│   │   │   ├── AgentExecutionPanel.tsx  # Run controls & results
│   │   │   ├── ServiceOutputDisplay.tsx # Service response viewer
│   │   │   ├── ProofExplorer.tsx        # Proof visualization
│   │   │   └── LaunchForm.tsx           # Agent creation form
│   │   └── lib/               # Utility libraries
│   │       ├── treasury.ts    # Shared treasury management
│   │       ├── arcPayment.ts  # Arc Testnet transfers
│   │       ├── multiChainPayment.ts # Base transfers
│   │       ├── x402Client.ts  # x402 protocol implementation
│   │       ├── zkmlService.ts # Proof generation client
│   │       └── agentStorage.ts # Local persistence
│   └── public/
│       └── models/            # ONNX model files
│           └── spending-model.onnx
│
├── sdk/                        # @arc-agent/sdk TypeScript SDK
│   └── src/
│       ├── core/agent.ts      # ArcAgentClient class
│       ├── discovery/         # Service discovery
│       │   ├── bazaar.ts      # Coinbase Bazaar integration
│       │   └── nexus.ts       # Nexus protocol (alternative)
│       ├── x402/client.ts     # x402 payment protocol
│       ├── zkml/              # Proof generation & verification
│       ├── circle/            # Circle Wallets & Compliance
│       ├── models/            # Decision model registry
│       ├── config.ts          # Network configurations
│       └── types.ts           # TypeScript interfaces
│
├── cli/                        # arc-agent Command Line Interface
│   └── src/
│       └── commands/
│           ├── services.ts    # Browse x402 services
│           ├── create.ts      # Launch agents
│           ├── fund.ts        # Treasury operations
│           ├── call.ts        # Make paid requests
│           ├── proof.ts       # Proof submission
│           └── config.ts      # CLI configuration
│
├── contracts/                  # Solidity Smart Contracts
│   └── core/
│       ├── ArcAgent.sol       # Main facade (entry point)
│       ├── ArcAgentIdentity.sol    # ERC-8004 identity NFTs
│       ├── ArcAgentReputation.sol  # Feedback & ratings
│       ├── ArcProofAttestation.sol # zkML proof storage
│       ├── ArcTreasury.sol         # USDC custody
│       └── ArcComplianceOracle.sol # Circle compliance bridge
│
├── runtime/                    # Agent Scheduler
│   └── src/
│       ├── index.ts           # Main entry point
│       ├── runner.ts          # Execution orchestration
│       └── cli.ts             # Manual run interface
│
├── oracle/                     # Compliance Oracle Microservice
│   └── src/
│       ├── oracle-service.ts  # Main oracle
│       └── circle-compliance.ts # Circle API integration
│
├── jolt-atlas/           # JOLT-Atlas SNARK Prover (Rust)
│   ├── arc-prover/            # HTTP prover service
│   │   ├── src/main.rs        # Axum HTTP server
│   │   └── models/            # ONNX model files
│   ├── zkml-jolt-core/        # JOLT zkML library
│   └── onnx-tracer/           # ONNX to JOLT compiler
│
└── docs/                       # Documentation
    ├── CLI.md                 # CLI reference
    └── DEPLOYMENT.md          # Deployment guide
```

## Smart Contracts

All contracts are deployed on Arc Testnet (Chain ID: 5042002):

| Contract | Address | Purpose |
|----------|---------|---------|
| **ArcAgent** | `0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384` | Main facade - entry point for all operations |
| **ArcAgentIdentity** | `0x60287b849721EB7ed3C6BbdB34B46be02E0e2678` | ERC-8004 soulbound identity NFTs |
| **ArcAgentReputation** | `0x106e73c96da621826d6923faA3361004e2db72a7` | Feedback, ratings, reputation tags |
| **ArcProofAttestation** | `0xBE9a5DF7C551324CB872584C6E5bF56799787952` | zkML proof storage & validation |
| **ArcTreasury** | `0x75E016aC75678344275fd47d6524433B81e46d0B` | USDC custody with daily limits |
| **ArcComplianceOracle** | `0xdB4E18Cc9290a234eB128f1321643B6c1B5936d1` | Circle Compliance bridge |

## CLI Usage

### Installation

```bash
npm install -g arc-agent
arc-agent config init
```

### Service Discovery

```bash
# List all x402 services from Bazaar
arc-agent services list

# Filter by category and price
arc-agent services list --category ai --max-price 0.05

# Search services
arc-agent services search "weather"

# Get detailed service info
arc-agent services info https://api.example.com

# Check if any endpoint supports x402
arc-agent services probe https://api.example.com
```

### Agent Management

```bash
# Create a new agent
arc-agent create agent --name my-agent --deposit 5

# Create agent for a specific service
arc-agent create for-service https://weather.x402.org --deposit 1

# List your agents
arc-agent list agents

# Check agent status
arc-agent status agent <agent-id>
```

### Treasury Operations

```bash
# Deposit USDC to an agent
arc-agent fund deposit <agent-id> 10

# Check balance
arc-agent fund balance <agent-id>
```

### Making Paid Requests

```bash
# Simple GET request
arc-agent call request <agent-id> https://api.example.com/data

# POST request with data
arc-agent call request <agent-id> https://api.example.com \
  --method POST \
  --data '{"query": "test"}' \
  --path /search

# Interactive service browser
arc-agent call browse <agent-id>
```

### Configuration

```bash
# Initialize configuration
arc-agent config init

# Set network (testnet/mainnet)
arc-agent config set-network testnet

# Set private key
arc-agent config set-key

# Show current configuration
arc-agent config show
```

## SDK Usage

```typescript
import {
  ArcAgentClient,
  bazaar,
  ARC_TESTNET,
} from '@arc-agent/sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from '@arc-agent/sdk/chains';

// Setup Viem clients
const account = privateKeyToAccount('0x...');
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});
const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(),
});

// Initialize Arc Agent client
const client = new ArcAgentClient({
  network: ARC_TESTNET,
  publicClient,
  wallet: walletClient,
});

// Discover x402 services
const services = await bazaar.listServices({ category: 'ai' });
console.log(`Found ${services.length} AI services`);

// Create an agent
const agent = await client.createAgent({
  name: 'my-ai-agent',
  initialDeposit: '10', // USDC
});
console.log(`Agent created: ${agent.globalId}`);

// Make paid requests
const x402 = client.createX402Client(agent.id);
const response = await x402.fetch('https://inference.x402.org/complete', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'Hello world' }),
});
const data = await response.json();
```

## Compliance Screening

Arc Agents implements **dual-sided compliance** via Circle Compliance Engine:

```
                 REGISTRATION                         PAYMENT
                     │                                   │
┌─────────────────┐  │  ┌─────────────────┐            │  ┌─────────────────┐
│  Agent Creator  │──┼─▶│   Arc Agent     │────────────┼─▶│  x402 Service   │
│                 │  │  │                 │            │  │                 │
│   (screened)    │  │  │                 │            │  │   (screened)    │
└─────────────────┘  │  └─────────────────┘            │  └─────────────────┘
                     │                                   │
              Blocked if                          Blocked if
              sanctioned                          sanctioned
```

| Checkpoint | Who's Screened | When |
|------------|----------------|------|
| **Registration** | Agent creator's wallet | Before agent creation |
| **Payment** | Service provider's wallet | Before each payment |

This ensures regulatory compliance for both sides of every transaction.

## Development

### Build Commands

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Build specific packages
npm run build:sdk       # SDK only
npm run build:cli       # CLI only
npm run build:ui        # Web UI only
npm run build:contracts # Smart contracts
npm run build:runtime   # Agent scheduler
npm run build:oracle    # Compliance oracle
npm run build:prover    # SNARK prover (Rust)

# Development mode
npm run dev             # All packages
npm run dev:ui          # Web UI only
npm run dev:prover      # SNARK prover only
npm run dev:oracle      # Compliance oracle only

# Testing
npm test

# Linting
npm run lint

# Deploy contracts
npm run deploy:testnet  # Arc Testnet
npm run deploy:mainnet  # Arc Mainnet (when live)
```

### Environment Variables

Create `.env.local` in the `ui/` directory:

```bash
# Required for compliance features
CIRCLE_API_KEY=your_circle_api_key

# Optional: Custom prover URL (defaults to localhost:3001)
NEXT_PUBLIC_PROVER_URL=http://localhost:3001

# Optional: Custom RPC endpoints
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
BASE_RPC=https://mainnet.base.org
```

## Troubleshooting

### Prover won't start

```bash
# Ensure Rust is installed
rustc --version

# Rebuild the prover
cd jolt-atlas
cargo clean
cargo build --release -p arc-prover
```

### "Treasury not found" error

Make sure you've set up a treasury wallet via the UI's Treasury button or imported a private key.

### Payments failing on Base

1. Verify your treasury has Base USDC (not just Arc Testnet USDC)
2. Check that the service accepts Base payments (most Bazaar services do)
3. Ensure you have enough balance for gas + payment

### Proof generation timeout

SNARK proof generation takes 4-12 seconds. If it's timing out:
1. Check that the prover service is running on port 3001
2. Verify the prover has enough memory (recommended: 4GB+)
3. Check prover logs for errors

## External Services

Arc Agents integrates with:

- **[Coinbase Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)** - x402 service discovery
- **[Circle Programmable Wallets](https://developers.circle.com/w3s/programmable-wallets)** - Agent wallet infrastructure
- **[Circle Compliance Engine](https://developers.circle.com/w3s/compliance)** - Sanctions screening
- **[JOLT-Atlas](https://github.com/ICME-Lab/jolt-atlas)** - Zero-knowledge proof system

## Resources

- [Arc Network](https://arc.network) - The Economic OS for the internet
- [x402 Protocol](https://x402.org) - HTTP-native payments standard
- [x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) - Coinbase service registry
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) - Autonomous agent identity standard

## Documentation

- [CLI Reference](./docs/CLI.md) - Complete command-line interface documentation
- [Deployment Guide](./docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [UI Documentation](./ui/README.md) - Web interface details

## License

MIT
