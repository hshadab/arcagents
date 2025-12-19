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

export interface SavedAgent {
  id: string;
  name: string;
  walletAddress: string;  // EVM wallet address
  walletPrivateKey: string;  // EVM private key (hex encoded)
  ownerAddress: string;
  fundedAmount: string;
  createdAt: number;
  connectedService?: string;
  connectedServiceUrl?: string;
  connectedServicePrice?: string;
  connectedServicePayTo?: string;
  connectedServiceCategory?: string;  // Service category for spending tracking
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
    // Migrate legacy agents that may have multi-chain wallet structure
    return parsed.map(migrateAgent);
  } catch (error) {
    console.error('[AgentStorage] Failed to parse agents, clearing corrupted data:', error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

/**
 * Migrate legacy agent format to current format
 * Handles old multi-chain wallet structure
 */
function migrateAgent(agent: Record<string, unknown>): SavedAgent {
  let walletAddress = String(agent.walletAddress || '');
  let walletPrivateKey = String(agent.walletPrivateKey || '');

  // If agent has old 'wallets' structure, extract EVM wallet
  if (agent.wallets && typeof agent.wallets === 'object') {
    const wallets = agent.wallets as Record<string, unknown>;
    if (wallets.evm && typeof wallets.evm === 'object') {
      const evm = wallets.evm as Record<string, unknown>;
      walletAddress = String(evm.address || walletAddress);
      walletPrivateKey = String(evm.privateKey || walletPrivateKey);
    }
  }

  return {
    id: String(agent.id || ''),
    name: String(agent.name || ''),
    walletAddress,
    walletPrivateKey,
    ownerAddress: String(agent.ownerAddress || ''),
    fundedAmount: String(agent.fundedAmount || '0'),
    createdAt: Number(agent.createdAt) || Date.now(),
    connectedService: agent.connectedService ? String(agent.connectedService) : undefined,
    connectedServiceUrl: agent.connectedServiceUrl ? String(agent.connectedServiceUrl) : undefined,
    connectedServicePrice: agent.connectedServicePrice ? String(agent.connectedServicePrice) : undefined,
    connectedServicePayTo: agent.connectedServicePayTo ? String(agent.connectedServicePayTo) : undefined,
    connectedServiceCategory: agent.connectedServiceCategory ? String(agent.connectedServiceCategory) : undefined,
    features: (agent.features as SavedAgent['features']) || { zkmlEnabled: false, complianceEnabled: true },
    modelName: agent.modelName ? String(agent.modelName) : undefined,
    threshold: agent.threshold ? Number(agent.threshold) : undefined,
    schedule: agent.schedule as ScheduleConfig | undefined,
    lastExecution: agent.lastExecution as LastExecution | undefined,
  };
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
