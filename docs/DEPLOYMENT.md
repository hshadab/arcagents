# Arc Agent Deployment Guide

Complete guide for deploying Arc Agent infrastructure to Arc testnet and mainnet.

## Prerequisites

### Required Software

- **Node.js**: v18.0.0 - v22.x (Hardhat doesn't support v23+)
- **npm**: v8+
- **Git**: For version control

### Required Accounts & Keys

1. **Deployer Wallet**: EOA with sufficient ARC tokens for gas
2. **Circle Developer Account**: For Programmable Wallets & Compliance (optional)
3. **USDC**: Test USDC on Arc testnet

### Network Information

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Arc Testnet | 5042002 | https://rpc.testnet.arc.network | https://testnet.arcscan.app |
| Arc Mainnet | 5042001 | https://rpc.arc.network | https://arcscan.app |

---

## Step 1: Environment Setup

### Clone & Install

```bash
git clone https://github.com/your-org/arcagent.git
cd arcagent
npm install
```

### Configure Environment

```bash
# Copy example environment file
cp contracts/.env.example contracts/.env

# Edit with your values
nano contracts/.env
```

**Required Environment Variables:**

```env
# Deployment
DEPLOYER_PRIVATE_KEY=0x...your_private_key_here...

# Arc Network RPC
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
ARC_MAINNET_RPC=https://rpc.arc.network

# USDC Contract Address (get from Arc docs)
USDC_ADDRESS=0x...usdc_address...

# Fee Collector (receives protocol fees)
FEE_COLLECTOR=0x...your_fee_collector_address...

# Circle Integration (optional)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret
```

---

## Step 2: Get Testnet Tokens

### Arc Testnet Faucet

1. Visit the Arc testnet faucet (check Arc docs for URL)
2. Connect your deployer wallet
3. Request test ARC tokens

### Testnet USDC

1. Visit [Circle Faucet](https://faucet.circle.com/)
2. Select Arc Testnet
3. Request test USDC

---

## Step 3: Deploy Smart Contracts

### Build Contracts

```bash
npm run build:contracts
```

### Deploy to Testnet

```bash
cd contracts
npx hardhat run scripts/deploy.js --network arcTestnet
```

**Expected Output:**

```
Deploying Arc Agent contracts with account: 0x97d5...8205
Account balance: 1000000000000000000

Configuration:
  USDC Address: 0x...
  Fee Collector: 0x97d5...8205

1. Deploying ArcAgentIdentity...
   ArcAgentIdentity deployed to: 0x6028...2678

2. Deploying ArcAgentReputation...
   ArcAgentReputation deployed to: 0x106e...72a7

3. Deploying ArcProofAttestation...
   ArcProofAttestation deployed to: 0xBE9a...7952

4. Deploying ArcTreasury...
   ArcTreasury deployed to: 0x...

5. Deploying ArcComplianceOracle...
   ArcComplianceOracle deployed to: 0x...

6. Configuring contracts...
   Setting compliance oracle in Treasury...
   Setting compliance oracle in Identity...

7. Deploying ArcAgent facade...
   ArcAgent deployed to: 0x...
   Setting treasury in ArcAgent...

======================================================================
DEPLOYMENT COMPLETE
======================================================================

Contract Addresses:
-------------------
ArcAgentIdentity:     0x60287b849721EB7ed3C6BbdB34B46be02E0e2678
ArcAgentReputation:   0x106e73c96da621826d6923faA3361004e2db72a7
ArcProofAttestation:  0xBE9a5DF7C551324CB872584C6E5bF56799787952
ArcTreasury:          0x...
ArcComplianceOracle:  0x...
ArcAgent (facade):    0x...
```

### Save Contract Addresses

Add the deployed addresses to your `.env` file:

```env
ARC_IDENTITY_ADDRESS=0x60287b849721EB7ed3C6BbdB34B46be02E0e2678
ARC_REPUTATION_ADDRESS=0x106e73c96da621826d6923faA3361004e2db72a7
ARC_PROOF_ATTESTATION_ADDRESS=0xBE9a5DF7C551324CB872584C6E5bF56799787952
ARC_TREASURY_ADDRESS=0x...
ARC_COMPLIANCE_ORACLE_ADDRESS=0x...
ARC_AGENT_ADDRESS=0x...
```

### Partial Deployment (Resume)

If deployment fails midway (e.g., out of gas), use the resume script:

```bash
npx hardhat run scripts/deploy-remaining.js --network arcTestnet
```

---

## Step 4: Verify Contracts

Verification allows users to read contract source on the block explorer.

```bash
# Verify ArcAgentIdentity
npx hardhat verify --network arcTestnet 0x60287b849721EB7ed3C6BbdB34B46be02E0e2678

# Verify ArcAgentReputation (with constructor args)
npx hardhat verify --network arcTestnet 0x106e73c96da621826d6923faA3361004e2db72a7 \
  0x60287b849721EB7ed3C6BbdB34B46be02E0e2678

# Continue for other contracts...
```

---

## Step 5: Deploy UI

### Configure UI Environment

```bash
# Copy example environment
cp ui/.env.example ui/.env.local

# Edit with deployed addresses
nano ui/.env.local
```

**UI Environment Variables:**

```env
# WalletConnect Project ID (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract Addresses (from deployment)
NEXT_PUBLIC_ARC_AGENT_ADDRESS=0x...
NEXT_PUBLIC_ARC_PROOF_ATTESTATION_ADDRESS=0xBE9a5DF7C551324CB872584C6E5bF56799787952

# Circle API (for server-side calls)
CIRCLE_API_KEY=your_circle_api_key
```

### Build & Deploy UI

**Option A: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd ui
vercel --prod
```

**Option B: Self-hosted**

```bash
# Build
npm run build:ui

# Start production server
npm run start --workspace=ui
```

**Option C: Docker**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build:ui
CMD ["npm", "run", "start", "--workspace=ui"]
EXPOSE 3000
```

---

## Step 6: Deploy Oracle Service

The Compliance Oracle bridges Circle's Compliance Engine to on-chain.

### Configure Oracle

```bash
cp oracle/.env.example oracle/.env
nano oracle/.env
```

**Oracle Environment Variables:**

```env
# Arc Network
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002

# Oracle Wallet (must be authorized on contract)
ORACLE_PRIVATE_KEY=0x...

# Contract Address
ARC_COMPLIANCE_ORACLE_ADDRESS=0x...

# Circle Compliance API
CIRCLE_API_KEY=your_circle_api_key
```

### Authorize Oracle Address

Before starting the oracle, authorize it on the contract:

```javascript
// Using Hardhat console
const oracle = await ethers.getContractAt("ArcComplianceOracle", "0x...");
await oracle.authorizeOracle("0xYourOracleAddress");
```

### Run Oracle

**Development:**
```bash
npm run dev:oracle
```

**Production (PM2):**
```bash
npm install -g pm2
pm2 start npm --name "arc-oracle" -- run run-oracle
pm2 save
```

**Production (Docker):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build:oracle
CMD ["npm", "run", "run-oracle"]
```

---

## Step 7: Deploy Runtime (Agent Scheduler)

The Runtime executes agents on a schedule.

### Configure with Render.com

The `render.yaml` file is pre-configured:

```yaml
services:
  - type: web
    name: arc-agent-ui
    env: node
    buildCommand: npm install && npm run build:ui
    startCommand: npm run start --workspace=ui

  - type: cron
    name: arc-agent-runtime
    env: node
    schedule: "*/15 * * * *"  # Every 15 minutes
    buildCommand: npm install && npm run build:runtime
    startCommand: npm run run-agents
```

Deploy to Render:

1. Connect your GitHub repo to Render
2. Create new "Blueprint" from `render.yaml`
3. Configure environment variables
4. Deploy

### Self-hosted Cron

```bash
# Add to crontab
crontab -e

# Run every 15 minutes
*/15 * * * * cd /path/to/arcagent && npm run run-agents >> /var/log/arc-agent.log 2>&1
```

---

## Step 8: Post-Deployment Checklist

### Verify Deployment

- [ ] All 6 contracts deployed and verified
- [ ] UI accessible and connected to correct network
- [ ] Oracle service running and authorized
- [ ] Runtime cron job scheduled

### Test End-to-End

```bash
# 1. Create an agent via CLI
arc-agent create agent --name test-agent --deposit 1

# 2. List agents
arc-agent list agents

# 3. Check balance
arc-agent fund balance 1

# 4. Make a test request (if x402 services available)
arc-agent call request 1 https://test.x402.org/ping
```

### Security Checklist

- [ ] Deployer private key secured (not in source control)
- [ ] Oracle private key secured
- [ ] Circle API keys rotated from test keys
- [ ] Fee collector address is multisig (for mainnet)
- [ ] Contract ownership transferred (if applicable)

---

## Mainnet Deployment

### Pre-Mainnet Checklist

1. **Audit**: Smart contracts audited by reputable firm
2. **Testing**: Extensive testnet testing completed
3. **Monitoring**: Set up contract monitoring (Tenderly, etc.)
4. **Multisig**: Use multisig for owner operations
5. **Gradual Rollout**: Consider phased deployment

### Deploy to Mainnet

```bash
# Ensure mainnet RPC and sufficient funds
npx hardhat run scripts/deploy.js --network arcMainnet
```

### Post-Mainnet

1. Verify all contracts on explorer
2. Update documentation with mainnet addresses
3. Configure monitoring and alerts
4. Set up incident response procedures

---

## Troubleshooting

### "Insufficient funds for gas"

- Check deployer balance: `npx hardhat balance --network arcTestnet`
- Get more testnet tokens from faucet

### "Contract deployment failed"

- Check gas estimation in hardhat.config.js
- Try increasing gas limit
- Use `deploy-remaining.js` for partial deployments

### "Oracle not authorized"

- Verify oracle address is authorized on contract
- Check oracle wallet has sufficient gas

### "UI shows 'Contracts Not Deployed'"

- Verify environment variables are set correctly
- Rebuild UI after changing environment variables
- Check browser console for errors

---

## Support

- **GitHub Issues**: [github.com/your-org/arcagent/issues](https://github.com/your-org/arcagent/issues)
- **Discord**: [discord.gg/arcnetwork](https://discord.gg/arcnetwork)
- **Documentation**: [docs.arc.network](https://docs.arc.network)
