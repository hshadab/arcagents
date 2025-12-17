/**
 * @fileoverview Tests for X402Client
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { X402Client, createPaymentFetch } from '../x402/client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('X402Client', () => {
  let client: X402Client;
  let mockWalletClient: any;
  let mockPublicClient: any;

  beforeEach(() => {
    mockWalletClient = {
      account: {
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      },
      signTypedData: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockPublicClient = {
      getChainId: vi.fn().mockResolvedValue(5042002),
    };

    client = new X402Client({
      wallet: mockWalletClient,
      publicClient: mockPublicClient,
      treasury: '0x1234567890123456789012345678901234567890',
      agentId: 'agent-1',
    });

    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetch', () => {
    it('should pass through non-402 responses', async () => {
      const mockResponse = {
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.fetch('https://api.example.com/data');

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 402 responses with automatic payment', async () => {
      // First call returns 402
      const paymentRequired = btoa(JSON.stringify({
        scheme: 'exact',
        network: 'base',
        asset: '0xusdc',
        payTo: '0xpayee',
        maxAmount: '10000',
        resource: 'https://api.example.com/data',
      }));

      mockFetch
        .mockResolvedValueOnce({
          status: 402,
          headers: new Headers({
            'payment-required': paymentRequired,
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        });

      const response = await client.fetch('https://api.example.com/data');

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockWalletClient.signTypedData).toHaveBeenCalled();
    });

    it('should throw if 402 response has no payment requirements', async () => {
      mockFetch.mockResolvedValue({
        status: 402,
        headers: new Headers(),
      });

      await expect(client.fetch('https://api.example.com/data'))
        .rejects.toThrow('Received 402 but no payment requirements found');
    });

    it('should throw if wallet has no account', async () => {
      const clientNoAccount = new X402Client({
        wallet: { account: null } as any,
        publicClient: mockPublicClient,
      });

      const paymentRequired = btoa(JSON.stringify({
        scheme: 'exact',
        network: 'base',
        asset: '0xusdc',
        payTo: '0xpayee',
        maxAmount: '10000',
      }));

      mockFetch.mockResolvedValue({
        status: 402,
        headers: new Headers({
          'payment-required': paymentRequired,
        }),
      });

      await expect(clientNoAccount.fetch('https://api.example.com'))
        .rejects.toThrow('Wallet has no account');
    });
  });

  describe('callService', () => {
    it('should call service and return data with payment info', async () => {
      const paymentResponse = btoa(JSON.stringify({
        txHash: '0xtxhash',
        network: 'base',
        amount: '10000',
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ weather: 'sunny' }),
        headers: new Headers({
          'payment-response': paymentResponse,
        }),
      });

      const result = await client.callService(
        {
          url: 'https://weather.x402.org',
          name: 'Weather',
          price: '0.01',
          priceAtomic: '10000',
          asset: 'USDC',
          network: 'base',
          payTo: '0x1234' as `0x${string}`,
        },
        '/forecast'
      );

      expect(result.data).toEqual({ weather: 'sunny' });
      expect(result.payment.success).toBe(true);
      expect(result.payment.transactionHash).toBe('0xtxhash');
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.callService({
        url: 'https://api.example.com',
        name: 'Test',
        price: '0.01',
        priceAtomic: '10000',
        asset: 'USDC',
        network: 'base',
        payTo: '0x1234' as `0x${string}`,
      })).rejects.toThrow('Service request failed: 500 Internal Server Error');
    });
  });

  describe('checkPaymentRequired', () => {
    it('should detect payment requirements', async () => {
      const paymentRequired = btoa(JSON.stringify({
        scheme: 'exact',
        network: 'base',
        asset: '0xusdc',
        payTo: '0xpayee',
        maxAmount: '10000',
      }));

      mockFetch.mockResolvedValue({
        status: 402,
        headers: new Headers({
          'payment-required': paymentRequired,
        }),
      });

      const requirement = await client.checkPaymentRequired('https://api.example.com');

      expect(requirement).not.toBeNull();
      expect(requirement?.scheme).toBe('exact');
      expect(requirement?.maxAmount).toBe('10000');
    });

    it('should return null for non-402 responses', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Headers(),
      });

      const requirement = await client.checkPaymentRequired('https://free.example.com');

      expect(requirement).toBeNull();
    });
  });
});

describe('createPaymentFetch', () => {
  it('should create a fetch function that handles payments', async () => {
    const mockWalletClient = {
      account: { address: '0xtest' },
      signTypedData: vi.fn().mockResolvedValue('0xsig'),
    };

    const mockPublicClient = {
      getChainId: vi.fn().mockResolvedValue(5042002),
    };

    const paymentFetch = createPaymentFetch({
      wallet: mockWalletClient as any,
      publicClient: mockPublicClient as any,
    });

    mockFetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const response = await paymentFetch('https://api.example.com');

    expect(response.status).toBe(200);
    expect(typeof paymentFetch).toBe('function');
  });
});
