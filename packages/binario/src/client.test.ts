import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Binario, BinarioRateLimitError, BinarioPaymentError, createBinarioClient } from './client';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: async () => data };
}
function errRes(status: number, body: unknown, headers?: Record<string, string>) {
  return {
    ok: false,
    status,
    headers: { get: (n: string) => headers?.[n] ?? null },
    json: async () => body,
  };
}
const chatOk = (content = 'Hello!') =>
  okJson({ content, model: 'llama-3.3-70b', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });

describe('Binario Client', () => {
  beforeEach(() => mockFetch.mockReset());

  // --- Constructor ---
  describe('constructor', () => {
    it('creates with valid key', () => expect(new Binario('bsk_test')).toBeInstanceOf(Binario));
    it('accepts options', () => expect(new Binario('bsk_k', { baseUrl: 'https://x.com', timeout: 5000 })).toBeInstanceOf(Binario));
    it('throws on empty key', () => expect(() => new Binario('')).toThrow());
    it('throws on key without bsk_ prefix', () => expect(() => new Binario('sk_wrong')).toThrow(/bsk_/));
  });

  // --- Chat ---
  describe('chat', () => {
    it('sends messages and returns content', async () => {
      mockFetch.mockResolvedValueOnce(chatOk('Hi'));
      const res = await new Binario('bsk_t').chat('Hello');
      expect(res.content).toBe('Hi');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('passes model option in body', async () => {
      mockFetch.mockResolvedValueOnce(chatOk());
      await new Binario('bsk_t').chat('Hi', { model: 'gpt-4' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4');
    });

    it('prepends system prompt as system message', async () => {
      mockFetch.mockResolvedValueOnce(chatOk());
      await new Binario('bsk_t').chat('Hi', { systemPrompt: 'Be helpful' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'Be helpful' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('accepts Message[] input', async () => {
      mockFetch.mockResolvedValueOnce(chatOk());
      await new Binario('bsk_t').chat([
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' },
        { role: 'user', content: 'C' },
      ]);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(3);
    });

    it('sets Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(chatOk());
      await new Binario('bsk_mykey').chat('Hi');
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer bsk_mykey');
    });
  });

  // --- Error handling ---
  describe('error handling', () => {
    it('throws BinarioRateLimitError on 429', async () => {
      mockFetch.mockResolvedValue(errRes(429, { error: 'Rate limited' }, { 'Retry-After': '30' }));
      const client = new Binario('bsk_t', { maxRetries: 1 });
      await expect(client.chat('Hi')).rejects.toThrow(BinarioRateLimitError);
    });

    it('sets retryAfter from header', async () => {
      mockFetch.mockResolvedValue(errRes(429, { error: 'rl' }, { 'Retry-After': '42' }));
      const client = new Binario('bsk_t', { maxRetries: 1 });
      try { await client.chat('Hi'); } catch (e) {
        expect((e as BinarioRateLimitError).retryAfter).toBe(42);
      }
    });

    it('throws BinarioPaymentError on 402 without retry', async () => {
      mockFetch.mockResolvedValueOnce(errRes(402, { error: 'Pay up' }));
      await expect(new Binario('bsk_t').chat('Hi')).rejects.toThrow(BinarioPaymentError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
    });

    it('retries on 500 with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce(errRes(500, { error: 'server err' }))
        .mockResolvedValueOnce(chatOk('recovered'));
      vi.useFakeTimers();
      const promise = new Binario('bsk_t', { maxRetries: 2 }).chat('Hi');
      await vi.advanceTimersByTimeAsync(2000);
      const res = await promise;
      expect(res.content).toBe('recovered');
      vi.useRealTimers();
    });
  });

  // --- Usage ---
  describe('getUsage', () => {
    it('fetches usage info via GET', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ tokensUsed: 500, plan: 'free', requestsUsed: 10, requestsLimit: 1000 }));
      const usage = await new Binario('bsk_t').getUsage();
      expect(usage.plan).toBe('free');
      expect(mockFetch.mock.calls[0][1].method).toBe('GET');
    });
  });

  // --- Agent ---
  describe('agent', () => {
    it('creates agent with run method', () => {
      const agent = new Binario('bsk_t').agent({ tools: [], systemPrompt: 'Hi' });
      expect(typeof agent.run).toBe('function');
      expect(typeof agent.runStream).toBe('function');
    });

    it('agent.run sends correct payload', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ output: 'done', messages: [], toolCalls: [], iterations: 1, usage: {} }));
      const agent = new Binario('bsk_t').agent({ tools: [], systemPrompt: 'Be helpful', maxIterations: 5 });
      await agent.run('Do something');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.message).toBe('Do something');
      expect(body.maxIterations).toBe(5);
      expect(body.systemPrompt).toBe('Be helpful');
    });
  });

  // --- Factory ---
  describe('createBinarioClient', () => {
    it('returns Binario instance', () => {
      expect(createBinarioClient('bsk_x')).toBeInstanceOf(Binario);
    });
  });
});
