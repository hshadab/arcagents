'use client';

import { Database, Brain, Cpu, HardDrive, Sparkles, Plug, Package, Shield, Download, Zap } from 'lucide-react';
import type { X402Service } from '@arc-agent/sdk';
import { getDecisionModel, type DecisionModelId } from '@/lib/models';

interface ServiceCardProps {
  service: X402Service;
  onSpawn?: (service: X402Service) => void;
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

export function ServiceCard({ service, onSpawn }: ServiceCardProps) {
  const Icon = categoryIcons[service.category || 'other'] || Package;
  const isAction = service.serviceType === 'action';
  const isFetch = service.serviceType === 'fetch';
  const model = service.requiredModel ? getDecisionModel(service.requiredModel as DecisionModelId) : undefined;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-lg hover:border-arc-300 dark:hover:border-arc-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {service.name}
              </h3>
              {/* Service Type Badge */}
              {isAction && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium" title="Action service - requires decision proof">
                  <Zap className="w-3 h-3" />
                  Action
                </span>
              )}
              {isFetch && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium" title="Fetch service - data retrieval">
                  <Download className="w-3 h-3" />
                  Fetch
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
              {service.category || 'API'}
            </p>
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

      {/* Required Model Info for Action Services */}
      {isAction && model && (
        <div className="mb-4 px-3 py-2 bg-arc-50 dark:bg-arc-900/20 rounded-lg border border-arc-200 dark:border-arc-800">
          <div className="flex items-start gap-2 text-xs">
            <Shield className="w-3.5 h-3.5 text-arc-600 dark:text-arc-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-arc-700 dark:text-arc-300 font-medium">
                Requires: {model.name}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {model.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fetch service info */}
      {isFetch && (
        <div className="mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
            <Download className="w-3.5 h-3.5" />
            <span>Data retrieval - no decision proof needed</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
            {service.network}
          </span>
        </div>

        {onSpawn && (
          <button
            onClick={() => onSpawn(service)}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            Launch Agent
          </button>
        )}
      </div>
    </div>
  );
}
