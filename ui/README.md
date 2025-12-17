# Arc Agents UI

A Next.js web application for spawning and managing AI agents with x402 payment capabilities on Arc L1.

## Features

- **Service Discovery** - Browse x402 services from the Coinbase Bazaar
- **Agent Spawning** - Create agents with on-chain identity and wallets
- **Agent Execution** - Run agents manually or on schedule
- **zkML Proofs** - Generate and verify JOLT-Atlas proofs for ML agents
- **Real Payments** - USDC payments on Arc Testnet via x402 protocol
- **Compliance** - Circle Compliance Engine integration for address screening

## Getting Started

```bash
# Install dependencies
npm install

# Create .env.local (optional - for real payments)
cp .env.example .env.local

# Run development server
npm run dev

# Build for production
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

```env
# Optional - enables real Arc Testnet payments
NEXT_PUBLIC_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# Optional - enables Circle compliance checking
CIRCLE_API_KEY=your_circle_api_key
```

Without environment variables, the app runs in simulation mode.

## Agent Execution Flow

### Simple Agents (Data Fetch)

```
User clicks "Run" → Probe Service → Make Payment → Get Data → Display
```

Simple agents fetch data from x402 services without ML decision-making.

### ML Agents (with zkML Proofs)

```
User clicks "Run"
    ↓
1. Probe Service (free metadata request)
    ↓
2. Run Model Inference (ONNX model)
    ↓
3. Generate zkML Proof (JOLT-Atlas)
    ↓
4. Verify Proof Locally
    ↓
5. Check Model Decision (output >= threshold?)
    ↓
   [If REJECT] → Return result, NO payment
   [If APPROVE] → Continue
    ↓
6. Make USDC Payment on Arc Testnet
    ↓
7. Execute Service with Payment Receipt
    ↓
8. Display Results + Proof
```

**Key principle**: For ML agents, the proof is generated BEFORE payment. Payment only proceeds if:
- Proof verification passes
- Model decision meets the threshold

This ensures verifiable, accountable AI decisions on-chain.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with framework overview |
| `/spawn` | Create new agents with wallet generation |
| `/agents` | Manage agents, execute, view history |
| `/activity` | Global activity log with proof submissions |
| `/how-to-use` | Step-by-step usage guide |
| `/about` | About Arc Agents framework |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/bazaar` | GET | Fetch x402 services from Coinbase Bazaar |
| `/api/execute` | POST | Execute agent (probe → pay → fetch) |
| `/api/activity` | GET/POST | Activity log management |
| `/api/circle/wallet` | POST | Create Circle wallet (if configured) |
| `/api/circle/compliance` | PUT | Run compliance check on address |

## Key Components

- `SpawnForm` - Agent creation with wallet generation
- `AgentExecutionPanel` - Run controls, scheduling, results display
- `ServiceOutputDisplay` - Formatted service response viewer
- `ServiceList` - x402 service browser with filtering

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **viem** - Ethereum/Arc wallet interactions
- **wagmi** - React hooks for blockchain

## Project Structure

```
ui/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   │   ├── execute/    # Agent execution endpoint
│   │   │   ├── bazaar/     # x402 service discovery
│   │   │   └── activity/   # Activity logging
│   │   ├── agents/         # Agent management page
│   │   ├── spawn/          # Agent creation page
│   │   └── activity/       # Activity dashboard
│   ├── components/         # React components
│   │   ├── AgentExecutionPanel.tsx
│   │   ├── ServiceOutputDisplay.tsx
│   │   ├── SpawnForm.tsx
│   │   └── ServiceList.tsx
│   └── lib/                # Utilities
│       ├── arcPayment.ts   # Arc Testnet USDC transfers
│       ├── x402Client.ts   # x402 protocol client
│       └── agentStorage.ts # LocalStorage persistence
└── public/                 # Static assets
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

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Arc Testnet | 5042002 | https://rpc.testnet.arc.network |

## License

MIT
