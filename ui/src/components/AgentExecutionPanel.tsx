'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Clock, CheckCircle, XCircle, Loader2, Calendar, RefreshCw, Brain, Shield } from 'lucide-react';
import {
  SavedAgent,
  ScheduleConfig,
  LastExecution,
  updateAgentSchedule,
  updateAgentLastExecution,
} from '@/lib/agentStorage';

interface ExecutionResult {
  success: boolean;
  data?: unknown;
  modelInference?: {
    modelName: string;
    input: unknown;
    output: number;
    decision: 'approve' | 'reject';
    threshold: number;
  };
  payment?: {
    amount: string;
    amountFormatted: string;
    txHash?: string;
    recipient: string;
    simulated: boolean;
    complianceChecked?: boolean;
  };
  proof?: {
    hash: string;
    tag: string;
    status: 'valid' | 'invalid' | 'pending';
    timestamp: number;
    metadata: {
      modelHash: string;
      inputHash: string;
      outputHash: string;
      proofSize: number;
      generationTime: number;
      proverVersion: string;
    };
  };
  error?: string;
  note?: string;
  durationMs: number;
  executionType?: 'ml-agent' | 'simple-agent';
}

interface AgentExecutionPanelProps {
  agent: SavedAgent;
  onExecutionComplete?: (result: ExecutionResult) => void;
  onAgentUpdate?: (agent: SavedAgent) => void;
}

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];

export function AgentExecutionPanel({ agent, onExecutionComplete, onAgentUpdate }: AgentExecutionPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [schedule, setSchedule] = useState<ScheduleConfig>(
    agent.schedule || { enabled: false, intervalMinutes: 15 }
  );
  const [nextRunTime, setNextRunTime] = useState<number | null>(null);
  const schedulerRef = useRef<NodeJS.Timeout | null>(null);

  const executeAgent = useCallback(async () => {
    if (!agent.connectedServiceUrl) {
      setLastResult({
        success: false,
        error: 'No service URL configured for this agent',
        durationMs: 0,
      });
      return;
    }

    setIsRunning(true);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          agentName: agent.name,
          serviceUrl: agent.connectedServiceUrl,
          serviceName: agent.connectedService,
          servicePrice: agent.connectedServicePrice,
          servicePayTo: agent.connectedServicePayTo,
          walletAddress: agent.walletAddress,
          walletPrivateKey: agent.walletPrivateKey,  // Legacy EVM key
          wallets: agent.wallets,  // Multi-chain wallets (Base, Solana)
          // ML Agent fields
          zkmlEnabled: agent.features?.zkmlEnabled,
          modelName: agent.modelName,
          threshold: agent.threshold,
        }),
      });

      const result: ExecutionResult = await response.json();
      setLastResult(result);

      // Update lastExecution in storage
      const lastExecution: LastExecution = {
        timestamp: Date.now(),
        success: result.success,
        outputPreview: result.data ? JSON.stringify(result.data).slice(0, 200) : undefined,
        error: result.error,
        proofHash: result.proof?.hash,
        amountPaid: result.payment?.amountFormatted,
      };
      updateAgentLastExecution(agent.id, lastExecution);

      // Notify parent
      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
      if (onAgentUpdate) {
        onAgentUpdate({ ...agent, lastExecution });
      }
    } catch (error) {
      const result: ExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        durationMs: 0,
      };
      setLastResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [agent, onExecutionComplete, onAgentUpdate]);

  // Manage scheduled execution
  useEffect(() => {
    if (schedule.enabled && agent.connectedServiceUrl) {
      // Clear existing timer
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
      }

      // Calculate next run time
      const intervalMs = schedule.intervalMinutes * 60 * 1000;
      setNextRunTime(Date.now() + intervalMs);

      // Set up interval
      schedulerRef.current = setInterval(() => {
        executeAgent();
        setNextRunTime(Date.now() + intervalMs);
      }, intervalMs);

      return () => {
        if (schedulerRef.current) {
          clearInterval(schedulerRef.current);
        }
      };
    } else {
      // Clear timer if schedule disabled
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
      setNextRunTime(null);
    }
  }, [schedule.enabled, schedule.intervalMinutes, executeAgent, agent.connectedServiceUrl]);

  const handleScheduleToggle = () => {
    const newSchedule = { ...schedule, enabled: !schedule.enabled };
    setSchedule(newSchedule);
    updateAgentSchedule(agent.id, newSchedule);
  };

  const handleIntervalChange = (intervalMinutes: number) => {
    const newSchedule = { ...schedule, intervalMinutes };
    setSchedule(newSchedule);
    updateAgentSchedule(agent.id, newSchedule);
  };

  const formatTimeUntil = (timestamp: number): string => {
    const seconds = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Update countdown every second
  const [, setTick] = useState(0);
  useEffect(() => {
    if (nextRunTime) {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [nextRunTime]);

  const hasServiceUrl = !!agent.connectedServiceUrl;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-arc-500" />
          Execution
        </h4>
        {schedule.enabled && (
          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Auto-running
          </span>
        )}
      </div>

      {/* No service URL warning */}
      {!hasServiceUrl && (
        <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
          This agent has no connected service URL. Connect a service to enable execution.
        </div>
      )}

      {/* Run button and status */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={executeAgent}
          disabled={isRunning || !hasServiceUrl}
          className="flex items-center gap-2 px-4 py-2 bg-arc-600 hover:bg-arc-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Now
            </>
          )}
        </button>

        {lastResult && (
          <div className="flex items-center gap-2 text-sm">
            {lastResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-gray-600 dark:text-gray-400">
              {lastResult.success ? 'Success' : 'Failed'}
              {lastResult.durationMs > 0 && ` (${lastResult.durationMs}ms)`}
            </span>
          </div>
        )}
      </div>

      {/* Schedule controls */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleScheduleToggle}
          disabled={!hasServiceUrl}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            schedule.enabled
              ? 'bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          } ${!hasServiceUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {schedule.enabled ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          {schedule.enabled ? 'Stop Schedule' : 'Schedule'}
        </button>

        <select
          value={schedule.intervalMinutes}
          onChange={(e) => handleIntervalChange(Number(e.target.value))}
          disabled={!hasServiceUrl}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Every {opt.label}
            </option>
          ))}
        </select>

        {nextRunTime && (
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Next: {formatTimeUntil(nextRunTime)}
          </span>
        )}
      </div>

      {/* ML Agent: Model Inference Results */}
      {lastResult?.modelInference && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            Model Inference
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Model</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {lastResult.modelInference.modelName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Output</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {lastResult.modelInference.output.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Threshold</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {lastResult.modelInference.threshold}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Decision</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                lastResult.modelInference.decision === 'approve'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {lastResult.modelInference.decision === 'approve' ? 'APPROVE' : 'REJECT'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ML Agent: Proof Status */}
      {lastResult?.proof && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            zkML Proof
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                lastResult.proof.status === 'valid'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : lastResult.proof.status === 'invalid'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              }`}>
                {lastResult.proof.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Hash</span>
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                {lastResult.proof.hash.slice(0, 18)}...
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Generation</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {lastResult.proof.metadata.generationTime}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Prover</span>
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                {lastResult.proof.metadata.proverVersion}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Last execution result preview */}
      {lastResult?.success && Boolean(lastResult.data) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Output:</div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 p-2 rounded overflow-hidden text-ellipsis">
            {JSON.stringify(lastResult.data).slice(0, 150)}
            {JSON.stringify(lastResult.data).length > 150 && '...'}
          </div>
          {lastResult.payment && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>
                Paid: {lastResult.payment.amountFormatted} USDC
                {lastResult.payment.simulated && ' (simulated)'}
              </div>
              {lastResult.payment.complianceChecked && (
                <div className="text-green-600 dark:text-green-400">
                  Compliance check passed
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {lastResult?.error && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-red-500 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {lastResult.error}
          </div>
        </div>
      )}
    </div>
  );
}
