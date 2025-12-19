'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Wallet, ExternalLink, Check, Copy, Vault } from 'lucide-react';
import { TreasurySetup } from './TreasurySetup';
import { getTreasury } from '@/lib/treasury';
import { getBalance } from '@/lib/multiChainPayment';

// Simple wallet context using localStorage
export function useWalletAddress() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('arc-wallet-address');
    if (saved) setAddress(saved);
  }, []);

  const saveAddress = (addr: string) => {
    localStorage.setItem('arc-wallet-address', addr);
    setAddress(addr);
  };

  const clearAddress = () => {
    localStorage.removeItem('arc-wallet-address');
    setAddress(null);
  };

  return { address, saveAddress, clearAddress };
}

export function Header() {
  const { address, saveAddress, clearAddress } = useWalletAddress();
  const [inputAddress, setInputAddress] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTreasury, setShowTreasury] = useState(false);
  const [hasTreasury, setHasTreasury] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);

  const fetchTreasuryBalance = useCallback(async () => {
    const treasury = getTreasury();
    if (treasury) {
      setHasTreasury(true);
      try {
        const result = await getBalance({ address: treasury.address, privateKey: treasury.privateKey }, 'base');
        setTreasuryBalance(result.formatted);
      } catch (error) {
        console.error('Failed to fetch treasury balance:', error);
        setTreasuryBalance(null);
      }
    } else {
      setHasTreasury(false);
      setTreasuryBalance(null);
    }
  }, []);

  useEffect(() => {
    fetchTreasuryBalance();
  }, [fetchTreasuryBalance, showTreasury]);

  const handleSave = () => {
    if (inputAddress && inputAddress.startsWith('0x') && inputAddress.length === 42) {
      saveAddress(inputAddress);
      setShowInput(false);
      setInputAddress('');
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
          <img
            src="https://pbs.twimg.com/profile_images/1955238194443849732/sHyVRItm_400x400.jpg"
            alt="Arc"
            className="w-8 h-8 rounded-lg"
          />
          <span>Arc Agents</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/about"
            className="text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors font-medium"
          >
            About
          </Link>
          <Link
            href="/"
            className="text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors font-medium"
          >
            Services
          </Link>
          <Link
            href="/agents"
            className="text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors font-medium"
          >
            My Agents
          </Link>
          <Link
            href="/activity"
            className="text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors font-medium"
          >
            Activity
          </Link>
          <Link
            href="/how-to-use"
            className="text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors font-medium"
          >
            How to Use
          </Link>
        </nav>

        {/* Simplified Wallet - Just enter address */}
        <div className="flex items-center gap-2">
          {address ? (
            <div className="flex items-center gap-2">
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 px-3 py-1.5 bg-arc-50 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 rounded-lg text-sm font-mono hover:bg-arc-100 dark:hover:bg-arc-900/50 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                {address.slice(0, 6)}...{address.slice(-4)}
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
              <button
                onClick={clearAddress}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Change
              </button>
            </div>
          ) : showInput ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={inputAddress}
                  onChange={(e) => setInputAddress(e.target.value)}
                  placeholder="0x... (any EVM wallet)"
                  className="w-56 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  title="Enter any Ethereum/EVM wallet address (MetaMask, Coinbase Wallet, etc.)"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={!inputAddress || !inputAddress.startsWith('0x') || inputAddress.length !== 42}
                className="px-3 py-1.5 text-sm bg-arc-500 hover:bg-arc-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowInput(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-arc-500 hover:bg-arc-600 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <Wallet className="w-4 h-4" />
              Enter Wallet
            </button>
          )}
          <button
            onClick={() => setShowTreasury(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              hasTreasury
                ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            }`}
            title={hasTreasury ? 'Manage treasury' : 'Set up treasury for agent payments'}
          >
            <Vault className="w-4 h-4" />
            {hasTreasury && treasuryBalance !== null ? (
              <span>${parseFloat(treasuryBalance).toFixed(2)}</span>
            ) : (
              <span>Treasury</span>
            )}
          </button>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
            title="Get testnet USDC"
          >
            Faucet
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Treasury Setup Modal */}
      <TreasurySetup isOpen={showTreasury} onClose={() => setShowTreasury(false)} />
    </header>
  );
}
