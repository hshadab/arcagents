'use client';

import { ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Arc Agents is brought to you by{' '}
            <a
              href="https://www.icme.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-arc-600 dark:text-arc-400 hover:text-arc-700 dark:hover:text-arc-300 transition-colors"
            >
              ICME Labs
            </a>
          </p>

          <div className="flex items-center gap-6">
            <a
              href="https://www.icme.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
            >
              ICME
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.novanet.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
            >
              NovaNet
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/ICME-Lab/jolt-atlas"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
            >
              JOLT-Atlas zkML
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
