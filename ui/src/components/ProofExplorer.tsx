'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import {
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { CHAIN_IDS } from '@/lib/wagmi';

// ArcProofAttestation ABI (read functions only)
const PROOF_ATTESTATION_ABI = [
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentValidations',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    name: 'getFullValidation',
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'validatorAddress', type: 'address' },
          { name: 'agentId', type: 'uint256' },
          { name: 'requestUri', type: 'string' },
          { name: 'requestHash', type: 'bytes32' },
          { name: 'response', type: 'uint8' },
          { name: 'responseUri', type: 'string' },
          { name: 'responseHash', type: 'bytes32' },
          { name: 'tag', type: 'bytes32' },
          { name: 'requestTimestamp', type: 'uint256' },
          { name: 'responseTimestamp', type: 'uint256' },
          { name: 'hasResponse', type: 'bool' },
        ],
      },
      {
        name: 'metadata',
        type: 'tuple',
        components: [
          { name: 'modelHash', type: 'bytes32' },
          { name: 'inputHash', type: 'bytes32' },
          { name: 'outputHash', type: 'bytes32' },
          { name: 'proofSize', type: 'uint256' },
          { name: 'generationTime', type: 'uint256' },
          { name: 'proverVersion', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentValidProofCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Contract addresses
const PROOF_ATTESTATION_ADDRESS = process.env.NEXT_PUBLIC_ARC_PROOF_ATTESTATION_ADDRESS as `0x${string}` | undefined;

// Response codes
const RESPONSE_LABELS: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  0: { label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-500' },
  1: { label: 'Valid', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500' },
  2: { label: 'Invalid', icon: <XCircle className="w-4 h-4" />, color: 'text-red-500' },
  3: { label: 'Inconclusive', icon: <AlertCircle className="w-4 h-4" />, color: 'text-gray-500' },
};

interface ProofRecord {
  requestHash: string;
  validatorAddress: string;
  agentId: string;
  requestUri: string;
  response: number;
  responseUri: string;
  tag: string;
  requestTimestamp: number;
  responseTimestamp: number;
  hasResponse: boolean;
  metadata: {
    modelHash: string;
    inputHash: string;
    outputHash: string;
    proofSize: number;
    generationTime: number;
    proverVersion: string;
  };
}

interface ProofExplorerProps {
  agentId?: string;
  limit?: number;
}

function decodeTag(tagHex: string): string {
  // Common tag hashes
  const tagMap: Record<string, string> = {
    // These would be the actual keccak256 hashes of the tag strings
    // For now, try to decode from hex if possible
  };

  if (tagMap[tagHex]) return tagMap[tagHex];

  // Try to detect based on pattern
  if (tagHex.includes('auth')) return 'Authorization';
  if (tagHex.includes('comp')) return 'Compliance';

  return tagHex.slice(0, 10) + '...';
}

function ProofRow({ proof, expanded, onToggle }: { proof: ProofRecord; expanded: boolean; onToggle: () => void }) {
  const response = RESPONSE_LABELS[proof.response] || RESPONSE_LABELS[0];

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={response.color}>
            {response.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-slate-900 dark:text-white">
                {proof.requestHash.slice(0, 10)}...{proof.requestHash.slice(-6)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${response.color} bg-opacity-10`}>
                {response.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>Agent #{proof.agentId}</span>
              <span>{new Date(proof.requestTimestamp * 1000).toLocaleDateString()}</span>
              {proof.metadata.proverVersion && (
                <span className="text-arc-600 dark:text-arc-400">
                  {proof.metadata.proverVersion}
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
              <p className={`font-medium ${response.color}`}>
                {response.label}
                {proof.hasResponse && ' (Validated)'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Request Time</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {new Date(proof.requestTimestamp * 1000).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Request Hash</p>
              <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                {proof.requestHash}
              </p>
            </div>
            {proof.metadata.modelHash && proof.metadata.modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
              <>
                <div className="col-span-2">
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Model Hash</p>
                  <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                    {proof.metadata.modelHash}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Proof Size</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {proof.metadata.proofSize} bytes
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Generation Time</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {proof.metadata.generationTime}ms
                  </p>
                </div>
              </>
            )}
            {proof.requestUri && (
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Request URI</p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                  {proof.requestUri}
                </p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Validator</p>
              <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                {proof.validatorAddress}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProofExplorer({ agentId, limit = 10 }: ProofExplorerProps) {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProof, setExpandedProof] = useState<string | null>(null);
  const [searchAgentId, setSearchAgentId] = useState(agentId || '');
  const [validProofCount, setValidProofCount] = useState(0);

  const fetchProofs = async (searchId?: string) => {
    const targetAgentId = searchId || searchAgentId;
    if (!publicClient || !targetAgentId || !PROOF_ATTESTATION_ADDRESS) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get agent's validation request hashes
      const requestHashes = await publicClient.readContract({
        address: PROOF_ATTESTATION_ADDRESS,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidations',
        args: [BigInt(targetAgentId)],
      }) as `0x${string}`[];

      // Get valid proof count
      const validCount = await publicClient.readContract({
        address: PROOF_ATTESTATION_ADDRESS,
        abi: PROOF_ATTESTATION_ABI,
        functionName: 'getAgentValidProofCount',
        args: [BigInt(targetAgentId)],
      }) as bigint;

      setValidProofCount(Number(validCount));

      // Fetch details for each proof (limited)
      const limitedHashes = requestHashes.slice(0, limit);
      const proofDetails = await Promise.all(
        limitedHashes.map(async (hash) => {
          try {
            const [record, metadata] = await publicClient.readContract({
              address: PROOF_ATTESTATION_ADDRESS!,
              abi: PROOF_ATTESTATION_ABI,
              functionName: 'getFullValidation',
              args: [hash],
            }) as [any, any];

            return {
              requestHash: hash,
              validatorAddress: record.validatorAddress,
              agentId: record.agentId.toString(),
              requestUri: record.requestUri,
              response: record.response,
              responseUri: record.responseUri,
              tag: record.tag,
              requestTimestamp: Number(record.requestTimestamp),
              responseTimestamp: Number(record.responseTimestamp),
              hasResponse: record.hasResponse,
              metadata: {
                modelHash: metadata.modelHash,
                inputHash: metadata.inputHash,
                outputHash: metadata.outputHash,
                proofSize: Number(metadata.proofSize),
                generationTime: Number(metadata.generationTime),
                proverVersion: metadata.proverVersion,
              },
            };
          } catch (e) {
            console.error('Failed to fetch proof details:', e);
            return null;
          }
        })
      );

      setProofs(proofDetails.filter(Boolean) as ProofRecord[]);
    } catch (err) {
      console.error('Failed to fetch proofs:', err);
      setError('Failed to fetch proofs from contract');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      fetchProofs(agentId);
    }
  }, [agentId, publicClient]);

  const isArcNetwork = chainId === CHAIN_IDS.ARC_TESTNET || chainId === CHAIN_IDS.ARC_MAINNET;

  if (!PROOF_ATTESTATION_ADDRESS) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-yellow-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Proof attestation contract not configured
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Set NEXT_PUBLIC_ARC_PROOF_ATTESTATION_ADDRESS in environment
        </p>
      </div>
    );
  }

  if (!isArcNetwork) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-yellow-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Switch to Arc network to view on-chain proofs
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-arc-600 dark:text-arc-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">On-Chain Proofs</h3>
          </div>
          <a
            href={`https://explorer.circle.com/address/${PROOF_ATTESTATION_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-arc-600 dark:text-arc-400 hover:underline flex items-center gap-1"
          >
            View Contract
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Search */}
        {!agentId && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Enter Agent ID..."
                value={searchAgentId}
                onChange={(e) => setSearchAgentId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            <button
              onClick={() => fetchProofs()}
              disabled={loading || !searchAgentId}
              className="px-4 py-2 text-sm bg-arc-500 hover:bg-arc-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        )}

        {/* Stats */}
        {proofs.length > 0 && (
          <div className="mt-3 flex gap-4">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-arc-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{proofs.length}</span> Proofs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{validProofCount}</span> Valid
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Proof List */}
      {loading && proofs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-arc-500" />
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <XCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchProofs()}
            className="mt-2 text-sm text-arc-600 dark:text-arc-400 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : proofs.length === 0 ? (
        <div className="p-6 text-center">
          <Shield className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {searchAgentId ? 'No proofs found for this agent' : 'Enter an agent ID to search'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {proofs.map((proof) => (
            <ProofRow
              key={proof.requestHash}
              proof={proof}
              expanded={expandedProof === proof.requestHash}
              onToggle={() => setExpandedProof(expandedProof === proof.requestHash ? null : proof.requestHash)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
