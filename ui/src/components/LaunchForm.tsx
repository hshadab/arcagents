'use client';

import { useState } from 'react';
import { Bot, Wallet, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import type { X402Service } from '@arc-agent/sdk';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useWalletAddress } from './Header';
import { saveAgent } from '@/lib/agentStorage';

interface LaunchFormProps {
  selectedService?: X402Service | null;
  onSuccess?: (agentId: string) => void;
}

export function LaunchForm({ selectedService, onSuccess }: LaunchFormProps) {
  const { address: savedAddress } = useWalletAddress();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!savedAddress;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !savedAddress) {
      setError('Please enter your wallet address first (top right)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate EVM wallet (for Base)
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      const newAgentId = `agent-${Date.now().toString(36)}`;
      const agentName = name || (selectedService ? `${selectedService.name}-agent` : 'my-agent');

      // Save agent to localStorage
      saveAgent({
        id: newAgentId,
        name: agentName,
        walletAddress: account.address,
        walletPrivateKey: privateKey,
        ownerAddress: savedAddress,
        fundedAmount: '0',
        createdAt: Date.now(),
        connectedService: selectedService?.name || undefined,
        connectedServiceUrl: selectedService?.url || undefined,
        connectedServicePrice: selectedService?.priceAtomic || undefined,
        connectedServicePayTo: selectedService?.payTo || undefined,
        connectedServiceCategory: selectedService?.category || undefined,
        features: {
          zkmlEnabled: true, // All agents use zkML spending proofs
          complianceEnabled: true,
        },
      });

      setAgentId(newAgentId);
      setSuccess(true);
      onSuccess?.(newAgentId);
    } catch (err) {
      console.error('Failed to launch agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch agent');
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
          Agent Created!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your agent <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{agentId}</span> is ready.
        </p>

        {/* Shared Treasury Info */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">
            <strong>All agents share a single treasury wallet.</strong>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Fund your treasury once from the Agents page. All your agents will use those funds for x402 payments.
          </p>
        </div>

        {/* zkML Spending Proofs */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full">
              <Shield className="w-3 h-3" />
              zkML Spending Proofs
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cryptographic proof of spending decisions before every payment
          </p>
        </div>

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
              setName('');
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
            Your Wallet Address
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={savedAddress || ''}
              disabled
              placeholder="No wallet address entered"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-mono text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {savedAddress ? (
              'Any EVM wallet address works (MetaMask, Coinbase Wallet, etc.)'
            ) : (
              <span className="text-arc-600 dark:text-arc-400">Click &quot;Enter Wallet&quot; at top right - use any EVM wallet address</span>
            )}
          </p>
        </div>

        {/* zkML Spending Proofs - Always On */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Built-in Protection
          </p>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-arc-200 dark:border-arc-800 bg-arc-50 dark:bg-arc-900/20">
            <div className="w-5 h-5 rounded-full bg-arc-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-arc-600 dark:text-arc-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  zkML Spending Proofs
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 bg-arc-100 dark:bg-arc-800 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                  Always On
                </span>
              </div>
              <p className="text-xs text-arc-600 dark:text-arc-400 mt-1">
                JOLT-Atlas zkML proof generated BEFORE every x402 payment. Cryptographic guardrails ensure your agent&apos;s spending decisions are verified.
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`mt-6 w-full py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
          !isConnected
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : loading
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-arc-500 hover:bg-arc-600 text-white'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Launching Agent...
          </>
        ) : !isConnected ? (
          <>
            <Wallet className="w-5 h-5" />
            Enter Wallet Address First
          </>
        ) : (
          <>
            <Bot className="w-5 h-5" />
            Launch Agent
          </>
        )}
      </button>
    </form>
  );
}
