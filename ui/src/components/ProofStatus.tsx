'use client';

import { useState } from 'react';
import { Shield, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

// Validation response codes (matching contract)
export const ValidationResponse = {
  Pending: 0,
  Valid: 1,
  Invalid: 2,
  Inconclusive: 3,
} as const;

export type ValidationResponseType = typeof ValidationResponse[keyof typeof ValidationResponse];

export interface ProofMetadata {
  modelHash: string;
  inputHash: string;
  outputHash: string;
  proofSize: number;
  generationTime: number;
  proverVersion: string;
}

export interface ProofItem {
  requestHash: string;
  tag: 'authorization' | 'compliance' | 'collision_severity';
  response: ValidationResponseType;
  isValidated: boolean;
  timestamp: number;
  metadata?: ProofMetadata;
}

interface ProofStatusProps {
  agentId: string;
  proofs: ProofItem[];
  validProofCount: number;
  onRefresh?: () => void;
}

const tagLabels: Record<string, string> = {
  authorization: 'Authorization',
  compliance: 'Compliance',
  collision_severity: 'Impact Assessment',
};

const tagColors: Record<string, string> = {
  authorization: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  compliance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  collision_severity: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function getStatusIcon(response: ValidationResponseType) {
  switch (response) {
    case ValidationResponse.Valid:
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case ValidationResponse.Invalid:
      return <XCircle className="w-4 h-4 text-red-500" />;
    case ValidationResponse.Pending:
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case ValidationResponse.Inconclusive:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusText(response: ValidationResponseType): string {
  switch (response) {
    case ValidationResponse.Valid:
      return 'Valid';
    case ValidationResponse.Invalid:
      return 'Invalid';
    case ValidationResponse.Pending:
      return 'Pending';
    case ValidationResponse.Inconclusive:
      return 'Inconclusive';
    default:
      return 'Unknown';
  }
}

function ProofRow({ proof, expanded, onToggle }: { proof: ProofItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {getStatusIcon(proof.response)}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColors[proof.tag]}`}>
            {tagLabels[proof.tag]}
          </span>
          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
            {proof.requestHash.slice(0, 10)}...{proof.requestHash.slice(-6)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(proof.timestamp * 1000).toLocaleDateString()}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && proof.metadata && (
        <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Status</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {getStatusText(proof.response)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Prover Version</p>
              <p className="font-medium text-gray-900 dark:text-white font-mono text-xs">
                {proof.metadata.proverVersion}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Model Hash</p>
              <p className="font-mono text-xs text-gray-600 dark:text-gray-300 break-all">
                {proof.metadata.modelHash}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Proof Size</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {proof.metadata.proofSize} bytes
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Generation Time</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {proof.metadata.generationTime}ms
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProofStatus({ agentId, proofs, validProofCount, onRefresh }: ProofStatusProps) {
  const [expandedProof, setExpandedProof] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const displayedProofs = showAll ? proofs : proofs.slice(0, 3);
  const pendingCount = proofs.filter(p => p.response === ValidationResponse.Pending).length;
  const invalidCount = proofs.filter(p => p.response === ValidationResponse.Invalid).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-arc-600 dark:text-arc-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">zkML Proofs</h3>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-sm text-arc-600 dark:text-arc-400 hover:underline"
            >
              Refresh
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{validProofCount}</span> Valid
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{pendingCount}</span> Pending
            </span>
          </div>
          {invalidCount > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{invalidCount}</span> Invalid
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Proof List */}
      {proofs.length === 0 ? (
        <div className="p-6 text-center">
          <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No proofs yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Proofs are generated automatically when the agent makes x402 requests
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {displayedProofs.map((proof) => (
              <ProofRow
                key={proof.requestHash}
                proof={proof}
                expanded={expandedProof === proof.requestHash}
                onToggle={() =>
                  setExpandedProof(
                    expandedProof === proof.requestHash ? null : proof.requestHash
                  )
                }
              />
            ))}
          </div>

          {proofs.length > 3 && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-sm text-arc-600 dark:text-arc-400 hover:underline"
              >
                {showAll ? 'Show less' : `Show all ${proofs.length} proofs`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Badge component for showing proof count in agent cards
export function ProofBadge({ validCount, totalCount }: { validCount: number; totalCount: number }) {
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs">
      <Shield className="w-3.5 h-3.5 text-arc-500" />
      <span className="text-gray-600 dark:text-gray-400">
        <span className="font-medium text-green-600 dark:text-green-400">{validCount}</span>
        <span className="text-gray-400 dark:text-gray-500">/{totalCount}</span>
      </span>
    </div>
  );
}
