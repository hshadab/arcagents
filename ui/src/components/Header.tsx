'use client';

import Link from 'next/link';
import { ConnectKitButton } from 'connectkit';

export function Header() {
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
          <Link
            href="/spawn"
            className="px-4 py-1.5 bg-arc-500 hover:bg-arc-600 text-white font-medium rounded-lg transition-colors"
          >
            Launch Agent
          </Link>
        </nav>

        <ConnectKitButton />
      </div>
    </header>
  );
}
