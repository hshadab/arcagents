# Arc Agent CLI Reference

Complete API documentation for the `arc-agent` command-line interface.

## Installation

```bash
# Global installation
npm install -g arc-agent

# Or run via npx
npx arc-agent <command>
```

## Configuration

Before using the CLI, initialize your configuration:

```bash
arc-agent config init
```

This creates a configuration file at `~/.arc-agent/config.json`.

### Configuration Commands

| Command | Description |
|---------|-------------|
| `arc-agent config init` | Initialize configuration interactively |
| `arc-agent config show` | Display current configuration |
| `arc-agent config set-network <network>` | Set network (testnet/mainnet) |
| `arc-agent config set-key` | Set private key (prompted securely) |
| `arc-agent config set <key> <value>` | Set arbitrary config value |

### Configuration File Structure

```json
{
  "network": "testnet",
  "rpcUrl": "https://rpc.testnet.arc.network",
  "privateKey": "0x...",
  "defaultAgent": "1",
  "circleApiKey": "optional-for-compliance"
}
```

---

## Service Discovery

Browse and search x402-enabled services from the Bazaar.

### `arc-agent services list`

List all available x402 services.

```bash
arc-agent services list [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--category <cat>` | string | Filter by category (data, ai, compute, storage, oracle, api) |
| `--max-price <price>` | string | Maximum price in USDC per request |
| `--network <network>` | string | Filter by payment network |
| `--limit <n>` | number | Maximum results to return |
| `--json` | flag | Output as JSON |

**Example:**
```bash
# List AI services under $0.05/request
arc-agent services list --category ai --max-price 0.05

# Output as JSON for scripting
arc-agent services list --json | jq '.[] | .name'
```

### `arc-agent services search <query>`

Search services by keyword.

```bash
arc-agent services search "weather" --max-price 0.02
```

### `arc-agent services info <url>`

Get detailed information about a service.

```bash
arc-agent services info https://weather.x402.org
```

**Output:**
```
Service: Weather Oracle
URL: https://weather.x402.org
Price: $0.01 USDC/request
Network: base
Pay To: 0x1234...5678
Category: data
Description: Real-time weather data for any location
```

### `arc-agent services probe <url>`

Check if an endpoint supports x402 payments.

```bash
arc-agent services probe https://api.example.com/data
```

**Output:**
```
✓ Endpoint supports x402 payments
  Price: $0.025 USDC
  Asset: USDC
  Network: base
  Pay To: 0xabcd...efgh
```

---

## Agent Management

### `arc-agent create agent`

Create a new Arc Agent with on-chain identity.

```bash
arc-agent create agent [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--name <name>` | string | Agent name (required) |
| `--deposit <amount>` | string | Initial USDC deposit |
| `--model-hash <hash>` | string | zkML model hash (bytes32) |
| `--prover-version <ver>` | string | JOLT-Atlas prover version |

**Example:**
```bash
arc-agent create agent --name my-weather-bot --deposit 5
```

**Output:**
```
Creating agent "my-weather-bot"...
✓ Agent created successfully!
  Agent ID: 42
  Global ID: eip155:5042002:0x1234...5678:42
  Transaction: 0xabcd...efgh
```

### `arc-agent create for-service <url>`

Create an agent pre-configured for a specific service.

```bash
arc-agent create for-service https://weather.x402.org --deposit 10
```

### `arc-agent list agents`

List all agents owned by your wallet.

```bash
arc-agent list agents [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--owner <address>` | string | List agents for a specific owner |
| `--json` | flag | Output as JSON |

**Example:**
```bash
arc-agent list agents

# Output:
ID  Name            Balance   KYC Status  Created
──  ──────────────  ────────  ──────────  ────────────
1   weather-bot     $4.50     Approved    2024-01-15
2   llm-agent       $12.75    Approved    2024-01-20
3   data-oracle     $0.25     Pending     2024-01-25
```

### `arc-agent status agent <agent-id>`

Check detailed status of an agent.

```bash
arc-agent status agent 1
```

**Output:**
```
Agent #1: weather-bot
──────────────────────────
Global ID:     eip155:5042002:0x1234...5678:1
Owner:         0xf39F...2266
Wallet:        0x8a3F...7b2E
KYC Status:    Approved
Created:       2024-01-15 10:30:00 UTC

Treasury:
  Available:   $4.50 USDC
  Pending:     $0.00 USDC
  Locked:      $0.00 USDC

Eligibility:   ✓ Eligible for transfers
```

---

## Treasury Operations

### `arc-agent fund deposit <agent-id> <amount>`

Deposit USDC into an agent's treasury.

```bash
arc-agent fund deposit 1 10
```

**Output:**
```
Depositing $10.00 USDC to Agent #1...
✓ Deposit successful!
  Transaction: 0xabcd...efgh
  New Balance: $14.50 USDC
```

### `arc-agent fund balance <agent-id>`

Check agent treasury balance.

```bash
arc-agent fund balance 1
```

### `arc-agent fund withdraw <agent-id> <amount>`

Withdraw USDC from agent treasury (owner only).

```bash
arc-agent fund withdraw 1 5
```

---

## Making Requests

### `arc-agent call request <agent-id> <url>`

Make a paid request to an x402 service.

```bash
arc-agent call request <agent-id> <url> [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--method <method>` | string | HTTP method (GET, POST, etc.) |
| `--data <json>` | string | Request body (JSON) |
| `--path <path>` | string | Additional URL path |
| `--headers <json>` | string | Additional headers (JSON) |
| `--output <file>` | string | Save response to file |

**Example:**
```bash
# Simple GET request
arc-agent call request 1 https://weather.x402.org/forecast?city=NYC

# POST request with data
arc-agent call request 1 https://inference.x402.org \
  --method POST \
  --data '{"prompt": "Hello world", "max_tokens": 100}'
```

**Output:**
```
Making request to https://weather.x402.org/forecast?city=NYC...
Payment: $0.01 USDC
Transaction: 0xabcd...efgh

Response:
{
  "city": "NYC",
  "temperature": 72,
  "conditions": "sunny"
}
```

### `arc-agent call browse <agent-id>`

Interactive service browser and request maker.

```bash
arc-agent call browse 1
```

Launches an interactive TUI to:
1. Browse available services
2. Select a service
3. Configure request parameters
4. Execute and view response

---

## Proof Commands

### `arc-agent proof submit <agent-id>`

Submit a zkML proof for attestation.

```bash
arc-agent proof submit <agent-id> [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--proof-uri <uri>` | string | IPFS/Arweave URI to proof data |
| `--proof-hash <hash>` | string | Hash of proof for integrity |
| `--tag <tag>` | string | Proof type (authorization, compliance) |
| `--model-hash <hash>` | string | ONNX model hash |

### `arc-agent proof status <request-hash>`

Check proof attestation status.

```bash
arc-agent proof status 0x1234...5678
```

### `arc-agent proof list <agent-id>`

List all proofs for an agent.

```bash
arc-agent proof list 1 --status valid
```

---

## Environment Variables

The CLI respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `ARC_PRIVATE_KEY` | Wallet private key |
| `ARC_RPC_URL` | Custom RPC URL |
| `ARC_NETWORK` | Network (testnet/mainnet) |
| `CIRCLE_API_KEY` | Circle API key for compliance |

**Example:**
```bash
export ARC_PRIVATE_KEY=0x...
export ARC_NETWORK=testnet
arc-agent list agents
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Network/RPC error |
| 4 | Contract error |
| 5 | Insufficient funds |

---

## Scripting Examples

### Batch Service Discovery

```bash
#!/bin/bash
# Find all AI services under $0.10 and save URLs

arc-agent services list --category ai --max-price 0.10 --json | \
  jq -r '.[].url' > ai-services.txt
```

### Automated Agent Funding

```bash
#!/bin/bash
# Top up agent balance if below threshold

AGENT_ID=1
MIN_BALANCE=5
TOP_UP_AMOUNT=10

BALANCE=$(arc-agent fund balance $AGENT_ID --json | jq -r '.available')
if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
  echo "Balance low ($BALANCE), topping up..."
  arc-agent fund deposit $AGENT_ID $TOP_UP_AMOUNT
fi
```

### Scheduled Data Fetch

```bash
#!/bin/bash
# Fetch weather data every hour

AGENT_ID=1
SERVICE_URL="https://weather.x402.org/forecast?city=NYC"
OUTPUT_DIR="./weather-data"

mkdir -p $OUTPUT_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
arc-agent call request $AGENT_ID $SERVICE_URL \
  --output "$OUTPUT_DIR/weather_$TIMESTAMP.json"
```

---

## Troubleshooting

### Common Issues

**"Wallet has no account"**
- Ensure private key is configured: `arc-agent config set-key`

**"Insufficient funds"**
- Check agent balance: `arc-agent fund balance <agent-id>`
- Deposit more USDC: `arc-agent fund deposit <agent-id> <amount>`

**"Network error"**
- Verify RPC URL: `arc-agent config show`
- Check network connectivity

**"Contract not found"**
- Ensure you're on the correct network
- Verify contract addresses in config

### Debug Mode

Enable verbose logging:

```bash
DEBUG=arc-agent:* arc-agent services list
```

---

## See Also

- [SDK Documentation](./SDK.md)
- [Smart Contracts](./CONTRACTS.md)
- [Deployment Guide](./DEPLOYMENT.md)
