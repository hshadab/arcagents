'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { Bot, Wallet, ArrowRight, Plus, Loader2, Shield, AlertCircle, ExternalLink, FileCheck, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { ProofStatus, ProofBadge, ValidationResponse, type ProofItem } from '@/components/ProofStatus';
import { arcTestnet, CHAIN_IDS } from '@/lib/wagmi';

// Contract addresses
const CONTRACT_ADDRESSES = {
  [CHAIN_IDS.ARC_TESTNET]: {
    arcAgent: process.env.NEXT_PUBLIC_ARC_AGENT_ADDRESS as `0x${string}` | undefined,
    arcIdentity: process.env.NEXT_PUBLIC_ARC_IDENTITY_ADDRESS as `0x${string}` | undefined,
    arcTreasury: process.env.NEXT_PUBLIC_ARC_TREASURY_ADDRESS as `0x${string}` | undefined,
    arcProofAttestation: process.env.NEXT_PUBLIC_ARC_PROOF_ATTESTATION_ADDRESS as `0x${string}` | undefined,
  },
  [CHAIN_IDS.ARC_MAINNET]: {
    arcAgent: undefined,
    arcIdentity: undefined,
    arcTreasury: undefined,
    arcProofAttestation: undefined,
  },
};

// Contract ABIs for reading agent data
const ARC_IDENTITY_ABI = [
  {
    name: 'getAgentsByOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'circleWalletId', type: 'string' },
      { name: 'circleWalletAddr', type: 'address' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'proverVersion', type: 'string' },
      { name: 'kycStatus', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'getGlobalId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

const ARC_TREASURY_ABI = [
  {
    name: 'getAgentBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ARC_PROOF_ATTESTATION_ABI = [
  {
    name: 'getAgentValidProofCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getAgentValidations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
] as const;

// Agent type from contract
interface Agent {
  id: string;
  globalId: string;
  name: string;
  walletAddress?: string;
  balance: string;
  kycStatus: number;
  connectedService: string | null;
  transactions: number;
  features?: {
    zkmlEnabled: boolean;
    complianceEnabled: boolean;
  };
  compliance?: {
    status: 'PENDING' | 'APPROVED' | 'DENIED' | 'REVIEW_REQUIRED';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
    lastChecked: number;
  };
  proofs: {
    valid: number;
    total: number;
    items: ProofItem[];
  };
}

const kycStatusLabels: Record<number, { label: string; color: string }> = {
  0: { label: 'None', color: 'text-gray-500' },
  1: { label: 'Pending', color: 'text-yellow-500' },
  2: { label: 'Approved', color: 'text-green-500' },
  3: { label: 'Rejected', color: 'text-red-500' },
};

// Demo agents for showcase (when contracts not deployed)
const demoAgents: Agent[] = [
  {
    id: 'demo-1',
    globalId: 'eip155:5042002:0x44197C5f...5D:1',
    name: 'weather-bot',
    walletAddress: '0x8a3F...7b2E',
    balance: '4.50',
    kycStatus: 2,
    connectedService: 'Weather Oracle',
    transactions: 1250,
    features: {
      zkmlEnabled: true,
      complianceEnabled: true,
    },
    compliance: {
      status: 'APPROVED',
      riskLevel: 'LOW',
      lastChecked: Date.now() - 3600000,
    },
    proofs: {
      valid: 12,
      total: 15,
      items: [
        {
          requestHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tag: 'authorization' as const,
          response: ValidationResponse.Valid,
          isValidated: true,
          timestamp: Date.now() / 1000 - 3600,
          metadata: {
            modelHash: '0xabc123def456789abc123def456789abc123def456789abc123def456789abc1',
            inputHash: '0xdef456789abc123def456789abc123def456789abc123def456789abc123def4',
            outputHash: '0x789abc123def456789abc123def456789abc123def456789abc123def456789a',
            proofSize: 2048,
            generationTime: 5234,
            proverVersion: 'jolt-atlas-0.2.0',
          },
        },
        {
          requestHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          tag: 'compliance' as const,
          response: ValidationResponse.Valid,
          isValidated: true,
          timestamp: Date.now() / 1000 - 7200,
          metadata: {
            modelHash: '0xfed456789abc123def456789abc123def456789abc123def456789abc123fed4',
            inputHash: '0x123abc456def789abc123def456789abc123def456789abc123def456789123a',
            outputHash: '0x456def789abc123def456789abc123def456789abc123def456789abc123456d',
            proofSize: 1536,
            generationTime: 3890,
            proverVersion: 'jolt-atlas-0.2.0',
          },
        },
      ],
    },
  },
  {
    id: 'demo-2',
    globalId: 'eip155:5042002:0x44197C5f...5D:2',
    name: 'llm-inference',
    walletAddress: '0x3cD1...9aF4',
    balance: '12.75',
    kycStatus: 2,
    connectedService: 'LLM Inference API',
    transactions: 3420,
    features: {
      zkmlEnabled: true,
      complianceEnabled: false,
    },
    proofs: {
      valid: 28,
      total: 30,
      items: [
        {
          requestHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
          tag: 'authorization' as const,
          response: ValidationResponse.Valid,
          isValidated: true,
          timestamp: Date.now() / 1000 - 1800,
          metadata: {
            modelHash: '0x111222333444555666777888999aaabbbcccdddeeefffabc123def456789abc1',
            inputHash: '0x222333444555666777888999aaabbbcccdddeeefffabc123def456789abc1222',
            outputHash: '0x333444555666777888999aaabbbcccdddeeefffabc123def456789abc1333444',
            proofSize: 2560,
            generationTime: 6120,
            proverVersion: 'jolt-atlas-0.2.0',
          },
        },
      ],
    },
  },
  {
    id: 'demo-3',
    globalId: 'eip155:5042002:0x44197C5f...5D:3',
    name: 'data-oracle',
    walletAddress: '0x7eB2...4cD8',
    balance: '0.25',
    kycStatus: 1,
    connectedService: null,
    transactions: 45,
    features: {
      zkmlEnabled: false,
      complianceEnabled: true,
    },
    compliance: {
      status: 'APPROVED',
      riskLevel: 'LOW',
      lastChecked: Date.now() - 86400000,
    },
    proofs: {
      valid: 0,
      total: 0,
      items: [],
    },
  },
];

export default function AgentsPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Check if contracts are deployed
  const contracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  const contractsDeployed = contracts?.arcAgent && contracts?.arcIdentity && contracts?.arcTreasury;

  // Fetch agents from contract
  const fetchAgents = async () => {
    if (!isConnected || !address || !publicClient) return;

    // If contracts not deployed, show demo mode option
    if (!contractsDeployed) {
      setAgents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get agent IDs owned by this address
      const agentIds = await publicClient.readContract({
        address: contracts.arcIdentity!,
        abi: ARC_IDENTITY_ABI,
        functionName: 'getAgentsByOwner',
        args: [address],
      }) as bigint[];

      if (agentIds.length === 0) {
        setAgents([]);
        return;
      }

      // Fetch details for each agent
      const agentPromises = agentIds.map(async (agentId) => {
        try {
          // Get agent identity data
          const agentData = await publicClient.readContract({
            address: contracts.arcIdentity!,
            abi: ARC_IDENTITY_ABI,
            functionName: 'getAgent',
            args: [agentId],
          }) as [string, string, string, string, string, number, bigint];

          // Get global ID
          const globalId = await publicClient.readContract({
            address: contracts.arcIdentity!,
            abi: ARC_IDENTITY_ABI,
            functionName: 'getGlobalId',
            args: [agentId],
          }) as string;

          // Get balance from treasury
          let balance = '0';
          try {
            const balanceWei = await publicClient.readContract({
              address: contracts.arcTreasury!,
              abi: ARC_TREASURY_ABI,
              functionName: 'getAgentBalance',
              args: [agentId],
            }) as bigint;
            balance = (Number(balanceWei) / 1_000_000).toFixed(2); // USDC has 6 decimals
          } catch {
            // Treasury might not have balance for this agent
          }

          // Get proof count
          let validProofCount = 0;
          let totalProofCount = 0;
          try {
            if (contracts.arcProofAttestation) {
              validProofCount = Number(await publicClient.readContract({
                address: contracts.arcProofAttestation,
                abi: ARC_PROOF_ATTESTATION_ABI,
                functionName: 'getAgentValidProofCount',
                args: [agentId],
              }) as bigint);

              const proofHashes = await publicClient.readContract({
                address: contracts.arcProofAttestation,
                abi: ARC_PROOF_ATTESTATION_ABI,
                functionName: 'getAgentValidations',
                args: [agentId],
              }) as string[];
              totalProofCount = proofHashes.length;
            }
          } catch {
            // Proof attestation might not have data
          }

          const [owner, circleWalletId, circleWalletAddr, modelHash, proverVersion, kycStatus, createdAt] = agentData;

          return {
            id: agentId.toString(),
            globalId: globalId || `eip155:5042002:${contracts.arcIdentity}:${agentId}`,
            name: `Agent #${agentId}`,
            walletAddress: circleWalletAddr !== '0x0000000000000000000000000000000000000000'
              ? `${circleWalletAddr.slice(0, 6)}...${circleWalletAddr.slice(-4)}`
              : undefined,
            balance,
            kycStatus: kycStatus,
            connectedService: null,
            transactions: 0,
            features: {
              zkmlEnabled: modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
              complianceEnabled: kycStatus > 0,
            },
            proofs: {
              valid: validProofCount,
              total: totalProofCount,
              items: [],
            },
          } as Agent;
        } catch (err) {
          console.error(`Failed to fetch agent ${agentId}:`, err);
          return null;
        }
      });

      const fetchedAgents = (await Promise.all(agentPromises)).filter((a): a is Agent => a !== null);
      setAgents(fetchedAgents);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError('Failed to fetch agents from contract');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && !demoMode) {
      fetchAgents();
    } else if (demoMode) {
      setAgents(demoAgents);
    }
  }, [isConnected, address, chainId, demoMode]);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Bot className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Connect your wallet to view and manage your Arc Agents.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Connect with Coinbase Wallet to get started
        </p>
      </div>
    );
  }

  // Wrong network state
  if (chainId !== CHAIN_IDS.ARC_TESTNET && chainId !== CHAIN_IDS.ARC_MAINNET) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Switch to Arc Network
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Please switch to Arc Testnet or Arc Mainnet to use Arc Agents.
        </p>
        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
          <p>Arc Testnet Chain ID: {CHAIN_IDS.ARC_TESTNET}</p>
          <p>RPC: {arcTestnet.rpcUrls.default.http[0]}</p>
        </div>
      </div>
    );
  }

  // Contracts not deployed state
  if (!contractsDeployed && !demoMode) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Contracts Not Deployed
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Arc Agents contracts need to be deployed to Arc Testnet before you can create agents.
        </p>
        <div className="space-y-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <p>Deploy contracts using:</p>
            <code className="block mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs">
              cd contracts && npx hardhat run scripts/deploy.js --network arc-testnet
            </code>
          </div>
          <div className="flex justify-center gap-4">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-arc-600 dark:text-arc-400 hover:underline"
            >
              Get testnet USDC
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setDemoMode(true)}
              className="px-4 py-2 text-sm bg-arc-500 hover:bg-arc-600 text-white rounded-lg transition-colors"
            >
              View Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            My Agents
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your Arc Agents and their treasuries
            {demoMode && <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm rounded-full">Demo Mode</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {demoMode && (
            <button
              onClick={() => {
                setDemoMode(false);
                setAgents([]);
              }}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:underline"
            >
              Exit Demo
            </button>
          )}
          <Link
            href="/spawn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            Launch Agent
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-arc-500" />
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchAgents}
            className="mt-4 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try Again
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Bot className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Agents Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Launch your first agent to start making x402 payments.
          </p>
          <Link
            href="/spawn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-arc-500 to-arc-600 hover:from-arc-600 hover:to-arc-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            Launch Agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-arc-400 to-arc-600 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {agent.name}
                      </h3>
                      {/* Feature badges */}
                      {agent.features?.zkmlEnabled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-arc-100 dark:bg-arc-900/30 text-arc-700 dark:text-arc-300 text-xs rounded-full font-medium">
                          <Shield className="w-3 h-3" />
                          zkML
                        </span>
                      )}
                      {agent.features?.complianceEnabled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                          <FileCheck className="w-3 h-3" />
                          Compliant
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {agent.globalId}
                    </p>
                    {agent.walletAddress && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                        <Wallet className="w-3 h-3" />
                        {agent.walletAddress}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${agent.balance}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    USDC Balance
                  </p>
                  {agent.compliance && (
                    <div className="mt-1 flex items-center justify-end gap-1">
                      {agent.compliance.status === 'APPROVED' ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : agent.compliance.status === 'PENDING' ? (
                        <Clock className="w-3 h-3 text-yellow-500" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-xs text-slate-500">
                        {agent.compliance.riskLevel} risk
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    KYC Status
                  </p>
                  <p className={`font-medium ${kycStatusLabels[agent.kycStatus].color}`}>
                    {kycStatusLabels[agent.kycStatus].label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Connected Service
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {agent.connectedService || 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Transactions
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {agent.transactions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    zkML Proofs
                  </p>
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4 text-arc-500" />
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {agent.proofs.valid}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      /{agent.proofs.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* zkML Proof Status */}
              <div className="mt-6">
                <ProofStatus
                  agentId={agent.id}
                  proofs={agent.proofs.items}
                  validProofCount={agent.proofs.valid}
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button className="flex-1 px-4 py-2 text-sm font-medium text-arc-600 dark:text-arc-400 bg-arc-50 dark:bg-arc-900/20 hover:bg-arc-100 dark:hover:bg-arc-900/30 rounded-lg transition-colors">
                  <Wallet className="w-4 h-4 inline-block mr-2" />
                  Fund
                </button>
                <button className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <ArrowRight className="w-4 h-4 inline-block mr-2" />
                  Make Request
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
