/**
 * Arc Compliance Oracle Service
 *
 * Listens for ScreeningRequested events from ArcComplianceOracle contract,
 * calls Circle Compliance Engine API, and submits results back on-chain.
 */

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

  constructor(config: OracleServiceConfig) {
    this.config = config;

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
    if (config.circleApiKey) {
      this.complianceClient = new CircleComplianceClient({
        apiKey: config.circleApiKey,
        baseUrl: config.circleBaseUrl,
      });
      console.log('[Oracle] Using real Circle Compliance Engine');
    } else {
      this.complianceClient = new MockCircleComplianceClient();
      console.log('[Oracle] Using mock Circle Compliance client (set CIRCLE_API_KEY for real screening)');
    }

    // Initialize rate limiter (30 requests per minute)
    this.rateLimiter = createScreeningRateLimiter({
      maxRequests: config.pollingInterval ? 60 : 30,
      windowMs: 60000,
    });
    console.log('[Oracle] Rate limiter initialized');
  }

  /**
   * Start the oracle service
   */
  async start(): Promise<void> {
    console.log('[Oracle] Starting Compliance Oracle Service...');
    console.log(`[Oracle] Contract: ${this.config.oracleContractAddress}`);
    console.log(`[Oracle] Oracle address: ${this.walletClient.account?.address}`);

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
    console.log('[Oracle] Watching for ScreeningRequested events...');

    // Use polling to watch for events
    const pollForEvents = async () => {
      if (!this.isRunning) return;

      try {
        // Get recent logs
        const logs = await this.publicClient.getLogs({
          address: this.config.oracleContractAddress,
          event: parseAbiItem('event ScreeningRequested(bytes32 indexed requestId, address indexed addressToScreen, uint256 indexed transferRequestId)'),
          fromBlock: 'latest',
        });

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
      const request = await this.getScreeningRequest(requestId);
      if (request.completed) {
        console.log(`[Oracle] Request ${requestId} already completed, skipping`);
        this.processedRequests.add(requestId);
        return;
      }

      // Call Circle Compliance Engine
      console.log(`[Oracle] Screening address ${addressToScreen}...`);
      const screeningResult = await this.complianceClient.screenAddress(
        addressToScreen,
        'ETH' // Default to ETH chain for now
      );

      console.log(`[Oracle] Screening result: ${screeningResult.result} (${screeningResult.riskLevel})`);
      if (screeningResult.signals.length > 0) {
        console.log('[Oracle] Risk signals:');
        for (const signal of screeningResult.signals) {
          console.log(`[Oracle]   - ${signal.category}: ${signal.riskLevel}`);
        }
      }

      // Submit result on-chain
      await this.submitScreeningResult(requestId, screeningResult);

      this.processedRequests.add(requestId);
      console.log(`[Oracle] Request ${requestId} completed successfully`);
    } catch (error) {
      console.error(`[Oracle] Error processing request ${requestId}:`, error);
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
