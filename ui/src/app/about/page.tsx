'use client';

import Link from 'next/link';
import {
  Bot,
  Zap,
  Shield,
  Globe,
  DollarSign,
  Code,
  ArrowRight,
  CheckCircle,
  Users,
  Lock,
  Cpu,
  GitBranch,
  ExternalLink,
} from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Built on Arc L1',
    description: 'Arc is Circle\'s blockchain where USDC is the native gas token. Agents transact in the most trusted stablecoin.',
    highlight: 'Circle\'s Blockchain',
  },
  {
    icon: Zap,
    title: 'x402 Protocol',
    description: 'HTTP 402 "Payment Required" enables machine-to-machine payments. Agents can inspect services before paying.',
    highlight: 'Coinbase Standard',
  },
  {
    icon: Shield,
    title: 'zkML Spending Proofs',
    description: 'Every agent generates a zkML proof for spending decisions. Cryptographic guardrails ensure your agents prove correct computation before any payment.',
    highlight: 'JOLT-Atlas zkML',
  },
  {
    icon: Lock,
    title: 'Shared Treasury Model',
    description: 'Fund one wallet, all agents draw from it. Simplified management with enterprise-grade security.',
    highlight: 'Simple & Secure',
  },
  {
    icon: Users,
    title: 'Dual-Sided Compliance',
    description: 'Circle Compliance Engine screens both agent creators and payment recipients. Full regulatory compliance on every transaction.',
    highlight: 'Regulatory Ready',
  },
  {
    icon: Cpu,
    title: 'Autonomous Execution',
    description: 'Agents run autonomously, making spending decisions and purchasing data from x402 services without manual intervention.',
    highlight: 'Flexible Design',
  },
];

const techStack = [
  { name: 'Arc L1', description: 'Circle\'s native USDC blockchain', url: 'https://www.circle.com/arc' },
  { name: 'x402', description: 'HTTP Payment Protocol by Coinbase', url: 'https://github.com/coinbase/x402' },
  { name: 'JOLT-Atlas', description: 'zkML Proof Generation', url: 'https://github.com/ICME-Lab/jolt-atlas' },
  { name: 'Circle Compliance', description: 'Address Screening Engine', url: 'https://developers.circle.com/w3s/compliance-engine-quickstart' },
  { name: 'ERC-8004', description: 'Agent Identity Standard', url: 'https://eips.ethereum.org/EIPS/eip-8004' },
  { name: 'Bazaar', description: 'Coinbase x402 Discovery', url: 'https://docs.cdp.coinbase.com/x402/docs/bazaar' },
];

const contracts = [
  { name: 'ArcAgentIdentity', description: 'ERC-8004 agent registry and global IDs', address: '0x60287b849721EB7ed3C6BbdB34B46be02E0e2678' },
  { name: 'ArcAgentReputation', description: 'On-chain reputation tracking', address: '0x106e73c96da621826d6923faA3361004e2db72a7' },
  { name: 'ArcProofAttestation', description: 'zkML proof submission and validation', address: '0xBE9a5DF7C551324CB872584C6E5bF56799787952' },
  { name: 'ArcTreasury', description: 'USDC treasury with spending limits', address: '0x75E016aC75678344275fd47d6524433B81e46d0B' },
  { name: 'ArcComplianceOracle', description: 'Circle Compliance Engine bridge', address: '0xdB4E18Cc9290a234eB128f1321643B6c1B5936d1' },
  { name: 'ArcAgent', description: 'Main facade contract for agent operations', address: '0x982Cd9663EBce3eB8Ab7eF511a6249621C79E384' },
];

const ARC_EXPLORER = 'https://explorer.testnet.arc.network/address';

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Powered By Banner */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-6 py-4">
        <span className="text-sm text-slate-500 dark:text-slate-400">Powered by</span>
        <a
          href="https://www.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
        >
          <span className="font-semibold">Circle</span>
        </a>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <a
          href="https://arc.network"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
        >
          <span className="font-semibold">Arc L1</span>
        </a>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
        >
          <span className="font-semibold">x402</span>
        </a>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <a
          href="https://github.com/ICME-Lab/jolt-atlas"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
        >
          <span className="font-semibold">JOLT-Atlas</span>
        </a>
      </div>

      {/* Hero - Reframed */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 rounded-full text-sm font-medium mb-6">
          <Bot className="w-4 h-4" />
          The First AI Agent Framework Native to Arc
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
          Autonomous AI Agents on{' '}
          <span className="bg-gradient-to-r from-arc-500 to-arc-600 bg-clip-text text-transparent">Circle's Blockchain</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8">
          Arc Agents is the reference implementation for AI agent commerce on Arc L1.
          Deploy agents that consume paid APIs, make USDC payments, and prove their decisions with zero-knowledge ML.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Launch an Agent
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/how-to-use"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            How It Works
          </Link>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 md:p-12 mb-16 text-white">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Why Arc Agents?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">On-Chain Agent Identity</h3>
              <p className="text-slate-300 text-sm">
                Each agent gets an ERC-8004 identity on Arc L1. Global IDs, on-chain reputation, and verifiable history - not just a wallet, but a first-class blockchain citizen.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Permanent Proof Attestation</h3>
              <p className="text-slate-300 text-sm">
                Every zkML proof is submitted to ArcProofAttestation contract. Immutable on-chain record that your agent computed its decision correctly - fully auditable forever.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">No API Keys to Manage</h3>
              <p className="text-slate-300 text-sm">
                x402 enables pay-per-request. Agents can inspect service metadata before paying - no subscriptions needed.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">zkML Spending Accountability</h3>
              <p className="text-slate-300 text-sm">
                Every agent generates a zkML proof for spending decisions BEFORE payment. Cryptographic proof your agent computed correctly via JOLT-Atlas.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Shared Treasury</h3>
              <p className="text-slate-300 text-sm">
                Fund one wallet, all agents draw from it. No per-agent setup - just fund your treasury and launch agents.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Native USDC Payments</h3>
              <p className="text-slate-300 text-sm">
                Arc L1 uses USDC as gas. Your agent transacts in dollars, avoiding volatile crypto for payments.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg hover:border-arc-300 dark:hover:border-arc-700 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <div className="inline-block px-2 py-1 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs font-medium rounded mb-2">
                {feature.highlight}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Technical Architecture
        </h2>

        {/* Tech Stack */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-arc-500" />
            Technology Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {techStack.map((tech) => (
              <a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1">
                    {tech.name}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {tech.description}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Contracts with enhanced Arc Explorer integration */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-arc-500" />
              Smart Contracts on Arc Testnet
            </h3>
            <a
              href="https://explorer.testnet.arc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-arc-600 dark:text-arc-400 hover:text-arc-700 dark:hover:text-arc-300 flex items-center gap-1"
            >
              Open Arc Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-3">
            {contracts.map((contract) => (
              <a
                key={contract.name}
                href={`${ARC_EXPLORER}/${contract.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
              >
                <div>
                  <div className="font-mono text-sm text-slate-900 dark:text-white flex items-center gap-1">
                    {contract.name}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-arc-500" />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {contract.description}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:block">
                    {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                  </code>
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    Live
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Diagram */}
      <div className="bg-gradient-to-br from-arc-50 to-blue-50 dark:from-arc-900/20 dark:to-blue-900/20 rounded-2xl p-8 mb-16 border border-arc-200 dark:border-arc-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          Agent Lifecycle: zkML Spending Proofs
        </h2>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 text-center">
            Every Agent: Spending Decision + zkML Proof → Pay → Get Data
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {[
              { label: 'Probe', icon: Globe, desc: 'Get price & metadata' },
              { label: 'Spending Model', icon: DollarSign, desc: 'Evaluate budget, reputation' },
              { label: 'zkML Proof', icon: Shield, desc: 'Prove spending decision' },
              { label: 'Pay', icon: DollarSign, desc: 'x402 USDC payment' },
              { label: 'Get Data', icon: Globe, desc: 'Service responds' },
            ].map((step, index, arr) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full bg-white dark:bg-slate-800 border-2 ${step.label === 'zkML Proof' ? 'border-arc-500' : 'border-green-500'} flex items-center justify-center mb-2`}>
                    <step.icon className={`w-5 h-5 ${step.label === 'zkML Proof' ? 'text-arc-600' : 'text-green-600'}`} />
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">{step.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-20">{step.desc}</div>
                </div>
                {index < arr.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-green-400 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Cryptographic proof of spending decision generated BEFORE every x402 payment
        </p>
      </div>

      {/* Circle Developer Callout */}
      <div className="mb-16 p-6 bg-gradient-to-r from-blue-50 to-arc-50 dark:from-blue-900/20 dark:to-arc-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Build with Circle
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Arc Agents leverages Circle's developer platform for USDC payments, compliance screening, and programmable wallets.
              Explore the full suite of Circle APIs to extend your agent capabilities.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://developers.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-arc-600 dark:text-arc-400 hover:text-arc-700 dark:hover:text-arc-300"
              >
                Circle Developer Portal
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://developers.circle.com/w3s/compliance-engine-quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-arc-600 dark:text-arc-400 hover:text-arc-700 dark:hover:text-arc-300"
              >
                Compliance Engine Docs
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://developers.circle.com/w3s/programmable-wallets-quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-arc-600 dark:text-arc-400 hover:text-arc-700 dark:hover:text-arc-300"
              >
                Programmable Wallets
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Ready to Deploy Your First Agent?
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
          Browse x402 services, configure your agent, fund it with USDC, and let it run autonomously.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Browse Services
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/how-to-use"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            Read the Guide
          </Link>
        </div>
      </div>
    </div>
  );
}
