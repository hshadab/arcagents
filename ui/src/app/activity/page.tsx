'use client';

import { useState } from 'react';
import { ActivityDashboard } from '@/components/ActivityDashboard';
import { ProofExplorer } from '@/components/ProofExplorer';
import { Activity, Shield } from 'lucide-react';

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<'activity' | 'proofs'>('activity');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Agent Activity
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Execution logs and on-chain proof attestations
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-arc-500 text-arc-600 dark:text-arc-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 inline-block mr-2" />
            Execution Logs
          </button>
          <button
            onClick={() => setActiveTab('proofs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'proofs'
                ? 'border-arc-500 text-arc-600 dark:text-arc-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 inline-block mr-2" />
            On-Chain Proofs
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'activity' ? (
        <>
          <ActivityDashboard
            limit={50}
            showHeader={true}
            autoRefresh={true}
            refreshInterval={15000}
          />

          {/* Info Section */}
          <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              About Execution Logs
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">+</span>
                Each row shows an agent execution: the x402 service called, payment made, and result.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-arc-500">+</span>
                zkML proofs are generated for services that support verification.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500">+</span>
                Activity refreshes automatically every 15 seconds.
              </li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <ProofExplorer limit={20} />

          {/* Info Section */}
          <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              About On-Chain Proofs
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-arc-500">+</span>
                Proofs are submitted to the ArcProofAttestation contract on Arc testnet.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">+</span>
                Valid proofs are attested by trusted validators.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">+</span>
                Each proof includes model hash, input hash, and output hash for verification.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
