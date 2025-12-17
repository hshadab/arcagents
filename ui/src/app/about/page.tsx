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
    title: 'Prove Before You Pay',
    description: 'ML agents run ONNX models and generate JOLT-Atlas zkML proofs BEFORE payment. Verifiable computation.',
    highlight: 'JOLT-Atlas zkML',
  },
  {
    icon: Lock,
    title: 'Circle Programmable Wallets',
    description: 'Each agent has its own custody wallet with enterprise-grade security and compliance built-in.',
    highlight: 'Enterprise Security',
  },
  {
    icon: Users,
    title: 'Dual-Sided Compliance',
    description: 'Circle Compliance Engine screens both agent creators and payment recipients. Full regulatory compliance on every transaction.',
    highlight: 'Regulatory Ready',
  },
  {
    icon: Cpu,
    title: 'Simple or ML-Powered',
    description: 'Simple agents pay directly. ML agents run ONNX models, prove correct execution, then pay.',
    highlight: 'Flexible Design',
  },
];

const techStack = [
  { name: 'Arc L1', description: 'Circle\'s native USDC blockchain', url: 'https://www.circle.com/arc' },
  { name: 'x402', description: 'HTTP Payment Protocol by Coinbase', url: 'https://github.com/coinbase/x402' },
  { name: 'JOLT-Atlas', description: 'zkML Proof Generation', url: 'https://github.com/ICME-Lab/jolt-atlas' },
  { name: 'Circle Wallets', description: 'Programmable Wallets', url: 'https://www.circle.com/programmable-wallets' },
  { name: 'ERC-8004', description: 'Agent Identity Standard', url: 'https://eips.ethereum.org/EIPS/eip-8004' },
  { name: 'Bazaar', description: 'Coinbase x402 Discovery', url: 'https://docs.cdp.coinbase.com/x402/docs/bazaar' },
];

const contracts = [
  { name: 'ArcAgentIdentity', description: 'ERC-8004 agent registry and global IDs', address: '0x6028...2678' },
  { name: 'ArcAgentReputation', description: 'On-chain reputation tracking', address: '0x106e...72a7' },
  { name: 'ArcProofAttestation', description: 'zkML proof submission and validation', address: '0xBE9a...7952' },
  { name: 'ArcTreasury', description: 'USDC treasury with spending limits', address: '0x75E0...6d0B' },
  { name: 'ArcComplianceOracle', description: 'Circle Compliance Engine bridge', address: '0xdB4E...36d1' },
  { name: 'ArcAgent', description: 'Main facade contract for agent operations', address: '0x982C...E384' },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 rounded-full text-sm font-medium mb-6">
          <Bot className="w-4 h-4" />
          Built for Circle Developer Community
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
          Autonomous AI Agents on{' '}
          <span className="bg-gradient-to-r from-arc-500 to-arc-600 bg-clip-text text-transparent">Arc</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8">
          Arc Agents is a framework for deploying AI agents that can autonomously consume paid APIs,
          make USDC payments, and prove their decisions using zero-knowledge machine learning.
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
              <h3 className="font-semibold mb-1">No API Keys to Manage</h3>
              <p className="text-slate-300 text-sm">
                x402 enables pay-per-request. Agents can inspect service metadata before paying - no subscriptions needed.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Prove Before You Pay</h3>
              <p className="text-slate-300 text-sm">
                ML agents run ONNX models and generate JOLT-Atlas zkML proofs BEFORE payment. Verifiable ML computation.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Enterprise-Grade Security</h3>
              <p className="text-slate-300 text-sm">
                Circle Programmable Wallets provide institutional custody, compliance, and audit trails for every agent.
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

        {/* Contracts */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Code className="w-5 h-5 text-arc-500" />
            Smart Contracts (Arc Testnet)
          </h3>
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div
                key={contract.name}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div>
                  <div className="font-mono text-sm text-slate-900 dark:text-white">
                    {contract.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {contract.description}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {contract.address}
                  </code>
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    Live
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Diagram */}
      <div className="bg-gradient-to-br from-arc-50 to-blue-50 dark:from-arc-900/20 dark:to-blue-900/20 rounded-2xl p-8 mb-16 border border-arc-200 dark:border-arc-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          ML Agent Lifecycle: Prove Before You Pay
        </h2>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {[
            { label: 'Probe', icon: Globe, desc: 'Inspect Service (free)' },
            { label: 'Model', icon: Cpu, desc: 'Run ONNX Locally' },
            { label: 'Prove', icon: Shield, desc: 'JOLT-Atlas zkML' },
            { label: 'Pay', icon: DollarSign, desc: 'x402 Payment' },
            { label: 'Attest', icon: CheckCircle, desc: 'On-Chain Record' },
          ].map((step, index, arr) => (
            <div key={step.label} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-2 border-arc-500 flex items-center justify-center mb-2">
                  <step.icon className="w-6 h-6 text-arc-600" />
                </div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">{step.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{step.desc}</div>
              </div>
              {index < arr.length - 1 && (
                <ArrowRight className="w-6 h-6 text-arc-400 hidden md:block" />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
          Simple agents skip the Model and Prove steps - they just Probe → Pay → Execute
        </p>
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
