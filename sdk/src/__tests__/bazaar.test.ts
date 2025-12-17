/**
 * @fileoverview Tests for BazaarClient
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BazaarClient } from '../discovery/bazaar';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BazaarClient', () => {
  let client: BazaarClient;

  beforeEach(() => {
    client = new BazaarClient('https://api.test.com/discovery');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listServices', () => {
    it('should list services from Bazaar API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          resources: [
            {
              url: 'https://weather.x402.org',
              name: 'Weather API',
              description: 'Real-time weather data',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x1234567890123456789012345678901234567890',
              maxAmountRequired: '10000', // 0.01 USDC
            },
            {
              url: 'https://inference.x402.org',
              name: 'LLM Inference',
              description: 'AI model inference',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x2345678901234567890123456789012345678901',
              maxAmountRequired: '50000', // 0.05 USDC
            },
          ],
        }),
      });

      const services = await client.listServices();

      expect(services).toHaveLength(2);
      expect(services[0].name).toBe('Weather API');
      expect(services[0].price).toBe('0.010000');
      expect(services[1].category).toBe('ai');
    });

    it('should filter by category', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          resources: [
            {
              url: 'https://weather.x402.org',
              name: 'Weather',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x1234',
              maxAmountRequired: '10000',
            },
            {
              url: 'https://llm.x402.org',
              name: 'AI Service',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x5678',
              maxAmountRequired: '50000',
            },
          ],
        }),
      });

      const services = await client.listServices({ category: 'ai' });

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('AI Service');
    });

    it('should filter by maxPrice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          resources: [
            {
              url: 'https://cheap.x402.org',
              name: 'Cheap Service',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x1234',
              maxAmountRequired: '5000', // 0.005 USDC
            },
            {
              url: 'https://expensive.x402.org',
              name: 'Expensive Service',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x5678',
              maxAmountRequired: '100000', // 0.1 USDC
            },
          ],
        }),
      });

      const services = await client.listServices({ maxPrice: '0.01' });

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('Cheap Service');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.listServices())
        .rejects.toThrow('Bazaar API error: 500 Internal Server Error');
    });
  });

  describe('searchServices', () => {
    it('should filter by search query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          resources: [
            {
              url: 'https://weather.x402.org',
              name: 'Weather API',
              description: 'Real-time weather data',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x1234',
              maxAmountRequired: '10000',
            },
            {
              url: 'https://stocks.x402.org',
              name: 'Stock Prices',
              description: 'Real-time stock market data',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x5678',
              maxAmountRequired: '20000',
            },
          ],
        }),
      });

      const services = await client.searchServices('weather');

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('Weather API');
    });
  });

  describe('probeEndpoint', () => {
    it('should detect x402 endpoint', async () => {
      mockFetch.mockResolvedValue({
        status: 402,
        headers: new Map([
          ['payment-required', btoa(JSON.stringify({
            asset: '0xusdc',
            network: 'base',
            payTo: '0x1234',
            maxAmount: '10000',
          }))],
        ]),
      });

      const service = await client.probeEndpoint('https://api.example.com');

      expect(service).not.toBeNull();
      expect(service?.network).toBe('base');
    });

    it('should return null for non-x402 endpoint', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      const service = await client.probeEndpoint('https://free.example.com');

      expect(service).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const service = await client.probeEndpoint('https://api.example.com');

      expect(service).toBeNull();
    });
  });

  describe('getService', () => {
    it('should find service by URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          resources: [
            {
              url: 'https://weather.x402.org',
              name: 'Weather API',
              acceptedAsset: 'USDC',
              network: 'base',
              payTo: '0x1234',
              maxAmountRequired: '10000',
            },
          ],
        }),
      });

      const service = await client.getService('https://weather.x402.org');

      expect(service).not.toBeNull();
      expect(service?.name).toBe('Weather API');
    });

    it('should return null for unknown service', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const service = await client.getService('https://unknown.example.com');

      expect(service).toBeNull();
    });
  });
});
