'use client';

import Link from 'next/link';
import {
  Wallet,
  Search,
  Bot,
  Play,
  CheckCircle,
  ArrowRight,
  Clock,
  Shield,
  DollarSign,
  Zap,
  Terminal,
  FileCode,
  Server,
  Users,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Newspaper,
} from 'lucide-react';

const steps = [
  {
    icon: Wallet,
    title: '1. Enter Your Wallet Address',
    description: 'Any EVM-compatible wallet address works. No wallet connection needed - just paste your address.',
    details: [
      'Click "Enter Wallet" in the top right header',
      'Paste any Ethereum address (MetaMask, Coinbase Wallet, Rainbow, etc.)',
      'Your address is saved locally for convenience',
      'Use Circle Faucet for testnet USDC (Arc Testnet + Base Sepolia)',
    ],
    color: 'from-blue-400 to-blue-600',
  },
  {
    icon: Search,
    title: '2. Browse x402 Services',
    description: 'Explore machine-payable APIs from the x402 Bazaar. You can inspect services before paying.',
    details: [
      'x402 returns service metadata (price, schema) before payment',
      'Services include data feeds, analytics, research APIs, and more',
      'All services work with zkML spending proofs for accountability',
    ],
    color: 'from-purple-400 to-purple-600',
  },
  {
    icon: Bot,
    title: '3. Configure Your Agent',
    description: 'Agents use a spending model to decide purchases with cryptographic accountability.',
    details: [
      'All agents generate zkML spending proofs before every payment',
      'Spending policy: daily limits, max purchase size, minimum budget buffer',
      'Dual-sided compliance screening on every agent',
      'Cryptographic proof ensures spending decisions are verified',
    ],
    color: 'from-arc-400 to-arc-600',
  },
  {
    icon: DollarSign,
    title: '4. Fund Your Treasury',
    description: 'All agents share a single treasury wallet. Fund it once on two networks.',
    details: [
      'Click "Treasury" button in the header to set up your shared wallet',
      'Arc Testnet: faucet.circle.com → "Arc Testnet" (for proofs & contracts)',
      'Base: Send USDC on Base, or faucet → "Base Sepolia" (for x402 payments)',
      'Same address works on both networks - all your agents draw from this balance',
    ],
    color: 'from-green-400 to-green-600',
  },
  {
    icon: Play,
    title: '5. zkML Spending Proofs',
    description: 'Every agent generates a zkML proof for spending decisions before any payment.',
    details: [
      'Probe x402 service to get price (free, no payment)',
      'Spending model evaluates: price, budget, daily limit, service reputation',
      'zkML proof generated for spending decision',
      'If APPROVED: compliance check → pay → get data from service',
      'Full cryptographic accountability for every transaction',
    ],
    color: 'from-amber-400 to-amber-600',
  },
  {
    icon: CheckCircle,
    title: '6. On-Chain Attestation',
    description: 'Every x402 payment has cryptographic proof. Full accountability for all agents.',
    details: [
      'Spending proof submitted for every transaction',
      'Cryptographic guarantee agent computed decision correctly',
      'Anyone can verify on-chain - fully auditable',
      'Complete audit trail of all agent spending',
    ],
    color: 'from-teal-400 to-teal-600',
  },
];

const useCases = [
  {
    icon: Zap,
    title: 'DeFi Monitoring',
    description: 'Agent monitors TVL, yields, and pool data, makes decisions based on thresholds.',
    example: 'Auto-rebalance portfolio when yield drops below 5%',
  },
  {
    icon: Shield,
    title: 'Token Security Analysis',
    description: 'Agent fetches security scores and scam indicators before trading.',
    example: 'Only allow trades for tokens with security score > 80',
  },
  {
    icon: FileCode,
    title: 'Market Research',
    description: 'Agent aggregates news, sentiment, and research from multiple sources.',
    example: 'Daily digest of crypto news with AI summary',
  },
  {
    icon: Terminal,
    title: 'Custom Automation',
    description: 'Build your own workflows using any x402-compatible API.',
    example: 'Trigger on-chain actions based on off-chain data',
  },
];

export default function HowToUsePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          How to Use Arc Agents
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Launch autonomous agents that pay for APIs and data using USDC in 6 simple steps.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-8 mb-16">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {step.description}
                </p>
                <ul className="space-y-2">
                  {step.details.map((detail, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <ArrowRight className="w-4 h-4 text-arc-500 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Use Cases */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          Example Use Cases
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <useCase.icon className="w-5 h-5 text-arc-500" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {useCase.title}
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {useCase.description}
              </p>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
                {useCase.example}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Architecture Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          zkML Agent Architecture
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          <strong>Every Arc Agent generates a zkML spending proof</strong> before making any x402 payment, providing cryptographic accountability for all transactions.
        </p>
        <div className="p-4 bg-arc-50 dark:bg-arc-900/20 rounded-lg border border-arc-200 dark:border-arc-800">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-arc-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Universal Spending Proofs</h3>
            <span className="text-xs px-2 py-0.5 bg-arc-100 dark:bg-arc-900 text-arc-700 dark:text-arc-300 rounded">All Agents</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Every agent uses the same spending model to evaluate purchases. The model runs locally, and a zkML proof is generated to verify the computation.
          </p>
          <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
            <li>• <strong>Inputs:</strong> price, budget, daily limit, service reputation</li>
            <li>• <strong>Flow:</strong> Probe → Spending Model → zkML Proof → Compliance → Pay → Get data</li>
            <li>• <strong>Output:</strong> Cryptographic proof the agent computed the spending decision correctly</li>
          </ul>
        </div>
      </div>

      {/* zkML Section */}
      <div className="bg-gradient-to-br from-arc-50 to-blue-50 dark:from-arc-900/20 dark:to-blue-900/20 rounded-2xl p-8 mb-8 border border-arc-200 dark:border-arc-800">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              zkML Spending Proofs
              <span className="inline-flex items-center px-2 py-0.5 bg-arc-100 dark:bg-arc-800 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                JOLT-Atlas
              </span>
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>Every agent generates a zkML proof</strong> for their spending decision before any payment.
              This provides cryptographic accountability for every x402 transaction.
            </p>
          </div>
        </div>

        {/* Workflow diagram */}
        <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-slate-900 dark:text-white mb-4 text-center">Agent Execution Flow</h4>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm">
            <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <div className="font-semibold text-blue-700 dark:text-blue-300">1. Probe</div>
              <div className="text-xs text-slate-500">Get price (free)</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <div className="font-semibold text-green-700 dark:text-green-300">2. Spending Model</div>
              <div className="text-xs text-slate-500">Evaluate decision</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-arc-100 dark:bg-arc-900/30 rounded-lg border-2 border-arc-400">
              <div className="font-semibold text-arc-700 dark:text-arc-300">3. zkML Proof</div>
              <div className="text-xs text-slate-500">JOLT-Atlas</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <div className="font-semibold text-purple-700 dark:text-purple-300">4. Compliance</div>
              <div className="text-xs text-slate-500">Dual-sided check</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <div className="font-semibold text-amber-700 dark:text-amber-300">5. Pay & Get Data</div>
              <div className="text-xs text-slate-500">x402 payment</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Spending Model</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• ONNX model: spending-model.onnx</li>
              <li>• Inputs: price, budget, reputation</li>
              <li>• Output: shouldBuy, confidence, risk</li>
              <li>• Runs locally before payment</li>
            </ul>
          </div>
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">zkML Proof Generation</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• JOLT-Atlas proving system</li>
              <li>• Cryptographic proof of computation</li>
              <li>• Verifiable on-chain</li>
              <li>• Generated before every payment</li>
            </ul>
          </div>
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Why Spending Proofs?</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Every payment is accountable</li>
              <li>• Uses real financial data</li>
              <li>• On-chain attestation</li>
              <li>• Full audit trail</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Compliance Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 mb-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              Dual-Sided Compliance
              <span className="inline-flex items-center px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                Built-in
              </span>
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              All Arc Agents have <strong>dual-sided compliance</strong> built-in via Circle Compliance Engine. Both agent creators and payment recipients are screened automatically to ensure full regulatory compliance on every transaction.
            </p>
          </div>
        </div>

        {/* Compliance Flow */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6 border border-green-200 dark:border-green-800">
          <h4 className="font-medium text-slate-900 dark:text-white mb-3">What Gets Screened</h4>
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm">
            <div className="text-center p-3 bg-green-100 dark:bg-green-900/40 rounded-lg flex-1 border-2 border-green-400">
              <div className="font-semibold text-green-700 dark:text-green-300">Agent Creator</div>
              <div className="text-xs text-green-600 dark:text-green-400">Screened at registration</div>
            </div>
            <ArrowRight className="w-5 h-5 text-green-500 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg flex-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300">Arc Agent</div>
              <div className="text-xs text-slate-500">Makes payments</div>
            </div>
            <ArrowRight className="w-5 h-5 text-green-500 rotate-90 md:rotate-0" />
            <div className="text-center p-3 bg-green-100 dark:bg-green-900/40 rounded-lg flex-1 border-2 border-green-400">
              <div className="font-semibold text-green-700 dark:text-green-300">x402 Provider</div>
              <div className="text-xs text-green-600 dark:text-green-400">Screened before payment</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Registration Screening</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Your wallet is screened before creating an agent</li>
              <li>• Prevents sanctioned entities from using platform</li>
              <li>• One-time check, cached for future use</li>
            </ul>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Payment Screening</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Service provider&apos;s wallet screened per payment</li>
              <li>• Blocks payments to sanctioned recipients</li>
              <li>• Results cached for 7 days</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Blocked categories:</strong> OFAC sanctions, terrorist financing, known hacker wallets, illicit activity associations, and other high-risk signals detected by Circle Compliance Engine.
          </p>
        </div>
      </div>

      {/* Execution Modes Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 mb-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Execution Modes
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Different agents need different execution patterns. Choose the mode that fits your use case.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Scheduled */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-slate-900 dark:text-white">Scheduled</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Runs on a cron schedule (hourly, daily, etc.)
            </p>
            <div className="text-xs text-blue-700 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
              Best for: Data aggregation, reports
            </div>
          </div>

          {/* Event-Driven */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <h4 className="font-medium text-slate-900 dark:text-white">Event-Driven</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Triggered by webhooks, on-chain events, or price alerts
            </p>
            <div className="text-xs text-purple-700 dark:text-purple-300 font-mono bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded">
              Best for: Trading, alerts
            </div>
          </div>

          {/* Reactive */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <h4 className="font-medium text-slate-900 dark:text-white">Reactive</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Polls conditions, only acts when thresholds met
            </p>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">
              Best for: Conditional automation
            </div>
          </div>

          {/* Continuous */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-slate-900 dark:text-white">Continuous</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Long-running process streaming real-time data
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 font-mono bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded">
              Best for: Monitoring, analysis
            </div>
          </div>

          {/* On-Demand */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-4 h-4 text-slate-600" />
              <h4 className="font-medium text-slate-900 dark:text-white">On-Demand</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Triggered by API call or user action
            </p>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
              Best for: User-initiated tasks
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium text-slate-900 dark:text-white mb-3">Example Configurations</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 mb-1"><strong>Data Aggregator</strong></p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled mode, runs hourly to fetch market data</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 mb-1"><strong>Price Alert Bot</strong></p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Event mode, triggers when ETH crosses $2000</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 mb-1"><strong>Yield Optimizer</strong></p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reactive mode, rebalances when yield drops below 5%</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Newspaper className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 mb-1"><strong>Sentiment Monitor</strong></p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Continuous mode, streams social data in real-time</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 mb-16">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Monitoring Your Agents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Activity Dashboard</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• View execution logs and history</li>
              <li>• Verify zkML spending proofs on-chain</li>
              <li>• Track USDC spending per agent</li>
              <li>• Monitor success/failure rates</li>
            </ul>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Alerts & Safety</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Agent pauses if balance drops below threshold</li>
              <li>• Daily spending limits prevent runaway costs</li>
              <li>• Webhook notifications for errors</li>
              <li>• Manual pause/resume controls</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Browse x402 Services
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Ready to launch your first agent? Start by exploring available services.
        </p>
      </div>
    </div>
  );
}
