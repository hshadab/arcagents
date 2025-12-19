# Arc Agents

A framework for launching and managing AI agents with x402 payment capabilities on [Arc L1](https://arc.network).

Arc Agents can autonomously discover, connect to, and pay for x402-enabled services using USDC.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARC AGENT FRAMEWORK                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │     Web UI      │    │   CLI (arc-     │    │    Runtime      │         │
│  │   (Next.js)     │    │     agent)      │    │   (Cron Job)    │         │
│  │                 │    │                 │    │                 │         │
│  │ • Browse x402   │    │ • Launch agents │    │ • Scheduled     │         │
│  │ • One-click     │    │ • Fund treasury │    │   execution     │         │
│  │   launching     │    │ • Make requests │    │ • Auto-pay      │         │
│  │ • Dashboard     │    │ • Proof submit  │    │   services      │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  │                                          │
│                    ┌─────────────▼─────────────┐                            │
│                    │    SDK (@arc-agent/sdk)   │                            │
│                    │                           │                            │
│                    │  • ArcAgentClient         │                            │
│                    │  • BazaarClient (x402)    │                            │
│                    │  • X402Client (payments)  │                            │
│                    │  • CircleWallets          │                            │
│                    │  • ZkmlProver/Verifier    │                            │
│                    │  • Input Validation       │                            │
│                    └─────────────┬─────────────┘                            │
│                                  │                                          │
│  ┌───────────────────────────────┼───────────────────────────────┐         │
│  │                    SMART CONTRACTS (Arc L1)                    │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │         │
│  │  │  ArcAgent    │  │ ArcIdentity  │  │  ArcProofAttestation │ │         │
│  │  │  (Facade)    │  │  (ERC-8004)  │  │     (zkML Proofs)    │ │         │
│  │  │              │  │              │  │                      │ │         │
│  │  │ Entry point  │  │ Soulbound    │  │ Proof storage &      │ │         │
│  │  │ for all ops  │  │ NFT identity │  │ validation registry  │ │         │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │         │
│  │  │ ArcTreasury  │  │ArcReputation │  │ ArcComplianceOracle  │ │         │
│  │  │              │  │  (ERC-8004)  │  │                      │ │         │
│  │  │ USDC custody │  │ Feedback &   │  │ Screens RECIPIENTS   │ │         │
│  │  │ Multi-step   │  │ ratings      │  │ (x402 providers)     │ │         │
│  │  │ transfers    │  │              │  │ via Circle API       │ │         │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                            EXTERNAL SERVICES                                 │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  x402 Bazaar    │    │     Circle      │    │   x402 Service  │         │
│  │  (Coinbase)     │    │   (Wallets &    │    │   Providers     │         │
│  │                 │    │   Compliance)   │    │                 │         │
│  │ Service         │    │ Wallets: Agent  │    │ Weather, AI,    │         │
│  │ discovery       │    │ Compliance:     │    │ Data, etc.      │         │
│  │                 │    │ Screen payees   │    │ (recipients)    │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Status

| Contract | Testnet Address | Status |
|----------|-----------------|--------|
| ArcAgentIdentity | `0x60287b849721EB7ed3C6BbdB34B46be02E0e2678` | ✅ Deployed |
| ArcAgentReputation | `0x106e73c96da621826d6923faA3361004e2db72a7` | ✅ Deployed |
| ArcProofAttestation | `0xBE9a5DF7C551324CB872584C6E5bF56799787952` | ✅ Deployed |
| ArcTreasury | `0x75E016aC75678344275fd47d6524433B81e46d0B` | ✅ Deployed |
| ArcComplianceOracle | `0xdB4E18Cc9290a234eB128f1321643B6c1B5936d1` | ✅ Deployed |
| ArcAgent (facade) | `0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384` | ✅ Deployed |

**Network:** Arc Testnet (Chain ID: 5042002)

## Quick Start

### Web UI + SNARK Prover

```bash
# Install dependencies
npm install

# Build the SNARK prover (first time only, ~10 min)
cd jolt-atlas-fork && cargo build --release -p arc-prover && cd ..

# Start the SNARK prover (port 3001)
npm run dev:prover

# In another terminal, start the UI (port 3000)
npm run dev:ui

# Open http://localhost:3000
```

**Services:**
- **UI**: http://localhost:3000 - Web interface
- **Prover**: http://localhost:3001 - JOLT-Atlas SNARK prover

The UI lets you:
- Browse available x402 services from the Bazaar
- **Set up a shared treasury** - All agents draw from one wallet
- Launch agents for specific services
- Execute agents manually or on schedule
- View zkML spending proofs and compliance results
- Track payments and activity history

### Shared Treasury Model

Arc Agents uses a **shared treasury** - you fund one wallet and all agents draw from it:

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED TREASURY                          │
│                     (0x1234...)                             │
│                                                             │
│    Fund once on TWO networks (same address):                │
│    ├── Arc Testnet USDC → proof attestations & contracts   │
│    └── Base USDC → x402 service payments                   │
│                                                             │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│    │ Agent 1  │  │ Agent 2  │  │ Agent 3  │                │
│    │ (News)   │  │ (Weather)│  │ (AI)     │                │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘                │
│         └──────────────┼──────────────┘                     │
│                        ▼                                    │
│              All agents pay from treasury                   │
└─────────────────────────────────────────────────────────────┘
```

**Setup:**
1. Click **"Treasury"** button in the header
2. Generate a new wallet or import an existing private key
3. Fund the treasury address on both networks:
   - **Arc Testnet**: [Circle Faucet](https://faucet.circle.com) → select "Arc Testnet"
   - **Base**: Send USDC on Base, or faucet → "Base Sepolia" for testing

See [UI README](./ui/README.md) for detailed documentation.

### CLI

```bash
# Install
npm install -g arc-agent

# Configure
arc-agent config init

# Browse x402 services
arc-agent services list

# Launch an agent for a service
arc-agent create for-service https://weather.x402.org --deposit 1

# Make a paid request
arc-agent call request <agent-id> https://weather.x402.org/forecast?city=NYC
```

### SDK

```typescript
import {
  ArcAgentClient,
  bazaar,
  ARC_TESTNET,
} from '@arc-agent/sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Setup clients
const account = privateKeyToAccount('0x...');
const publicClient = createPublicClient({ ... });
const walletClient = createWalletClient({ account, ... });

// Initialize Arc Agent client
const client = new ArcAgentClient({
  network: ARC_TESTNET,
  publicClient,
  wallet: walletClient,
});

// Discover x402 services
const services = await bazaar.listServices({ category: 'ai' });

// Launch an agent
const agent = await client.createAgent({
  name: 'my-ai-agent',
  initialDeposit: '10', // USDC
});

// Make paid requests
const x402 = client.createX402Client(agent.id);
const response = await x402.fetch('https://inference.x402.org/complete', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'Hello world' }),
});
```

## Architecture

### x402 Service Discovery

Arc Agents discovers services from the x402 ecosystem:
- **[Coinbase Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)** - Official x402 registry

```bash
# List all services
arc-agent services list

# Search services
arc-agent services search "weather"

# Filter by category
arc-agent services list --category ai --max-price 0.05

# Probe any endpoint for x402 support
arc-agent services probe https://api.example.com
```

### zkML Spending Proofs

All Arc agents generate **zkML proofs for spending decisions**, providing cryptographic accountability for every x402 payment.

#### Agent Execution Flow

Every agent generates a zkML proof for their spending decision before making any payment:

```
1. PROBE          → Free metadata request to x402 service
                    ↓
2. SPENDING MODEL → Run spending ONNX model (price, budget, reputation)
                    ↓
3. SPENDING PROOF → Generate zkML SNARK proof (JOLT-Atlas)
                    ↓
4. DECISION       → shouldBuy > 0.5?
                    │
                    ├─ REJECT → Return result + spending proof, NO payment
                    │
                    └─ APPROVE → Continue to payment
                                 ↓
5. COMPLIANCE     → Screen recipient wallet (Circle Compliance)
                    ↓
6. PAY            → USDC transfer on Base (x402 payment)
                    ↓
7. EXECUTE        → Fetch service data with payment receipt
                    ↓
8. ATTEST         → Submit spending proof to ArcProofAttestation
```

**Key principle**: Every x402 payment has cryptographic accountability:
- Spending decision is proven with zkML (all agents)
- Rejected decisions still return their spending proof
- On-chain attestation via ArcProofAttestation contract

#### Spending Model

The spending model is an ONNX neural network (`/ui/public/models/spending-model.onnx`, 1.7KB):

| Input | Description |
|-------|-------------|
| `priceUsdc` | Service price from x402 payment offer |
| `budgetUsdc` | Treasury balance (on-chain query) |
| `spentTodayUsdc` | Amount spent today (local tracking) |
| `dailyLimitUsdc` | Max daily spend policy |
| `serviceSuccessRate` | Historical success rate (0-1) |
| `serviceTotalCalls` | Number of times used |
| `purchasesInCategory` | Recent purchases in category |
| `timeSinceLastPurchase` | Seconds since last purchase |

**Output**: `[shouldBuy, confidence, riskScore]` (all 0-1 after sigmoid)

#### JOLT-Atlas SNARK Prover

The prover service generates real zero-knowledge proofs using [JOLT-Atlas](https://github.com/ICME-Lab/jolt-atlas):

```bash
# Start the SNARK prover service
cd jolt-atlas-fork
MODELS_DIR=./arc-prover/models PORT=3001 cargo run --release -p arc-prover

# Or use the convenience script
npm run dev:prover
```

**Proof Characteristics:**
- **Polynomial Commitments**: HyperKZG over BN254 curve
- **Proof Size**: 45-55KB (real SNARK, not commitment hashes)
- **Generation Time**: 4-12 seconds depending on model complexity
- **Verification**: Local verification in <150ms
- **Security**: Cryptographically sound, publicly verifiable, zero-knowledge capable

### Agent Lifecycle

1. **Set up Treasury** - Create or import a shared treasury wallet
2. **Fund Treasury** - Deposit USDC on Arc Testnet + Base (same address)
3. **Create Agent** - Launch agent connected to an x402 service
4. **Execute** - Agent calls service, pays from shared treasury

### Compliance Screening (Dual-Sided)

Arc implements **dual-sided compliance** via Circle Compliance Engine:

| Checkpoint | Who's Screened | When |
|------------|----------------|------|
| **Registration** | Agent creator's wallet | Before creating an agent |
| **Payment** | x402 service provider's wallet | Before each payment |

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Agent Creator  │────▶│   Arc Agent     │────▶│  x402 Service   │
│   (screened)    │     │                 │     │   (screened)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↑                                               ↑
   Blocked if                                    Blocked if
   sanctioned                                    sanctioned
```

**Why dual-sided:**
- **Registration screening**: Prevents sanctioned entities from creating agents on the platform
- **Payment screening**: Prevents agents from paying sanctioned service providers

This ensures full regulatory compliance for both sides of every transaction.

### How x402 Payments Work

```
Agent                          x402 Service
  │                                 │
  │  GET /api/data                  │
  │────────────────────────────────>│
  │                                 │
  │  HTTP 402 Payment Required      │
  │  PAYMENT-REQUIRED: {price, ...} │
  │<────────────────────────────────│
  │                                 │
  │  GET /api/data                  │
  │  X-PAYMENT: <signed payload>    │
  │────────────────────────────────>│
  │                                 │
  │  HTTP 200 OK                    │
  │  PAYMENT-RESPONSE: {txHash}     │
  │<────────────────────────────────│
```

## Project Structure

```
arcagent/
├── ui/                 # Next.js Web UI
│   └── src/
│       ├── app/
│       │   ├── api/execute/       # Agent execution API
│       │   ├── api/zkml/prove/    # zkML proof generation API
│       │   ├── agents/            # Agent management
│       │   └── launch/            # Agent creation
│       ├── components/
│       │   ├── AgentExecutionPanel.tsx  # Run controls & results
│       │   ├── ServiceOutputDisplay.tsx # Service response viewer
│       │   └── LaunchForm.tsx           # Agent creation form
│       └── lib/
│           ├── treasury.ts        # Shared treasury management
│           ├── arcPayment.ts      # Arc Testnet USDC transfers
│           ├── multiChainPayment.ts # Base USDC transfers (x402)
│           ├── x402Client.ts      # x402 protocol client
│           ├── zkmlService.ts     # zkML proof client
│           └── agentStorage.ts    # Agent persistence
│
├── jolt-atlas-fork/    # JOLT-Atlas zkML SNARK prover
│   ├── arc-prover/     # HTTP prover service (Rust/Axum)
│   │   ├── src/main.rs           # Prover HTTP server
│   │   └── models/               # ONNX model files
│   ├── zkml-jolt-core/ # JOLT zkML core library
│   └── onnx-tracer/    # ONNX model tracer for JOLT
│
├── contracts/          # Solidity smart contracts
│   ├── core/
│   │   ├── ArcAgent.sol           # Main facade contract
│   │   ├── ArcAgentIdentity.sol   # ERC-8004 identity registry
│   │   ├── ArcAgentReputation.sol # Reputation/feedback system
│   │   ├── ArcProofAttestation.sol# zkML proof attestation
│   │   ├── ArcTreasury.sol        # USDC custody & transfers
│   │   └── ArcComplianceOracle.sol# Circle compliance integration
│   └── scripts/
│       └── deploy.js
│
├── sdk/                # @arc-agent/sdk
│   └── src/
│       ├── core/agent.ts          # Agent management client
│       ├── discovery/bazaar.ts    # x402 Bazaar integration
│       └── x402/client.ts         # x402 payment client
│
└── cli/                # arc-agent CLI
    └── src/
        └── commands/
            ├── services.ts        # Browse x402 services
            ├── create.ts          # Launch agents
            ├── fund.ts            # Treasury operations
            ├── call.ts            # Make paid requests
            └── config.ts          # CLI configuration
```

## CLI Commands

### Service Discovery

```bash
# List x402 services from Bazaar
arc-agent services list
arc-agent services list --category data --max-price 0.01

# Search services
arc-agent services search "inference"

# Get service details
arc-agent services info https://api.example.com

# Probe endpoint for x402 support
arc-agent services probe https://api.example.com
```

### Agent Management

```bash
# Create an agent
arc-agent create agent --name my-agent --deposit 5

# Create agent for specific service
arc-agent create for-service https://weather.x402.org

# List your agents
arc-agent list agents

# Check agent status
arc-agent status agent <agent-id>
```

### Treasury

```bash
# Deposit USDC
arc-agent fund deposit <agent-id> 10

# Check balance
arc-agent fund balance <agent-id>
```

### Making Requests

```bash
# Make a paid request
arc-agent call request <agent-id> https://api.example.com/data

# With options
arc-agent call request <agent-id> https://api.example.com \
  --method POST \
  --data '{"query": "test"}' \
  --path /search

# Interactive service browser
arc-agent call browse <agent-id>
```

### Configuration

```bash
# Initialize config
arc-agent config init

# Set network
arc-agent config set-network testnet

# Set private key
arc-agent config set-key

# Show current config
arc-agent config show
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build:sdk
npm run build:cli
npm run build:contracts

# Run tests
npm test
```

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Arc Testnet | 5042002 | https://rpc.testnet.arc.network |
| Arc Mainnet | 5042001 | https://rpc.arc.network (not yet live) |

## Resources

- [Arc Network](https://arc.network) - The Economic OS for the internet
- [x402 Protocol](https://x402.org) - HTTP-native payments standard
- [x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) - Coinbase service discovery
- [Circle Programmable Wallets](https://developers.circle.com/w3s/programmable-wallets) - Agent wallet infrastructure

## Documentation

- [CLI Reference](./docs/CLI.md) - Complete command-line interface documentation
- [Deployment Guide](./docs/DEPLOYMENT.md) - Step-by-step deployment instructions

## License

MIT
