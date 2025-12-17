'use client';

import { useState, useEffect } from 'react';
import { Bot, Wallet, ArrowRight, Plus, Loader2, Shield, AlertCircle, ExternalLink, FileCheck, CheckCircle, Clock, Copy, Check, Trash2, Info } from 'lucide-react';
import Link from 'next/link';
import { ProofStatus, ValidationResponse, type ProofItem } from '@/components/ProofStatus';
import { useWalletAddress } from '@/components/Header';
import { getSavedAgents, removeAgent as removeAgentFromStorage, clearAllAgents, type SavedAgent } from '@/lib/agentStorage';
import { AgentExecutionPanel } from '@/components/AgentExecutionPanel';
import { ServiceOutputDisplay } from '@/components/ServiceOutputDisplay';

// Agent type for display
interface Agent {
  id: string;
  name: string;
  walletAddress?: string;
  balance: string;
  connectedService: string | null;
  connectedServiceUrl?: string;
  connectedServicePrice?: string;
  connectedServicePayTo?: string;
  features?: {
    zkmlEnabled: boolean;
    complianceEnabled: boolean;
  };
  modelName?: string;
  createdAt?: number;
  isExample?: boolean;
  lastExecutionOutput?: unknown;
  proofs: {
    valid: number;
    total: number;
    items: ProofItem[];
  };
}

// Single example agent to show what a working agent looks like
const exampleAgent: Agent = {
  id: 'example-weather-bot',
  name: 'weather-bot',
  walletAddress: '0x8a3F7b2E9c1D4f5A6B8C0E2D4F6A8B0C2E4D6F8A',
  balance: '4.50',
  connectedService: 'Weather Oracle',
  features: {
    zkmlEnabled: true,
    complianceEnabled: true,
  },
  modelName: 'BinaryClassifier',
  isExample: true,
  proofs: {
    valid: 12,
    total: 15,
    items: [
      {
        requestHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        tag: 'authorization' as const,
        response: ValidationResponse.Valid,
        isValidated: true,
        timestamp: Date.now() / 1000 - 3600,
        metadata: {
          modelHash: '0xabc123def456789abc123def456789abc123def456789abc123def456789abc1',
          inputHash: '0xdef456789abc123def456789abc123def456789abc123def456789abc123def4',
          outputHash: '0x789abc123def456789abc123def456789abc123def456789abc123def456789a',
          proofSize: 2048,
          generationTime: 5234,
          proverVersion: 'jolt-atlas-0.2.0',
        },
      },
    ],
  },
};

// Convert saved agent to display format
function savedAgentToDisplay(saved: SavedAgent): Agent {
  return {
    id: saved.id,
    name: saved.name,
    walletAddress: saved.walletAddress,
    balance: saved.fundedAmount,
    connectedService: saved.connectedService || null,
    connectedServiceUrl: saved.connectedServiceUrl,
    connectedServicePrice: saved.connectedServicePrice,
    connectedServicePayTo: saved.connectedServicePayTo,
    features: saved.features,
    modelName: saved.modelName,
    createdAt: saved.createdAt,
    isExample: false,
    lastExecutionOutput: saved.lastExecution?.outputPreview ?
      JSON.parse(saved.lastExecution.outputPreview) : undefined,
    proofs: {
      valid: saved.lastExecution?.proofHash ? 1 : 0,
      total: saved.lastExecution?.proofHash ? 1 : 0,
      items: saved.lastExecution?.proofHash ? [{
        requestHash: saved.lastExecution.proofHash,
        tag: 'authorization' as const,
        response: saved.lastExecution.success ? ValidationResponse.Valid : ValidationResponse.Invalid,
        isValidated: true,
        timestamp: Math.floor(saved.lastExecution.timestamp / 1000),
      }] : [],
    },
  };
}

export default function AgentsPage() {
  const { address: savedAddress } = useWalletAddress();
  const isConnected = !!savedAddress;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>([]);
  const [showExample, setShowExample] = useState(true);
  const [fundingAgent, setFundingAgent] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [executionOutputs, setExecutionOutputs] = useState<Record<string, unknown>>({});

  // Load saved agents from localStorage
  useEffect(() => {
    const saved = getSavedAgents();
    setSavedAgents(saved);
    const displayAgents = saved.map(savedAgentToDisplay);
    setAgents(displayAgents);
  }, []);

  // Handle execution completion
  const handleExecutionComplete = (agentId: string, result: { success: boolean; data?: unknown }) => {
    if (result.success && result.data) {
      setExecutionOutputs(prev => ({ ...prev, [agentId]: result.data }));
    }
    // Reload agents to get updated lastExecution
    const saved = getSavedAgents();
    setSavedAgents(saved);
    setAgents(saved.map(savedAgentToDisplay));
  };

  // Copy wallet address to clipboard
  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Remove an agent
  const handleRemoveAgent = (agentId: string) => {
    removeAgentFromStorage(agentId);
    setAgents(agents.filter(a => a.id !== agentId));
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Bot className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Enter Your Wallet Address
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Enter any EVM wallet address to get started with Arc Agents.
        </p>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Any Ethereum-compatible wallet works:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• MetaMask, Coinbase Wallet, Rainbow</li>
            <li>• Hardware wallets (Ledger, Trezor)</li>
            <li>• Any wallet with a 0x... address</li>
          </ul>
        </div>
        <p className="text-sm text-arc-600 dark:text-arc-400 font-medium">
          Click &quot;Enter Wallet&quot; in the top right to get started
        </p>
      </div>
    );
  }

  // Combine user agents with example agent if shown
  const displayAgents = showExample ? [...agents, exampleAgent] : agents;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            My Agents
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your Arc Agents and their treasuries
          </p>
        </div>

        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Delete all agents? This cannot be undone.')) {
                  clearAllAgents();
                  setAgents([]);
                  setSavedAgents([]);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            Launch Agent
          </Link>
        </div>
      </div>

      {/* How Agents Work - Explanatory Section */}
      <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Arc Agents Work</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li><strong>1. Create:</strong> Launch an agent with initial USDC funding from your wallet to the agent&apos;s dedicated wallet.</li>
              <li><strong>2. Configure:</strong> Agents auto-assign decision models for action services. Compliance is built-in.</li>
              <li><strong>3. Execute:</strong> Your agent calls x402 services, pays in USDC, and (for ML agents) generates zkML proofs.</li>
              <li><strong>4. Verify:</strong> All proofs are attested on-chain for full transparency and accountability.</li>
            </ul>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
              In production, agents run autonomously via the SDK/CLI. This UI shows agent status and proof history.
            </p>
          </div>
        </div>
      </div>

      {agents.length === 0 && !showExample ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Bot className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Agents Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Launch your first agent to start making x402 payments.
          </p>
          <Link
            href="/spawn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            Launch Agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Your Agents Section */}
          {agents.length > 0 && (
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Your Agents ({agents.length})</h2>
            </div>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {agent.name}
                      </h3>
                      {/* Feature badges */}
                      {agent.features?.zkmlEnabled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                          <Shield className="w-3 h-3" />
                          zkML
                        </span>
                      )}
                      {agent.features?.complianceEnabled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                          <FileCheck className="w-3 h-3" />
                          Compliant
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {agent.connectedService ? `Connected to ${agent.connectedService}` : 'No service connected'}
                    </p>
                    {agent.walletAddress && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 mt-1">
                        <Wallet className="w-3 h-3" />
                        {agent.walletAddress.slice(0, 10)}...{agent.walletAddress.slice(-8)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${agent.balance}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      USDC Balance
                    </p>
                  </div>
                  {/* Delete button for user agents */}
                  {!agent.isExample && (
                    <button
                      onClick={() => handleRemoveAgent(agent.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Model
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {agent.modelName || 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Created
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    zkML Proofs
                  </p>
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4 text-arc-500" />
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {agent.proofs.valid}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      /{agent.proofs.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Execution Panel */}
              {(() => {
                const savedAgent = savedAgents.find(s => s.id === agent.id);
                const agentForExecution: SavedAgent = savedAgent || {
                  id: agent.id,
                  name: agent.name,
                  walletAddress: agent.walletAddress || '',
                  ownerAddress: savedAddress || '',
                  fundedAmount: agent.balance,
                  createdAt: agent.createdAt || Date.now(),
                  connectedService: agent.connectedService || undefined,
                  connectedServiceUrl: agent.connectedServiceUrl,
                  connectedServicePrice: agent.connectedServicePrice,
                  connectedServicePayTo: agent.connectedServicePayTo,
                  features: agent.features || { zkmlEnabled: false, complianceEnabled: true },
                  modelName: agent.modelName,
                };
                return (
                  <div className="mt-6">
                    <AgentExecutionPanel
                      agent={agentForExecution}
                      onExecutionComplete={(result) => handleExecutionComplete(agent.id, result)}
                    />
                  </div>
                );
              })()}

              {/* Service Output Display */}
              {Boolean(executionOutputs[agent.id] || agent.lastExecutionOutput) && (
                <div className="mt-4">
                  <ServiceOutputDisplay
                    data={executionOutputs[agent.id] || agent.lastExecutionOutput}
                    serviceName={agent.connectedService || undefined}
                    serviceUrl={agent.connectedServiceUrl}
                  />
                </div>
              )}

              {/* zkML Proof Status */}
              <div className="mt-6">
                <ProofStatus
                  agentId={agent.id}
                  proofs={agent.proofs.items}
                  validProofCount={agent.proofs.valid}
                />
              </div>

              {/* Funding Modal - Use Circle Faucet */}
              {fundingAgent === agent.id && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-3">Fund Agent via Circle Faucet</h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Copy the agent wallet address below and send USDC from the Circle faucet:
                  </p>
                  {agent.walletAddress && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-700">
                        <span className="flex-1 font-mono text-sm text-slate-700 dark:text-slate-300">
                          {agent.walletAddress}
                        </span>
                        <button
                          onClick={() => copyWalletAddress(agent.walletAddress || '')}
                          className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                        >
                          {copiedAddress === agent.walletAddress ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <a
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      Open Circle Faucet
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setFundingAgent(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                    Select &quot;Arc Testnet&quot; network on the faucet page
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setFundingAgent(fundingAgent === agent.id ? null : agent.id)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-arc-600 dark:text-arc-400 bg-arc-50 dark:bg-arc-900/20 hover:bg-arc-100 dark:hover:bg-arc-900/30 rounded-lg transition-colors"
                >
                  <Wallet className="w-4 h-4 inline-block mr-2" />
                  {fundingAgent === agent.id ? 'Close' : 'Add Funds'}
                </button>
              </div>
            </div>
          ))}

          {/* Example Agent Section */}
          {showExample && (
            <>
              <div className="mt-8 mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Example Agent</h2>
                <button
                  onClick={() => setShowExample(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Hide Example
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 p-6 shadow-sm relative">
                {/* Example Badge */}
                <div className="absolute -top-3 left-4 px-3 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full border border-amber-300 dark:border-amber-700">
                  EXAMPLE - Illustrative Data
                </div>

                <div className="flex items-start justify-between mt-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {exampleAgent.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                          <Shield className="w-3 h-3" />
                          zkML
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                          <FileCheck className="w-3 h-3" />
                          Compliant
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Connected to {exampleAgent.connectedService}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 mt-1">
                        <Wallet className="w-3 h-3" />
                        {exampleAgent.walletAddress?.slice(0, 10)}...{exampleAgent.walletAddress?.slice(-8)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${exampleAgent.balance}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      USDC Balance
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Model</p>
                    <p className="font-medium text-slate-900 dark:text-white">{exampleAgent.modelName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Service</p>
                    <p className="font-medium text-slate-900 dark:text-white">{exampleAgent.connectedService}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">zkML Proofs</p>
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4 text-arc-500" />
                      <span className="font-medium text-green-600 dark:text-green-400">{exampleAgent.proofs.valid}</span>
                      <span className="text-slate-400 dark:text-slate-500">/{exampleAgent.proofs.total}</span>
                    </div>
                  </div>
                </div>

                {/* Proof Status for example */}
                <div className="mt-6">
                  <ProofStatus
                    agentId={exampleAgent.id}
                    proofs={exampleAgent.proofs.items}
                    validProofCount={exampleAgent.proofs.valid}
                  />
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>This is example data</strong> showing what a working agent looks like after it has made x402 requests and generated zkML proofs. Your agents will appear above once created.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
