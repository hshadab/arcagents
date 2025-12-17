'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Zap, Shield, DollarSign, Brain, ExternalLink } from 'lucide-react';
import { ServiceList } from '@/components/ServiceList';
import type { X402Service } from '@arc-agent/sdk';

export default function Home() {
  const router = useRouter();

  const handleSpawn = (service: X402Service) => {
    // Navigate to spawn page with service URL as query param
    router.push(`/spawn?service=${encodeURIComponent(service.url)}`);
  };

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
          Launch{' '}
          <span className="bg-gradient-to-r from-arc-500 to-arc-600 bg-clip-text text-transparent">Arc Agents</span>
          {' '}for Commerce
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Deploy agents. Verify execution. Pay in USDC. x402-powered commerce with cryptographic proof your agents did it right.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <a
          href="https://github.com/ICME-Lab/jolt-atlas"
          target="_blank"
          rel="noopener noreferrer"
          className="p-5 bg-white dark:bg-slate-900 rounded-xl border-l-4 border-l-purple-400 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-l-purple-500 transition-all group"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400 flex-shrink-0" />
            Trustless Automation
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500 transition-colors" />
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Jolt Atlas zkML proves your agents execute business logic correctly.
          </p>
        </a>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border-l-4 border-l-blue-400 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-l-blue-500 transition-all">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400 flex-shrink-0" />
            Instant Payments
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Agents pay per-request with USDC. No subscriptions, no API keys.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border-l-4 border-l-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-l-emerald-500 transition-all">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            Built-in Compliance
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dual-sided screening on every agent. Circle Compliance Engine checks both you and payment recipients.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border-l-4 border-l-amber-400 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-l-amber-500 transition-all">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400 flex-shrink-0" />
            USDC Treasury
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Fund your agent once, it handles all payments autonomously.
          </p>
        </div>
      </div>

      {/* Services Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          x402 Services
        </h2>
        <ServiceList onSpawn={handleSpawn} />
      </div>
    </div>
  );
}
