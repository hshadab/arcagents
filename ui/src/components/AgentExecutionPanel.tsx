'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Clock, CheckCircle, XCircle, Loader2, Calendar, RefreshCw, Brain, Shield, ExternalLink, ChevronDown, ChevronUp, MessageSquare, FileCheck, DollarSign, AlertTriangle } from 'lucide-react';
import {
  SavedAgent,
  ScheduleConfig,
  LastExecution,
  updateAgentSchedule,
  updateAgentLastExecution,
} from '@/lib/agentStorage';
import { getTreasury } from '@/lib/treasury';
import {
  getServiceReputation,
  getSpentToday,
  getRecentPurchasesInCategory,
  getTimeSinceLastPurchase,
  recordSpending,
} from '@/lib/serviceReputation';

interface ExecutionResult {
  success: boolean;
  data?: unknown;
  // Spending decision (BEFORE payment)
  spendingDecision?: {
    shouldBuy: boolean;
    confidence: number;
    reasons: string[];
    riskScore: number;
    input: {
      priceUsdc: number;
      budgetUsdc: number;
      serviceSuccessRate: number;
      spentTodayUsdc: number;
      dailyLimitUsdc: number;
    };
  };
  // Content model inference (AFTER payment)
  modelInference?: {
    modelName: string;
    input: unknown;
    output: number;
    confidence: number;
    category?: string;
  };
  payment?: {
    amount: string;
    amountFormatted: string;
    txHash?: string;
    recipient: string;
    simulated?: boolean;
    complianceChecked?: boolean;
    compliance?: {
      sender: string;
      recipient: string;
      amount: string;
      approved: boolean;
      timestamp: number;
      checks: string[];
    };
  };
  proof?: {
    proofHash: string;
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
    submittedToChain?: boolean;
    chainTxHash?: string;
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

// Service info helper - determines what a service does and if it accepts input
interface ServiceInfo {
  description: string;
  acceptsInput: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputExamples?: string[];
}

function getServiceInfo(serviceUrl?: string, serviceName?: string): ServiceInfo {
  if (!serviceUrl) {
    return { description: 'No service connected', acceptsInput: false };
  }

  const url = serviceUrl.toLowerCase();
  const name = (serviceName || '').toLowerCase();

  // News services (Gloria, etc.)
  if (url.includes('gloria') || url.includes('/news') || name.includes('news')) {
    return {
      description: 'Fetches crypto news articles based on category. Returns latest headlines and summaries.',
      acceptsInput: true,
      inputLabel: 'News Category',
      inputPlaceholder: 'e.g., bitcoin, ethereum, crypto, ai_agents',
      inputExamples: ['bitcoin', 'ethereum', 'crypto', 'ai_agents', 'defi'],
    };
  }

  // Research/Analysis services
  if (url.includes('research') || url.includes('analysis') || url.includes('analyze') || name.includes('research') || name.includes('analysis')) {
    return {
      description: 'Performs in-depth research and analysis on crypto topics, tokens, or market trends.',
      acceptsInput: true,
      inputLabel: 'Research Query',
      inputPlaceholder: 'e.g., BTC price analysis, ETH staking yields',
      inputExamples: ['BTC technical analysis', 'ETH staking comparison', 'DeFi yield strategies'],
    };
  }

  // Token analysis
  if (url.includes('token') || url.includes('analyze_token')) {
    return {
      description: 'Analyzes token metrics, security scores, and risk factors.',
      acceptsInput: true,
      inputLabel: 'Token Address or Symbol',
      inputPlaceholder: 'e.g., 0x... or ETH',
      inputExamples: ['ETH', 'USDC', '0x...'],
    };
  }

  // Chat/LLM services
  if (url.includes('chat') || url.includes('llm') || url.includes('gpt') || name.includes('chat')) {
    return {
      description: 'AI chat service for conversations and questions.',
      acceptsInput: true,
      inputLabel: 'Message',
      inputPlaceholder: 'Enter your question or message...',
      inputExamples: ['Explain DeFi', 'What is staking?'],
    };
  }

  // Search services
  if (url.includes('search') || name.includes('search')) {
    return {
      description: 'Search service for finding information.',
      acceptsInput: true,
      inputLabel: 'Search Query',
      inputPlaceholder: 'Enter search terms...',
      inputExamples: ['Ethereum merge', 'best DEX'],
    };
  }

  // Price/Oracle services
  if (url.includes('price') || url.includes('oracle') || name.includes('price') || name.includes('oracle')) {
    return {
      description: 'Returns real-time price data or oracle feeds. No input required.',
      acceptsInput: false,
    };
  }

  // Pool/DeFi data
  if (url.includes('pool') || url.includes('tvl') || url.includes('apr')) {
    return {
      description: 'Returns DeFi pool metrics including TVL, APR, and liquidity data. No input required.',
      acceptsInput: false,
    };
  }

  // Trading signals
  if (url.includes('signal') || url.includes('indicator') || name.includes('signal')) {
    return {
      description: 'Returns trading signals and technical indicators. No input required.',
      acceptsInput: false,
    };
  }

  // Weather (demo)
  if (url.includes('weather')) {
    return {
      description: 'Demo weather service. Returns weather data. No input required.',
      acceptsInput: false,
    };
  }

  // Protected/Demo endpoints
  if (url.includes('protected') || url.includes('demo')) {
    return {
      description: 'Demo x402 service for testing payments. No input required.',
      acceptsInput: false,
    };
  }

  // Default - assume no input required
  return {
    description: 'x402 paid API service. Run to fetch data.',
    acceptsInput: false,
  };
}

export function AgentExecutionPanel({ agent, onExecutionComplete, onAgentUpdate }: AgentExecutionPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [schedule, setSchedule] = useState<ScheduleConfig>(
    agent.schedule || { enabled: false, intervalMinutes: 15 }
  );
  const [nextRunTime, setNextRunTime] = useState<number | null>(null);
  const [serviceInput, setServiceInput] = useState('');
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [showComplianceDetails, setShowComplianceDetails] = useState(false);
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
      // Get treasury for shared payments
      const treasury = getTreasury();

      // Gather spending model inputs from localStorage
      const serviceUrl = agent.connectedServiceUrl || '';
      const reputation = getServiceReputation(serviceUrl);
      const spentToday = getSpentToday();
      const purchasesInCategory = getRecentPurchasesInCategory(agent.connectedServiceCategory || 'unknown');
      const timeSinceLastPurchase = getTimeSinceLastPurchase();

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          agentName: agent.name,
          serviceUrl: agent.connectedServiceUrl,
          serviceName: agent.connectedService,
          serviceCategory: agent.connectedServiceCategory,
          servicePrice: agent.connectedServicePrice,
          servicePayTo: agent.connectedServicePayTo,
          walletAddress: agent.walletAddress,
          walletPrivateKey: agent.walletPrivateKey,
          // Shared treasury (preferred for payments)
          treasuryAddress: treasury?.address,
          treasuryPrivateKey: treasury?.privateKey,
          // ML Agent fields
          zkmlEnabled: agent.features?.zkmlEnabled,
          modelName: agent.modelName,
          // Service input (for chat, search, etc.)
          serviceInput: serviceInput.trim() || undefined,
          // Spending model inputs
          serviceSuccessRate: reputation.successRate,
          serviceTotalCalls: reputation.totalCalls,
          spentTodayUsdc: spentToday,
          purchasesInCategory,
          timeSinceLastPurchase,
        }),
      });

      const result: ExecutionResult = await response.json();
      setLastResult(result);

      // Record spending result for reputation tracking
      if (result.payment && agent.connectedServiceUrl) {
        const priceUsdc = parseFloat(result.payment.amountFormatted.replace(' USDC', ''));
        recordSpending(
          agent.connectedServiceUrl,
          agent.connectedServiceCategory || 'unknown',
          priceUsdc,
          result.success
        );
      }

      // Update lastExecution in storage
      const lastExecution: LastExecution = {
        timestamp: Date.now(),
        success: result.success,
        outputPreview: result.data ? JSON.stringify(result.data).slice(0, 200) : undefined,
        error: result.error,
        proofHash: result.proof?.proofHash,
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
  }, [agent, onExecutionComplete, onAgentUpdate, serviceInput]);

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
  const serviceInfo = getServiceInfo(agent.connectedServiceUrl, agent.connectedService || undefined);

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

      {/* Service description */}
      {hasServiceUrl && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {serviceInfo.description}
          </p>
        </div>
      )}

      {/* Service input field - only show if service accepts input */}
      {hasServiceUrl && serviceInfo.acceptsInput && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {serviceInfo.inputLabel || 'Input'}
          </label>
          <input
            type="text"
            value={serviceInput}
            onChange={(e) => setServiceInput(e.target.value)}
            placeholder={serviceInfo.inputPlaceholder || 'Enter input...'}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-arc-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isRunning && hasServiceUrl) {
                executeAgent();
              }
            }}
          />
          {serviceInfo.inputExamples && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="text-xs text-gray-400">Try:</span>
              {serviceInfo.inputExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => setServiceInput(example)}
                  className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
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

      {/* Spending Decision (BEFORE payment) */}
      {lastResult?.spendingDecision && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Spending Decision
          </div>
          <div className={`rounded-lg p-3 space-y-2 ${
            lastResult.spendingDecision.shouldBuy
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Decision</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                lastResult.spendingDecision.shouldBuy
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {lastResult.spendingDecision.shouldBuy ? 'APPROVED' : 'REJECTED'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Confidence</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {(lastResult.spendingDecision.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Risk Score</span>
              <span className={`text-sm font-mono ${
                lastResult.spendingDecision.riskScore > 0.5
                  ? 'text-red-600 dark:text-red-400'
                  : lastResult.spendingDecision.riskScore > 0.3
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {(lastResult.spendingDecision.riskScore * 100).toFixed(0)}%
              </span>
            </div>
            {/* Input summary */}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Price</span>
                <span className="text-gray-600 dark:text-gray-300">${lastResult.spendingDecision.input.priceUsdc.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Budget</span>
                <span className="text-gray-600 dark:text-gray-300">${lastResult.spendingDecision.input.budgetUsdc.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Reputation</span>
                <span className="text-gray-600 dark:text-gray-300">{(lastResult.spendingDecision.input.serviceSuccessRate * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Daily Spent</span>
                <span className="text-gray-600 dark:text-gray-300">${lastResult.spendingDecision.input.spentTodayUsdc.toFixed(4)} / ${lastResult.spendingDecision.input.dailyLimitUsdc.toFixed(2)}</span>
              </div>
            </div>
            {/* Reasons */}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Reasoning:</div>
              <ul className="space-y-0.5">
                {lastResult.spendingDecision.reasons.slice(0, 3).map((reason, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                    {lastResult.spendingDecision?.shouldBuy ? (
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ML Agent: Model Inference Results (AFTER payment) */}
      {lastResult?.modelInference && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            Content Model (on service data)
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
              <span className="text-xs text-gray-500 dark:text-gray-400">Confidence</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {(lastResult.modelInference.confidence * 100).toFixed(1)}%
              </span>
            </div>
            {lastResult.modelInference.category && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Category</span>
                <span className="text-sm font-medium px-2 py-0.5 rounded bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-400 capitalize">
                  {lastResult.modelInference.category}
                </span>
              </div>
            )}
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
              <span className="text-xs text-gray-500 dark:text-gray-400">Proof Hash</span>
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                {lastResult.proof.proofHash.slice(0, 18)}...
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
            {/* On-chain attestation */}
            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">On-Chain</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  lastResult.proof.submittedToChain
                    ? 'bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {lastResult.proof.submittedToChain ? 'ATTESTED' : 'NOT SUBMITTED'}
                </span>
              </div>
              {lastResult.proof.chainTxHash && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Arc TX</span>
                  <a
                    href={`https://testnet.arcscan.app/tx/${lastResult.proof.chainTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-arc-600 dark:text-arc-400 hover:underline flex items-center gap-1"
                  >
                    {lastResult.proof.chainTxHash.slice(0, 10)}...{lastResult.proof.chainTxHash.slice(-6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment info */}
      {lastResult?.success && lastResult.payment && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {lastResult.payment && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div className="flex items-center gap-2">
                <span>Paid: {lastResult.payment.amountFormatted} USDC</span>
                {lastResult.payment.txHash && lastResult.payment.txHash !== 'x402-authorization-signed' && (
                  <a
                    href={`https://basescan.org/tx/${lastResult.payment.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-arc-600 dark:text-arc-400 hover:underline flex items-center gap-1"
                  >
                    View TX
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {lastResult.payment.complianceChecked && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowComplianceDetails(!showComplianceDetails)}
                    className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    <FileCheck className="w-3 h-3" />
                    <span>Compliance check passed</span>
                    {showComplianceDetails ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  {showComplianceDetails && lastResult.payment.compliance && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-xs">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Buyer (Sender)</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {lastResult.payment.compliance.sender.slice(0, 10)}...{lastResult.payment.compliance.sender.slice(-6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Seller (Recipient)</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {lastResult.payment.compliance.recipient.slice(0, 10)}...{lastResult.payment.compliance.recipient.slice(-6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Amount</span>
                          <span className="text-gray-700 dark:text-gray-300">{lastResult.payment.compliance.amount} USDC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Status</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {lastResult.payment.compliance.approved ? 'APPROVED' : 'REJECTED'}
                          </span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-700">
                          <p className="text-gray-500 dark:text-gray-400 mb-1">Checks performed:</p>
                          <ul className="space-y-0.5">
                            {lastResult.payment.compliance.checks.map((check, i) => (
                              <li key={i} className="flex items-center gap-1 text-green-700 dark:text-green-300">
                                <CheckCircle className="w-3 h-3" />
                                {check}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-[10px]">
                          Checked at {new Date(lastResult.payment.compliance.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
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
