'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Shield,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface ExecutionLog {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: number;
  success: boolean;
  serviceUrl: string;
  serviceName: string;
  amountPaid?: string;
  proofHash?: string;
  proofSubmitted?: boolean;
  proofTxHash?: string;
  error?: string;
  durationMs: number;
  response?: unknown;
}

interface ActivityDashboardProps {
  agentId?: string;
  limit?: number;
  showHeader?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatUSDC(atomic: string): string {
  const num = parseInt(atomic) / 1_000_000;
  return num < 0.01 ? num.toFixed(4) : num.toFixed(2);
}

function LogRow({ log, expanded, onToggle }: { log: ExecutionLog; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {log.success ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 dark:text-white">
                {log.agentName}
              </span>
              <span className="text-slate-400 dark:text-slate-500">→</span>
              <span className="text-slate-600 dark:text-slate-400">
                {log.serviceName}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(log.timestamp)}
              </span>
              <span>{log.durationMs}ms</span>
              {log.amountPaid && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <DollarSign className="w-3 h-3" />
                  {formatUSDC(log.amountPaid)} USDC
                </span>
              )}
              {log.proofHash && (
                <span className="flex items-center gap-1 text-arc-600 dark:text-arc-400">
                  <Shield className="w-3 h-3" />
                  {log.proofSubmitted ? 'Proof on-chain' : 'Proof generated'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-800/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Status</p>
              <p className={`font-medium ${log.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {log.success ? 'Success' : 'Failed'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Timestamp</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Service URL</p>
              <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                {log.serviceUrl}
              </p>
            </div>
            {log.error && (
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Error</p>
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {log.error}
                </p>
              </div>
            )}
            {log.proofHash && (
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Proof Hash</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                    {log.proofHash}
                  </p>
                  {log.proofTxHash && (
                    <a
                      href={`https://explorer.circle.com/tx/${log.proofTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-arc-600 dark:text-arc-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {log.response !== undefined && log.response !== null && (
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Response Preview</p>
                <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded overflow-x-auto max-h-32">
                  {(() => {
                    const str = JSON.stringify(log.response, null, 2);
                    return str.length > 500 ? str.slice(0, 500) + '...' : str;
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivityDashboard({
  agentId,
  limit = 20,
  showHeader = true,
  autoRefresh = false,
  refreshInterval = 30000,
}: ActivityDashboardProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (agentId) params.set('agentId', agentId);

      const response = await fetch(`/api/activity?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      setError('Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [agentId, limit, autoRefresh, refreshInterval]);

  // Stats
  const successCount = logs.filter((l) => l.success).length;
  const failedCount = logs.filter((l) => !l.success).length;
  const totalSpent = logs
    .filter((l) => l.amountPaid)
    .reduce((sum, l) => sum + parseInt(l.amountPaid || '0'), 0);
  const proofsGenerated = logs.filter((l) => l.proofHash).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      {showHeader && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-arc-600 dark:text-arc-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Agent Activity</h3>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="text-sm text-arc-600 dark:text-arc-400 hover:underline flex items-center gap-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{successCount}</span> Success
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{failedCount}</span> Failed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">${formatUSDC(totalSpent.toString())}</span> Spent
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-arc-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{proofsGenerated}</span> Proofs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Log List */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-arc-500" />
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <XCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchLogs}
            className="mt-2 text-sm text-arc-600 dark:text-arc-400 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-center">
          <Zap className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No activity yet
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Agent executions will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                expanded={expandedLog === log.id}
                onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              />
            ))}
          </div>

          {total > logs.length && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {logs.length} of {total} logs
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
