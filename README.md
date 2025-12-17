# Arc Agents

A framework for spawning and managing AI agents with x402 payment capabilities on [Arc L1](https://arc.network).

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
│  │ • Browse x402   │    │ • Spawn agents  │    │ • Scheduled     │         │
│  │ • One-click     │    │ • Fund treasury │    │   execution     │         │
│  │   spawning      │    │ • Make requests │    │ • Auto-pay      │         │
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

### Web UI

```bash
# Install dependencies
npm install

# Run the UI
npm run dev:ui

# Open http://localhost:3000
```

The UI lets you:
- Browse available x402 services from the Bazaar
- Spawn agents with auto-generated wallets
- Execute agents manually or on schedule
- View model inference results and zkML proofs
- Track payments and activity history

See [UI README](./ui/README.md) for detailed documentation.

### CLI

```bash
# Install
npm install -g arc-agent

# Configure
arc-agent config init

# Browse x402 services
arc-agent services list

# Spawn an agent for a service
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

// Spawn an agent
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

### Agent Types

Arc supports two types of agents:

| Type | Workflow | Use Case |
|------|----------|----------|
| **Simple Agent** | Probe → Pay → Execute | Data aggregation, scheduled tasks |
| **ML Agent** | Probe → Model → Prove → Pay | Verifiable AI decisions |

**Simple agents** call x402 services directly without ML decision-making.

**ML agents** run ONNX models locally and generate JOLT-Atlas zkML proofs *before* payment. The proof verifies the model computed correctly, providing on-chain accountability.

#### ML Agent Execution Flow (Proof-First)

```
1. PROBE      → Free metadata request to x402 service
                ↓
2. INFERENCE  → Run ONNX model on probe data
                ↓
3. PROOF      → Generate zkML proof (JOLT-Atlas)
                ↓
4. VERIFY     → Local proof verification
                ↓
5. DECISION   → Model output >= threshold?
                │
                ├─ REJECT → Return result, NO payment made
                │
                └─ APPROVE → Continue to payment
                             ↓
6. PAY        → USDC transfer on Arc Testnet
                ↓
7. EXECUTE    → Fetch service data with payment receipt
```

**Key principle**: Proofs are generated BEFORE payment. This ensures:
- Model execution is verifiable before spending funds
- Rejected decisions (below threshold) don't incur costs
- On-chain accountability for all approved actions

### Agent Lifecycle

1. **Create** - Spawn agent with on-chain identity (ERC-8004)
2. **Fund** - Deposit USDC into agent's treasury
3. **Connect** - Discover and connect to x402 services
4. **Transact** - Agent autonomously pays for services

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
│       │   ├── agents/            # Agent management
│       │   └── spawn/             # Agent creation
│       ├── components/
│       │   ├── AgentExecutionPanel.tsx  # Run controls & results
│       │   ├── ServiceOutputDisplay.tsx # Service response viewer
│       │   └── SpawnForm.tsx            # Agent creation form
│       └── lib/
│           ├── arcPayment.ts      # Arc Testnet USDC transfers
│           ├── x402Client.ts      # x402 protocol client
│           └── agentStorage.ts    # Agent persistence
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
            ├── create.ts          # Spawn agents
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
