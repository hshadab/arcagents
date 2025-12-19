'use client';

import { useState, useEffect } from 'react';
import { Wallet, Key, AlertTriangle, Check, Copy, ExternalLink, X } from 'lucide-react';
import { getTreasury, saveTreasury, clearTreasury, type Treasury } from '@/lib/treasury';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

interface TreasurySetupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TreasurySetup({ isOpen, onClose }: TreasurySetupProps) {
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [mode, setMode] = useState<'view' | 'import' | 'generate'>('view');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'address' | 'key' | null>(null);

  useEffect(() => {
    const saved = getTreasury();
    setTreasury(saved);
    if (!saved) {
      setMode('generate');
    }
  }, [isOpen]);

  const handleGenerate = () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const newTreasury: Treasury = {
      address: account.address,
      privateKey: privateKey,
      fundedAt: Date.now(),
    };
    saveTreasury(newTreasury);
    setTreasury(newTreasury);
    setMode('view');
  };

  const handleImport = () => {
    setError(null);
    try {
      let key = privateKeyInput.trim();
      if (!key.startsWith('0x')) {
        key = `0x${key}`;
      }
      if (key.length !== 66) {
        throw new Error('Invalid private key length');
      }
      const account = privateKeyToAccount(key as `0x${string}`);
      const newTreasury: Treasury = {
        address: account.address,
        privateKey: key,
        fundedAt: Date.now(),
      };
      saveTreasury(newTreasury);
      setTreasury(newTreasury);
      setPrivateKeyInput('');
      setMode('view');
    } catch (err) {
      setError('Invalid private key. Must be a 64-character hex string.');
    }
  };

  const handleClear = () => {
    if (confirm('Remove treasury? Agents will not be able to make payments until a new treasury is set up.')) {
      clearTreasury();
      setTreasury(null);
      setMode('generate');
    }
  };

  const copyToClipboard = (text: string, type: 'address' | 'key') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown positioned from top-right */}
      <div className="fixed top-16 right-4 z-50 w-96 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-arc-500" />
              Treasury
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            All agents pay from this wallet.
          </p>

        {treasury && mode === 'view' ? (
          <div className="space-y-4">
            {/* Address */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Treasury Address
              </label>
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="flex-1 font-mono text-sm text-slate-700 dark:text-slate-300 truncate">
                  {treasury.address}
                </span>
                <button
                  onClick={() => copyToClipboard(treasury.address, 'address')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {copied === 'address' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Funding instructions */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                Fund this address on both networks:
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>• <strong>Arc Testnet</strong> — proofs & contracts</li>
                <li>• <strong>Base</strong> — x402 service payments</li>
              </ul>
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Circle Faucet <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('import')}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Import Different Key
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : mode === 'generate' ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-medium mb-1">Security Notice</p>
                  <p>The private key is stored in your browser's localStorage. Only use testnet funds or a dedicated wallet for agents.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleGenerate}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-arc-500 hover:bg-arc-600 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Generate New Treasury Wallet
              </button>
              <button
                onClick={() => setMode('import')}
                className="w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Import Existing Private Key
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Private Key
              </label>
              <input
                type="password"
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
              />
              {error && (
                <p className="text-xs text-red-600 mt-1">{error}</p>
              )}
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Only import keys for wallets you control. Never share private keys.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode(treasury ? 'view' : 'generate');
                  setPrivateKeyInput('');
                  setError(null);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-arc-500 hover:bg-arc-600 rounded-lg transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
