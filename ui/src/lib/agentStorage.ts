// Local storage utilities for managing created agents

export interface ScheduleConfig {
  enabled: boolean;
  intervalMinutes: number; // 5, 15, 30, 60
}

export interface LastExecution {
  timestamp: number;
  success: boolean;
  outputPreview?: string;
  error?: string;
  proofHash?: string;
  amountPaid?: string;
}

export interface MultiChainWallets {
  evm: {
    address: string;
    privateKey: string;  // Hex encoded
  };
  solana: {
    address: string;
    privateKey: string;  // Base58 encoded
  };
}

export interface SavedAgent {
  id: string;
  name: string;
  walletAddress: string;  // Primary display address (EVM)
  walletPrivateKey?: string;  // Legacy - for backwards compatibility
  wallets?: MultiChainWallets;  // Multi-chain wallet support
  ownerAddress: string;
  fundedAmount: string;
  createdAt: number;
  connectedService?: string;
  connectedServiceUrl?: string;
  connectedServicePrice?: string;
  connectedServicePayTo?: string;
  features: {
    zkmlEnabled: boolean;
    complianceEnabled: boolean;
  };
  modelName?: string;
  threshold?: number;
  schedule?: ScheduleConfig;
  lastExecution?: LastExecution;
}

const STORAGE_KEY = 'arc-agents';

export function getSavedAgents(): SavedAgent[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Validate it's an array
    if (!Array.isArray(parsed)) {
      console.error('[AgentStorage] Invalid data format, clearing storage');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('[AgentStorage] Failed to parse agents, clearing corrupted data:', error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function saveAgent(agent: SavedAgent): void {
  if (typeof window === 'undefined') return;

  const agents = getSavedAgents();
  // Check if agent already exists
  const existingIndex = agents.findIndex(a => a.id === agent.id);
  if (existingIndex >= 0) {
    agents[existingIndex] = agent;
  } else {
    agents.unshift(agent); // Add to beginning
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function removeAgent(agentId: string): void {
  if (typeof window === 'undefined') return;

  const agents = getSavedAgents();
  const filtered = agents.filter(a => a.id !== agentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearAllAgents(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function updateAgentSchedule(agentId: string, schedule: ScheduleConfig): void {
  if (typeof window === 'undefined') return;

  const agents = getSavedAgents();
  const agent = agents.find(a => a.id === agentId);
  if (agent) {
    agent.schedule = schedule;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }
}

export function updateAgentLastExecution(agentId: string, execution: LastExecution): void {
  if (typeof window === 'undefined') return;

  const agents = getSavedAgents();
  const agent = agents.find(a => a.id === agentId);
  if (agent) {
    agent.lastExecution = execution;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }
}

export function getAgentById(agentId: string): SavedAgent | undefined {
  const agents = getSavedAgents();
  return agents.find(a => a.id === agentId);
}
