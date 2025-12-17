'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { Bot, Wallet, DollarSign, Loader2, CheckCircle, AlertCircle, Shield, FileCheck, Brain } from 'lucide-react';
import type { X402Service } from '@arc-agent/sdk';
import { getDecisionModel, suggestModelForService, type DecisionModel, type DecisionModelId } from '@/lib/models';
import { CHAIN_IDS } from '@/lib/wagmi';

// Contract addresses
const CONTRACT_ADDRESSES = {
  [CHAIN_IDS.ARC_TESTNET]: {
    arcAgent: process.env.NEXT_PUBLIC_ARC_AGENT_ADDRESS as `0x${string}` | undefined,
    arcIdentity: process.env.NEXT_PUBLIC_ARC_IDENTITY_ADDRESS as `0x${string}` | undefined,
  },
  [CHAIN_IDS.ARC_MAINNET]: {
    arcAgent: undefined,
    arcIdentity: undefined,
  },
};

// ArcAgent ABI for creating agents
const ARC_AGENT_ABI = [
  {
    name: 'createAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'circleWallet', type: 'address' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'proverVersion', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
] as const;

const ARC_IDENTITY_ABI = [
  {
    name: 'getGlobalId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

interface SpawnFormProps {
  selectedService?: X402Service | null;
  onSuccess?: (agentId: string) => void;
}

export function SpawnForm({ selectedService, onSuccess }: SpawnFormProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [name, setName] = useState('');
  const [deposit, setDeposit] = useState('1');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentWalletAddress, setAgentWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Built-in features (always enabled)
  const [enableZkmlProofs, setEnableZkmlProofs] = useState(true);
  const enableCompliance = true; // Always enabled - dual-sided compliance is mandatory
  const [threshold, setThreshold] = useState(0.7);

  // Auto-determine model based on service
  const assignedModel: DecisionModel | undefined = useMemo(() => {
    if (!selectedService) return undefined;

    // If service specifies a required model, use it
    if (selectedService.requiredModel) {
      return getDecisionModel(selectedService.requiredModel as DecisionModelId);
    }

    // Otherwise suggest based on category and name
    if (selectedService.serviceType === 'action') {
      const suggestedId = suggestModelForService(selectedService.category, selectedService.name);
      return getDecisionModel(suggestedId);
    }

    return undefined;
  }, [selectedService]);

  // zkML proofs are mandatory for agents with decision models
  useEffect(() => {
    if (assignedModel) {
      setEnableZkmlProofs(true); // Always enabled when model assigned
      setThreshold(assignedModel.defaultThreshold);
    }
  }, [assignedModel]);

  // Check if on correct network and contracts deployed
  const isArcNetwork = chainId === CHAIN_IDS.ARC_TESTNET || chainId === CHAIN_IDS.ARC_MAINNET;
  const contracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  const contractsDeployed = contracts?.arcAgent && contracts?.arcIdentity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;

    setLoading(true);
    setError(null);

    try {
      if (contractsDeployed && walletClient && publicClient && contracts.arcAgent && contracts.arcIdentity) {
        // Real contract call to create agent
        const modelHash = assignedModel?.modelHash || ('0x' + '0'.repeat(64)) as `0x${string}`;
        const proverVersion = 'jolt-atlas-0.2.0';

        // Create the agent on-chain
        const hash = await walletClient.writeContract({
          address: contracts.arcAgent,
          abi: ARC_AGENT_ABI,
          functionName: 'createAgent',
          args: [
            address as `0x${string}`, // Use connected wallet as circle wallet placeholder
            modelHash as `0x${string}`,
            proverVersion,
          ],
          chain: { id: chainId } as any,
          account: address as `0x${string}`,
        });

        // Wait for transaction confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Extract agent ID from logs (AgentCreated event)
        // The agent ID is typically in the first indexed topic after the event signature
        let newAgentId = '1';
        if (receipt.logs && receipt.logs.length > 0) {
          // Try to parse agent ID from event logs
          for (const log of receipt.logs) {
            if (log.topics && log.topics.length > 1) {
              // Agent ID is usually the second topic (first indexed param)
              const idHex = log.topics[1];
              if (idHex) {
                newAgentId = BigInt(idHex).toString();
                break;
              }
            }
          }
        }

        // Get the global ID
        let globalId = '';
        try {
          globalId = await publicClient.readContract({
            address: contracts.arcIdentity,
            abi: ARC_IDENTITY_ABI,
            functionName: 'getGlobalId',
            args: [BigInt(newAgentId)],
          }) as string;
        } catch {
          globalId = `eip155:${chainId}:${contracts.arcIdentity}:${newAgentId}`;
        }

        setAgentId(newAgentId);
        setAgentWalletAddress(address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null);
        setDemoMode(false);
      } else {
        // Demo mode - simulate success with Circle wallet creation
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const mockAgentId = `demo-agent-${Date.now()}`;
        // Generate a mock wallet address (in production, this comes from Circle Programmable Wallets)
        const mockWalletAddress = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
        setAgentId(mockAgentId);
        setAgentWalletAddress(mockWalletAddress);
        setDemoMode(true);
      }
      setSuccess(true);
      onSuccess?.(agentId || '');
    } catch (err) {
      console.error('Failed to spawn agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to spawn agent');
    } finally {
      setLoading(false);
    }
  };

  if (success && agentId) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Agent Launched!
          {demoMode && <span className="text-sm font-normal text-yellow-600 ml-2">(Demo)</span>}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Your agent <span className="font-mono text-sm">{agentId}</span> is ready.
        </p>
        {agentWalletAddress && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Wallet: <span className="font-mono">{agentWalletAddress}</span>
          </p>
        )}

        {/* Built-in Features */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            {assignedModel && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full">
                <Brain className="w-3 h-3" />
                {assignedModel.name}
              </span>
            )}
            {assignedModel && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full">
                <Shield className="w-3 h-3" />
                zkML Proofs
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
              <FileCheck className="w-3 h-3" />
              Compliance
            </span>
          </div>
          {assignedModel && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Threshold: {threshold.toFixed(2)} - Only acts when model output ≥ {threshold.toFixed(2)}
            </p>
          )}
        </div>

        {demoMode && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Demo mode - contracts not yet deployed. Deploy contracts to Arc testnet to create real agents.
            </p>
          </div>
        )}
        {selectedService && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Connected to {selectedService.name}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              setSuccess(false);
              setAgentId(null);
              setAgentWalletAddress(null);
              setName('');
              setDemoMode(false);
            }}
            className="px-4 py-2 text-sm font-medium text-arc-600 dark:text-arc-400 hover:bg-arc-50 dark:hover:bg-arc-900/20 rounded-lg transition-colors"
          >
            Launch Another
          </button>
          <a
            href="/agents"
            className="px-4 py-2 text-sm font-medium text-white bg-arc-500 hover:bg-arc-600 rounded-lg transition-colors"
          >
            View Agents
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Bot className="w-5 h-5 text-arc-500" />
        Launch New Agent
      </h2>

      {/* Network/Contract Warnings */}
      {isConnected && !isArcNetwork && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please switch to Arc Testnet (Chain ID: {CHAIN_IDS.ARC_TESTNET}) to launch agents.
          </p>
        </div>
      )}

      {isConnected && isArcNetwork && !contractsDeployed && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Contracts not yet deployed. You can demo the spawn flow, but agents won&apos;t be created on-chain.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {selectedService && (
        <div className="mb-6 p-4 bg-arc-50 dark:bg-arc-900/20 rounded-lg border border-arc-200 dark:border-arc-800">
          <p className="text-sm text-arc-600 dark:text-arc-400 mb-1">
            Connected Service
          </p>
          <p className="font-medium text-gray-900 dark:text-white">
            {selectedService.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedService.url}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Agent Name
          </label>
          <div className="relative">
            <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedService ? `${selectedService.name}-agent` : 'my-agent'}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-arc-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Wallet Address
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={address || ''}
              disabled
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-mono text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Using your connected wallet
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Initial USDC Deposit
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              min="0"
              step="0.01"
              placeholder="1.00"
              className="w-full pl-10 pr-16 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-arc-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              USDC
            </span>
          </div>
          {selectedService && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Estimated {Math.floor(parseFloat(deposit) / parseFloat(selectedService.price))} requests at ${selectedService.price}/req
            </p>
          )}
        </div>

        {/* Decision Model Section (for action services) */}
        {assignedModel && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Decision Model
            </p>

            <div className="p-4 rounded-lg border border-arc-200 dark:border-arc-800 bg-arc-50 dark:bg-arc-900/20">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {assignedModel.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {assignedModel.description}
                  </p>
                </div>
              </div>

              {/* Model Details */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Input</p>
                  <p className="text-gray-700 dark:text-gray-300">{assignedModel.inputDescription}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Output</p>
                  <p className="text-gray-700 dark:text-gray-300">{assignedModel.outputDescription}</p>
                </div>
              </div>

              {/* Threshold Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Decision Threshold
                  </label>
                  <span className="text-xs font-mono text-arc-600 dark:text-arc-400">
                    {threshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-arc-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Agent will only execute actions when model output ≥ {threshold.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Built-in Features */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Built-in Features
          </p>

          {/* Compliance - Always On */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 mb-3">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Dual-Sided Compliance
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                  Always On
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Circle Compliance Engine screens your wallet at signup and all payment recipients before every transfer. Sanctions, PEP, and risk checks built-in.
              </p>
            </div>
          </div>

          {/* zkML Proofs - Always On for agents with models */}
          {assignedModel ? (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-arc-200 dark:border-arc-800 bg-arc-50 dark:bg-arc-900/20">
              <div className="w-5 h-5 rounded-full bg-arc-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-arc-600 dark:text-arc-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Decision Proofs
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-arc-100 dark:bg-arc-800 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                    Always On
                  </span>
                </div>
                <p className="text-xs text-arc-600 dark:text-arc-400 mt-1">
                  JOLT-Atlas zkML proof of <strong>{assignedModel.name}</strong> output generated BEFORE executing {selectedService?.name}. Cryptographic proof your agent computed correctly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Decision Proofs
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    N/A
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This service doesn&apos;t require a decision model. zkML proofs are automatically enabled for action services that require ML-based decisions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!isConnected || loading}
        className="mt-6 w-full py-3 px-4 bg-arc-500 hover:bg-arc-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Launching Agent...
          </>
        ) : !isConnected ? (
          'Connect Wallet to Launch'
        ) : (
          <>
            <Bot className="w-5 h-5" />
            {contractsDeployed ? 'Launch Agent' : 'Launch Agent (Demo)'}
          </>
        )}
      </button>
    </form>
  );
}
