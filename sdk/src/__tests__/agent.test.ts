/**
 * @fileoverview Tests for ArcAgentClient
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArcAgentClient } from '../core/agent';
import { KycStatus } from '../types';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    parseUnits: vi.fn((value: string, decimals: number) => BigInt(parseFloat(value) * 10 ** decimals)),
    formatUnits: vi.fn((value: bigint, decimals: number) => (Number(value) / 10 ** decimals).toString()),
  };
});

describe('ArcAgentClient', () => {
  let mockPublicClient: any;
  let mockWalletClient: any;
  let client: ArcAgentClient;

  const mockNetworkConfig = {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpcUrl: 'https://rpc.testnet.arc.network',
    contracts: {
      arcAgent: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      arcIdentity: '0x2345678901234567890123456789012345678901' as `0x${string}`,
      arcReputation: '0x3456789012345678901234567890123456789012' as `0x${string}`,
      arcProofAttestation: '0x4567890123456789012345678901234567890123' as `0x${string}`,
      arcTreasury: '0x5678901234567890123456789012345678901234' as `0x${string}`,
      arcComplianceOracle: '0x6789012345678901234567890123456789012345' as `0x${string}`,
      usdc: '0x7890123456789012345678901234567890123456' as `0x${string}`,
    },
  };

  beforeEach(() => {
    mockPublicClient = {
      readContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    };

    mockWalletClient = {
      account: {
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      },
      writeContract: vi.fn(),
    };

    client = new ArcAgentClient({
      network: mockNetworkConfig,
      wallet: mockWalletClient,
      publicClient: mockPublicClient,
    });
  });

  describe('createAgent', () => {
    it('should create an agent with valid config', async () => {
      mockWalletClient.writeContract.mockResolvedValue('0xtxhash');
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        logs: [{ topics: ['0x', '0x1'] }],
      });
      mockPublicClient.readContract.mockResolvedValue('eip155:5042002:0x1234:1');

      const agent = await client.createAgent({
        name: 'test-agent',
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      });

      expect(agent.name).toBe('test-agent');
      expect(agent.kycStatus).toBe(KycStatus.None);
      expect(mockWalletClient.writeContract).toHaveBeenCalled();
    });

    it('should throw if wallet has no account', async () => {
      const clientNoAccount = new ArcAgentClient({
        network: mockNetworkConfig,
        wallet: { account: null } as any,
        publicClient: mockPublicClient,
      });

      await expect(clientNoAccount.createAgent({ name: 'test' }))
        .rejects.toThrow('Wallet has no account');
    });
  });

  describe('getAgent', () => {
    it('should return agent details', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce([
          '0xowner',
          '0xwallet',
          '0x' + '0'.repeat(64),
          '1.0.0',
          KycStatus.Approved,
          BigInt(1700000000),
        ])
        .mockResolvedValueOnce('eip155:5042002:0x1234:1');

      const agent = await client.getAgent('1');

      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('1');
      expect(agent?.kycStatus).toBe(KycStatus.Approved);
    });

    it('should return null for non-existent agent', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('Not found'));

      const agent = await client.getAgent('999');

      expect(agent).toBeNull();
    });
  });

  describe('getBalance', () => {
    it('should return formatted balance', async () => {
      mockPublicClient.readContract.mockResolvedValue(BigInt(5_000_000)); // 5 USDC

      const balance = await client.getBalance('1');

      expect(balance.agentId).toBe('1');
      expect(balance.available).toBe('5');
      expect(balance.pending).toBe('0');
      expect(balance.locked).toBe('0');
    });
  });

  describe('deposit', () => {
    it('should approve and deposit USDC', async () => {
      mockWalletClient.writeContract.mockResolvedValue('0xtxhash');
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({});

      const hash = await client.deposit('1', '10');

      expect(hash).toBe('0xtxhash');
      expect(mockWalletClient.writeContract).toHaveBeenCalledTimes(2); // approve + deposit
    });

    it('should throw if wallet has no account', async () => {
      const clientNoAccount = new ArcAgentClient({
        network: mockNetworkConfig,
        wallet: { account: null } as any,
        publicClient: mockPublicClient,
      });

      await expect(clientNoAccount.deposit('1', '10'))
        .rejects.toThrow('Wallet has no account');
    });
  });

  describe('checkEligibility', () => {
    it('should return eligibility status', async () => {
      mockPublicClient.readContract.mockResolvedValue([true, '']);

      const result = await client.checkEligibility('1');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('');
    });

    it('should return reason when not eligible', async () => {
      mockPublicClient.readContract.mockResolvedValue([false, 'KYC required']);

      const result = await client.checkEligibility('1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('KYC required');
    });
  });

  describe('createX402Client', () => {
    it('should create an X402Client instance', () => {
      const x402Client = client.createX402Client('1');

      expect(x402Client).toBeDefined();
      expect(typeof x402Client.fetch).toBe('function');
    });
  });
});
