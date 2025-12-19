/**
 * Arc Compliance Oracle Service
 *
 * Listens for ScreeningRequested events from ArcComplianceOracle contract,
 * calls Circle Compliance Engine API, and submits results back on-chain.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  defineChain,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CircleComplianceClient,
  MockCircleComplianceClient,
  type ScreeningResponse,
} from './circle-compliance.js';
import { createScreeningRateLimiter, type RateLimiter } from './rate-limiter.js';

/**
 * Checkpoint data for persisting block progress
 */
interface CheckpointData {
  lastProcessedBlock: string;
  timestamp: number;
}

/**
 * Default checkpoint file path
 */
const DEFAULT_CHECKPOINT_PATH = './oracle-checkpoint.json';

// ArcComplianceOracle ABI (relevant events and functions)
const ORACLE_ABI = [
  // Events
  parseAbiItem('event ScreeningRequested(bytes32 indexed requestId, address indexed addressToScreen, uint256 indexed transferRequestId)'),
  parseAbiItem('event ScreeningCompleted(bytes32 indexed requestId, address indexed addressToScreen, uint8 status)'),

  // Functions
  parseAbiItem('function submitScreeningResultDirect(bytes32 requestId, uint8 status, string riskLevel) external'),
  parseAbiItem('function getScreeningRequest(bytes32 requestId) external view returns ((bytes32 requestId, address addressToScreen, uint256 transferRequestId, uint256 createdAt, bool completed))'),
  parseAbiItem('function isAuthorizedOracle(address oracle) external view returns (bool)'),
] as const;

export interface OracleServiceConfig {
  /** Arc network RPC URL */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Oracle private key (must be authorized on ArcComplianceOracle) */
  oraclePrivateKey: Hash;
  /** ArcComplianceOracle contract address */
  oracleContractAddress: Address;
  /** Circle API key (if not provided, uses mock client) */
  circleApiKey?: string;
  /** Circle API base URL */
  circleBaseUrl?: string;
  /** Polling interval in ms (default: 5000) */
  pollingInterval?: number;
  /** Path to checkpoint file for block persistence (default: ./oracle-checkpoint.json) */
  checkpointPath?: string;
  /** Max retries for failed operations (default: 3) */
  maxRetries?: number;
}

interface ScreeningRequest {
  requestId: Hash;
  addressToScreen: Address;
  transferRequestId: bigint;
  createdAt: bigint;
  completed: boolean;
}

/**
 * Oracle service that bridges Circle Compliance to on-chain
 */
export class ComplianceOracleService {
  private config: OracleServiceConfig;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private chain: Chain;
  private complianceClient: CircleComplianceClient;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private processedRequests = new Set<string>();
  private lastProcessedBlock: bigint = 0n;
  private checkpointPath: string;
  private maxRetries: number;
  private isMockMode: boolean;

  constructor(config: OracleServiceConfig) {
    this.config = config;
    this.checkpointPath = config.checkpointPath ?? DEFAULT_CHECKPOINT_PATH;
    this.maxRetries = config.maxRetries ?? 3;

    // Define the Arc chain
    this.chain = defineChain({
      id: config.chainId,
      name: config.chainId === 5042002 ? 'Arc Testnet' : 'Arc Mainnet',
      nativeCurrency: {
        decimals: 18,
        name: 'Arc',
        symbol: 'ARC',
      },
      rpcUrls: {
        default: { http: [config.rpcUrl] },
      },
      blockExplorers: {
        default: {
          name: 'ArcScan',
          url: config.chainId === 5042002 ? 'https://testnet.arcscan.app' : 'https://arcscan.app',
        },
      },
    });

    // Create viem clients
    const account = privateKeyToAccount(config.oraclePrivateKey);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    // Create compliance client (real or mock)
    this.isMockMode = !config.circleApiKey;
    if (config.circleApiKey) {
      this.complianceClient = new CircleComplianceClient({
        apiKey: config.circleApiKey,
        baseUrl: config.circleBaseUrl,
      });
      console.log('[Oracle] Using real Circle Compliance Engine');
    } else {
      this.complianceClient = new MockCircleComplianceClient();
      console.warn('[Oracle] ⚠️  RUNNING IN MOCK MODE - NOT SCREENING AGAINST CIRCLE');
      console.warn('[Oracle] Set CIRCLE_API_KEY environment variable for real compliance screening');
    }

    // Initialize rate limiter (30 requests per minute)
    this.rateLimiter = createScreeningRateLimiter({
      maxRequests: config.pollingInterval ? 60 : 30,
      windowMs: 60000,
    });
    console.log('[Oracle] Rate limiter initialized');
  }

  /**
   * Load checkpoint from disk
   */
  private async loadCheckpoint(): Promise<void> {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        const data = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf-8')) as CheckpointData;
        this.lastProcessedBlock = BigInt(data.lastProcessedBlock);
        console.log(`[Oracle] Loaded checkpoint: block ${this.lastProcessedBlock}`);
      } else {
        // Start from current block if no checkpoint
        this.lastProcessedBlock = await this.publicClient.getBlockNumber();
        console.log(`[Oracle] No checkpoint found, starting from block ${this.lastProcessedBlock}`);
      }
    } catch (error) {
      console.warn('[Oracle] Error loading checkpoint, starting from latest block:', error);
      this.lastProcessedBlock = await this.publicClient.getBlockNumber();
    }
  }

  /**
   * Save checkpoint to disk
   */
  private saveCheckpoint(): void {
    try {
      const data: CheckpointData = {
        lastProcessedBlock: this.lastProcessedBlock.toString(),
        timestamp: Date.now(),
      };
      fs.writeFileSync(this.checkpointPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Oracle] Error saving checkpoint:', error);
    }
  }

  /**
   * Execute a function with exponential backoff retry
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    description: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
          console.warn(`[Oracle] ${description} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if running in mock mode
   */
  public isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Start the oracle service
   */
  async start(): Promise<void> {
    console.log('[Oracle] Starting Compliance Oracle Service...');
    console.log(`[Oracle] Contract: ${this.config.oracleContractAddress}`);
    console.log(`[Oracle] Oracle address: ${this.walletClient.account?.address}`);
    console.log(`[Oracle] Checkpoint file: ${this.checkpointPath}`);
    console.log(`[Oracle] Mode: ${this.isMockMode ? 'MOCK (not screening against Circle)' : 'PRODUCTION'}`);

    // Load checkpoint for block persistence
    await this.loadCheckpoint();

    // Verify oracle is authorized
    const isAuthorized = await this.isOracleAuthorized();
    if (!isAuthorized) {
      throw new Error(
        `Oracle address ${this.walletClient.account?.address} is not authorized on the contract. ` +
        `Call authorizeOracle() on the contract first.`
      );
    }
    console.log('[Oracle] Oracle authorization verified');

    this.isRunning = true;

    // Watch for new screening requests
    this.watchScreeningRequests();

    console.log('[Oracle] Service started successfully');
  }

  /**
   * Stop the oracle service
   */
  stop(): void {
    console.log('[Oracle] Stopping service...');
    this.isRunning = false;
    this.saveCheckpoint();
    console.log(`[Oracle] Checkpoint saved at block ${this.lastProcessedBlock}`);
  }

  /**
   * Check if this oracle is authorized on the contract
   */
  private async isOracleAuthorized(): Promise<boolean> {
    const address = this.walletClient.account?.address;
    if (!address) return false;

    try {
      const isAuthorized = await this.publicClient.readContract({
        address: this.config.oracleContractAddress,
        abi: ORACLE_ABI,
        functionName: 'isAuthorizedOracle',
        args: [address],
      });
      return isAuthorized as boolean;
    } catch (error) {
      console.error('[Oracle] Error checking authorization:', error);
      return false;
    }
  }

  /**
   * Watch for ScreeningRequested events
   */
  private watchScreeningRequests(): void {
    console.log(`[Oracle] Watching for ScreeningRequested events from block ${this.lastProcessedBlock}...`);

    // Use polling to watch for events
    const pollForEvents = async () => {
      if (!this.isRunning) return;

      try {
        // Get current block
        const currentBlock = await this.publicClient.getBlockNumber();

        // Skip if no new blocks
        if (currentBlock <= this.lastProcessedBlock) {
          setTimeout(pollForEvents, this.config.pollingInterval || 5000);
          return;
        }

        // Get logs from last processed block to current
        const logs = await this.withRetry(
          () => this.publicClient.getLogs({
            address: this.config.oracleContractAddress,
            event: parseAbiItem('event ScreeningRequested(bytes32 indexed requestId, address indexed addressToScreen, uint256 indexed transferRequestId)'),
            fromBlock: this.lastProcessedBlock + 1n,
            toBlock: currentBlock,
          }),
          'Fetching screening events'
        );

        if (logs.length > 0) {
          console.log(`[Oracle] Found ${logs.length} event(s) in blocks ${this.lastProcessedBlock + 1n} to ${currentBlock}`);
        }

        for (const log of logs) {
          const requestId = log.args.requestId as Hash;

          // Skip if already processed
          if (this.processedRequests.has(requestId)) continue;

          console.log(`[Oracle] New screening request: ${requestId}`);
          console.log(`[Oracle]   Address: ${log.args.addressToScreen}`);
          console.log(`[Oracle]   Transfer ID: ${log.args.transferRequestId}`);

          // Process the request
          await this.processScreeningRequest(
            requestId,
            log.args.addressToScreen as Address,
            log.args.transferRequestId as bigint
          );
        }

        // Update checkpoint
        this.lastProcessedBlock = currentBlock;
        this.saveCheckpoint();

      } catch (error) {
        console.error('[Oracle] Error polling for events:', error);
      }

      // Continue polling
      setTimeout(pollForEvents, this.config.pollingInterval || 5000);
    };

    pollForEvents();
  }

  /**
   * Process a screening request
   */
  private async processScreeningRequest(
    requestId: Hash,
    addressToScreen: Address,
    transferRequestId: bigint
  ): Promise<void> {
    try {
      // Rate limit check
      const rateLimitKey = `screening:${addressToScreen}`;
      if (!this.rateLimiter.tryConsume(rateLimitKey)) {
        const resetTime = this.rateLimiter.getResetTime(rateLimitKey);
        console.log(`[Oracle] Rate limited for ${addressToScreen}, retry in ${resetTime}ms`);
        // Re-queue for later processing
        setTimeout(() => {
          this.processScreeningRequest(requestId, addressToScreen, transferRequestId);
        }, resetTime + 1000);
        return;
      }

      // Check if already completed on-chain
      const request = await this.withRetry(
        () => this.getScreeningRequest(requestId),
        `Fetching request ${requestId.slice(0, 10)}...`
      );
      if (request.completed) {
        console.log(`[Oracle] Request ${requestId} already completed, skipping`);
        this.processedRequests.add(requestId);
        return;
      }

      // Call Circle Compliance Engine (with retry)
      console.log(`[Oracle] Screening address ${addressToScreen}...`);
      const screeningResult = await this.withRetry(
        () => this.complianceClient.screenAddress(addressToScreen, 'ETH'),
        `Screening ${addressToScreen.slice(0, 10)}...`
      );

      console.log(`[Oracle] Screening result: ${screeningResult.result} (${screeningResult.riskLevel})`);
      if (screeningResult.signals.length > 0) {
        console.log('[Oracle] Risk signals:');
        for (const signal of screeningResult.signals) {
          console.log(`[Oracle]   - ${signal.category}: ${signal.riskLevel}`);
        }
      }

      // Submit result on-chain (with retry)
      await this.withRetry(
        () => this.submitScreeningResult(requestId, screeningResult),
        `Submitting result for ${requestId.slice(0, 10)}...`
      );

      this.processedRequests.add(requestId);
      console.log(`[Oracle] Request ${requestId} completed successfully`);
    } catch (error) {
      console.error(`[Oracle] Error processing request ${requestId}:`, error);
      // Don't mark as processed so it can be retried on next run
    }
  }

  /**
   * Get screening request details from contract
   */
  private async getScreeningRequest(requestId: Hash): Promise<ScreeningRequest> {
    const result = await this.publicClient.readContract({
      address: this.config.oracleContractAddress,
      abi: ORACLE_ABI,
      functionName: 'getScreeningRequest',
      args: [requestId],
    }) as unknown as {
      requestId: Hash;
      addressToScreen: Address;
      transferRequestId: bigint;
      createdAt: bigint;
      completed: boolean;
    };

    return {
      requestId: result.requestId,
      addressToScreen: result.addressToScreen,
      transferRequestId: result.transferRequestId,
      createdAt: result.createdAt,
      completed: result.completed,
    };
  }

  /**
   * Submit screening result to the contract
   */
  private async submitScreeningResult(
    requestId: Hash,
    screeningResult: ScreeningResponse
  ): Promise<void> {
    const status = this.complianceClient.toComplianceStatus(screeningResult);
    const riskLevel = screeningResult.riskLevel.toLowerCase();

    console.log(`[Oracle] Submitting result on-chain: status=${status}, riskLevel=${riskLevel}`);

    const account = this.walletClient.account;
    if (!account) {
      throw new Error('No account configured on wallet client');
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      account,
      address: this.config.oracleContractAddress,
      abi: ORACLE_ABI,
      functionName: 'submitScreeningResultDirect',
      args: [requestId, status, riskLevel],
    });

    console.log(`[Oracle] Transaction submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`[Oracle] Transaction confirmed in block ${receipt.blockNumber}`);
  }

  /**
   * Manually trigger a screening (for testing)
   */
  async manualScreen(address: Address): Promise<ScreeningResponse> {
    console.log(`[Oracle] Manual screening for ${address}`);
    return this.complianceClient.screenAddress(address, 'ETH');
  }
}
