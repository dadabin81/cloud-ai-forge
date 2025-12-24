import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Binario, BinarioRateLimitError, BinarioPaymentError } from './client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Binario Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const client = new Binario('bsk_test_key');
      expect(client).toBeInstanceOf(Binario);
    });

    it('should create client with options object', () => {
      const client = new Binario({
        apiKey: 'bsk_test_key',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeInstanceOf(Binario);
    });

    it('should throw without API key', () => {
      expect(() => new Binario('')).toThrow('Binario API key is required');
    });
  });

  describe('chat', () => {
    it('should send chat request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: 'Hello!',
          model: 'llama-3.3-70b',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
      });

      const client = new Binario('bsk_test_key');
      const response = await client.chat('Hi there');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.content).toBe('Hello!');
    });

    it('should handle rate limit error (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const client = new Binario('bsk_test_key');
      
      await expect(client.chat('Hi')).rejects.toThrow(BinarioRateLimitError);
    });

    it('should handle payment required error (402)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({ error: 'Payment required' }),
      });

      const client = new Binario('bsk_test_key');
      
      await expect(client.chat('Hi')).rejects.toThrow(BinarioPaymentError);
    });

    it('should pass model option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: 'Response',
          model: 'gpt-4',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
      });

      const client = new Binario('bsk_test_key');
      await client.chat('Hi', { model: 'gpt-4' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('gpt-4');
    });

    it('should pass system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: 'Response',
          model: 'llama-3.3-70b',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
      });

      const client = new Binario('bsk_test_key');
      await client.chat('Hi', { systemPrompt: 'You are helpful' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toBe('You are helpful');
    });
  });

  describe('usage', () => {
    it('should fetch usage info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokensUsed: 1000,
          tokensLimit: 50000,
          requestsUsed: 50,
          requestsLimit: 1000,
          plan: 'free',
        }),
      });

      const client = new Binario('bsk_test_key');
      const usage = await client.usage();

      expect(usage.tokensUsed).toBe(1000);
      expect(usage.plan).toBe('free');
    });
  });

  describe('agent', () => {
    it('should create agent instance', () => {
      const client = new Binario('bsk_test_key');
      const agent = client.agent({
        systemPrompt: 'You are a helper',
      });

      expect(agent).toBeDefined();
      expect(typeof agent.run).toBe('function');
    });
  });
});
