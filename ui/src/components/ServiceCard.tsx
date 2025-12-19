'use client';

import { Database, Brain, Cpu, HardDrive, Sparkles, Plug, Package } from 'lucide-react';
import type { X402Service } from '@arc-agent/sdk';

interface ServiceCardProps {
  service: X402Service;
  onLaunch?: (service: X402Service) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  data: Database,
  ai: Brain,
  compute: Cpu,
  storage: HardDrive,
  oracle: Sparkles,
  api: Plug,
  other: Package,
};

export function ServiceCard({ service, onLaunch }: ServiceCardProps) {
  const Icon = categoryIcons[service.category || 'other'] || Package;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-lg hover:border-arc-300 dark:hover:border-arc-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {service.name}
            </h3>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-green-600 dark:text-green-400">
            ${service.price}
          </p>
          <p className="text-xs text-slate-500">per request</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
        {service.description || service.url}
      </p>



      {onLaunch && (
        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => onLaunch(service)}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            Launch Agent
          </button>
        </div>
      )}
    </div>
  );
}
