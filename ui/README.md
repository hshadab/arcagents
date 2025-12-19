# Arc Agents UI

A Next.js web application for launching and managing AI agents with x402 payment capabilities.

## Features

- **Service Discovery** - Browse x402 services from the Coinbase Bazaar
- **Shared Treasury** - Fund one wallet, all agents draw from it
- **Dual-Network Payments** - Arc Testnet for proofs, Base for x402 payments
- **Agent Launching** - Create agents tied to specific x402 services
- **Agent Execution** - Run agents manually or on schedule
- **Universal zkML Proofs** - ALL agents generate zkML proofs for spending decisions
- **Compliance** - Circle Compliance Engine integration for address screening

## Getting Started

```bash
# Install dependencies
npm install

# Create .env.local (optional - for real payments)
cp .env.example .env.local

# Run server (builds first, then serves - fast page loads)
npm run dev

# Build for production
npm run build
npm run start
```

> **Note**: `npm run dev` builds then serves for fast page navigation.
> Use `npm run dev:hot` only if you need hot reload during active development (slow - 15K modules compile on each page).

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Shared Treasury

Arc Agents uses a **shared treasury model** - you fund one wallet and all agents draw from it for payments.

### Setup Treasury

1. Click **"Treasury"** button in the header (amber = not set up, green = ready)
2. Choose one:
   - **Generate New Wallet** - Creates a new EVM wallet
   - **Import Existing Key** - Use your own private key
3. Fund the treasury address on **both networks**:

| Network | Purpose | How to Fund |
|---------|---------|-------------|
| **Arc Testnet** | Proof attestations, smart contracts | [Circle Faucet](https://faucet.circle.com) → "Arc Testnet" |
| **Base** | x402 service payments (real USDC) | Send USDC on Base, or faucet → "Base Sepolia" for testing |

**Note**: The same address works on both networks (EVM addresses are chain-agnostic).

### Why Two Networks?

```
┌─────────────────────────────────────────────────────────────┐
│                    TREASURY WALLET                          │
│                     (0x1234...)                             │
├─────────────────────────────┬───────────────────────────────┤
│       ARC TESTNET           │           BASE                │
│                             │                               │
│  • zkML proof attestations  │  • x402 service payments      │
│  • Smart contract calls     │  • Real USDC transfers        │
│  • On-chain identity        │  • Coinbase Bazaar services   │
└─────────────────────────────┴───────────────────────────────┘
```

- **Arc Testnet**: Home chain for Arc infrastructure (proofs, identity, contracts)
- **Base**: Where x402 services accept payment (97% of Bazaar services)

## Environment Variables

```env
# JOLT-Atlas SNARK prover service URL (required for real proofs)
JOLT_ATLAS_SERVICE_URL=http://localhost:3001

# Optional - enables Circle compliance checking
CIRCLE_API_KEY=your_circle_api_key
```

**Running the Prover:**
```bash
# From project root
cd jolt-atlas-fork
MODELS_DIR=./arc-prover/models PORT=3001 cargo run --release -p arc-prover
```

Without `JOLT_ATLAS_SERVICE_URL`, the app uses commitment proofs (256 bytes) instead of real SNARK proofs (45-55KB).

## Agent Execution Flow

**Every Arc Agent generates a zkML spending proof** before making any x402 payment, providing cryptographic accountability for all transactions.

```
User clicks "Run"
    ↓
┌─────────────────────────────────────────────────────────────┐
│              PHASE 1: SPENDING DECISION (Pre-Payment)       │
├─────────────────────────────────────────────────────────────┤
│  1. Probe Service (get price, metadata)                     │
│  2. Gather spending inputs:                                 │
│     • price from x402 payment offer                         │
│     • budget from treasury balance (on-chain query)         │
│     • daily spending so far (local tracking)                │
│     • service reputation (success/failure history)          │
│  3. Run Spending Model → APPROVE/REJECT + confidence        │
│  4. Generate zkML Spending Proof (JOLT-Atlas)               │
│  5. [If REJECT] → Stop, return proof of rejection           │
│  6. Run Compliance Check (Circle if configured)             │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              PHASE 2: PAYMENT & DATA (Post-Decision)        │
├─────────────────────────────────────────────────────────────┤
│  7. Make USDC Payment from Treasury (Base)                  │
│  8. Get Service Data (with payment receipt)                 │
│  9. Record service result (success/failure tracking)        │
└─────────────────────────────────────────────────────────────┘
    ↓
Display Results + Spending Decision + zkML Proof
```

### Spending Model

The spending model evaluates purchase decisions using **pre-payment data**:

| Input | Source | Description |
|-------|--------|-------------|
| `priceUsdc` | x402 payment offer | Service price |
| `budgetUsdc` | On-chain treasury query | Available USDC balance |
| `spentTodayUsdc` | Local tracking | Amount spent today |
| `dailyLimitUsdc` | Agent policy | Max daily spend |
| `serviceSuccessRate` | Local tracking | Historical success rate |
| `serviceTotalCalls` | Local tracking | Number of times used |
| `purchasesInCategory` | Local tracking | Recent purchases in category |
| `timeSinceLastPurchase` | Local tracking | Seconds since last purchase |

**Hard Blocks** (immediate rejection):
- Price > max single purchase limit
- Would exceed daily spending limit
- Insufficient treasury balance
- Service success rate below minimum (if 3+ calls)

**Risk Factors** (affect confidence):
- High budget ratio (>50% of treasury)
- New/unknown service
- Near daily limit (>80% used)
- Rapid spending (<60s between purchases)
- Category concentration

## zkML Spending Model

The spending model is an ONNX neural network (`/public/models/spending-model.onnx`, 1.7KB) that evaluates whether a purchase should proceed:

| Input | Type | Description |
|-------|------|-------------|
| `priceUsdc` | float | Service price |
| `budgetUsdc` | float | Treasury balance |
| `spentTodayUsdc` | float | Today's spending |
| `dailyLimitUsdc` | float | Max daily spend |
| `serviceSuccessRate` | float | 0-1 success rate |
| `serviceTotalCalls` | int | Historical calls |
| `purchasesInCategory` | int | Recent category purchases |
| `timeSinceLastPurchase` | int | Seconds since last |

**Architecture**: MLP (8 → 16 → 8 → 3)
**Output**: `[shouldBuy, confidence, riskScore]` (all 0-1 after sigmoid)
**Proof Tag**: `spending`

Every agent runs this model and generates a zkML proof for accountability.

**SNARK Proof Characteristics:**
- Polynomial commitments: HyperKZG over BN254 curve
- Cryptographically sound and publicly verifiable
- Zero-knowledge capable (inputs can be hidden)
- Proof generation: ~5s, Size: ~40KB

## Pages

| Route | Description |
|-------|-------------|
| `/` | Service discovery - browse x402 services and launch agents |
| `/launch?service=<url>` | Create agent for a specific service |
| `/agents` | Manage agents, execute, view history |
| `/activity` | Global activity log with proof submissions |
| `/how-to-use` | Step-by-step usage guide |
| `/about` | About Arc Agents framework |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/bazaar` | GET | Fetch x402 services from Coinbase Bazaar |
| `/api/execute` | POST | Execute agent (probe → pay from treasury → fetch) |
| `/api/zkml/prove` | POST | Generate zkML proof with real ONNX inference |
| `/api/activity` | GET/POST | Activity log management |
| `/api/circle/wallet` | POST | Create Circle wallet (if configured) |
| `/api/circle/compliance` | PUT | Run compliance check on address |

### zkML Prove API

```bash
curl -X POST http://localhost:3000/api/zkml/prove \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "trading-signal",
    "inputs": {"price": 45000, "volume": 1000000},
    "threshold": 0.7
  }'
```

Response includes:
- Real ONNX inference results (output, rawOutput, decision, confidence)
- Model hash (SHA-256 of ONNX file)
- Real SNARK proof (45-55KB, HyperKZG/BN254)
- Proof hash for on-chain attestation
- Generation time and prover version

**Example Response:**
```json
{
  "success": true,
  "inference": {
    "output": 0.73,
    "rawOutput": [0.1, 0.73, 0.12, 0.05],
    "decision": "approve",
    "confidence": 0.46
  },
  "proof": {
    "proofHash": "0xbf5320eeb4d21e47...",
    "metadata": {
      "modelHash": "0x64f8079d6f44d488...",
      "proofSize": 55586,
      "generationTime": 4743,
      "proverVersion": "jolt-atlas-snark-v1.0.0"
    }
  }
}
```

## Key Components

- `Header` - Navigation + Treasury button
- `TreasurySetup` - Treasury wallet setup modal
- `LaunchForm` - Agent creation with service connection
- `AgentExecutionPanel` - Run controls, scheduling, results display
- `ServiceOutputDisplay` - Formatted service response viewer
- `ServiceList` - x402 service browser with filtering

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **viem** - Ethereum/EVM wallet interactions
- **wagmi** - React hooks for blockchain

## Project Structure

```
ui/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   │   ├── execute/    # Agent execution endpoint
│   │   │   ├── zkml/prove/ # zkML proof generation with ONNX
│   │   │   ├── bazaar/     # x402 service discovery
│   │   │   └── activity/   # Activity logging
│   │   ├── agents/         # Agent management page
│   │   ├── launch/         # Agent creation page
│   │   └── activity/       # Activity dashboard
│   ├── components/         # React components
│   │   ├── Header.tsx             # Nav + Treasury button
│   │   ├── TreasurySetup.tsx      # Treasury wallet modal
│   │   ├── AgentExecutionPanel.tsx
│   │   ├── ServiceOutputDisplay.tsx
│   │   ├── LaunchForm.tsx
│   │   └── ServiceList.tsx
│   └── lib/                # Utilities
│       ├── treasury.ts          # Shared treasury + on-chain balance query
│       ├── spendingModel.ts     # Spending decision model (pre-payment)
│       ├── serviceReputation.ts # Service success/failure tracking
│       ├── multiChainPayment.ts # Base USDC transfers
│       ├── arcPayment.ts        # Arc Testnet transfers
│       ├── x402Client.ts        # x402 protocol client
│       ├── models.ts            # ONNX model configs & hashes
│       ├── zkmlService.ts       # zkML proof generation
│       ├── onnxInference.ts     # Browser ONNX inference
│       └── agentStorage.ts      # Agent LocalStorage
└── public/
    └── models/             # ONNX model files
        └── spending-model.onnx        # Spending decisions (1.7KB)
```

## Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run lint

# Build for production
npm run build
```

## Network Configuration

| Network | Chain ID | RPC URL | Purpose |
|---------|----------|---------|---------|
| Arc Testnet | 5042002 | https://rpc.testnet.arc.network | Proofs, contracts |
| Base | 8453 | https://mainnet.base.org | x402 payments |
| Base Sepolia | 84532 | https://sepolia.base.org | Testing |

## License

MIT
