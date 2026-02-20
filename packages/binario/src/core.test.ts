import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BinarioAI, createBinario } from './core';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return {
    ok: true,
    text: async () => JSON.stringify(data),
    json: async () => data,
    body: null,
  };
}

describe('BinarioAI Core', () => {
  beforeEach(() => mockFetch.mockReset());

  describe('createBinario', () => {
    it('creates instance with minimal config', () => {
      expect(createBinario({ providers: {}, defaultProvider: 'cloudflare' })).toBeInstanceOf(BinarioAI);
    });

    it('creates with OpenRouter provider', () => {
      expect(createBinario({ providers: { openrouter: { apiKey: 'k' } }, defaultProvider: 'openrouter' })).toBeInstanceOf(BinarioAI);
    });
  });

  describe('chat', () => {
    it('throws if provider not configured', async () => {
      const ai = createBinario({ providers: {}, defaultProvider: 'openai' });
      await expect(ai.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(/not configured/);
    });

    it('sends request to OpenAI-compatible provider', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'c1',
        model: 'gpt-4',
        choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }));

      const ai = createBinario({
        providers: { openai: { apiKey: 'sk-test' } },
        defaultProvider: 'openai',
      });

      const res = await ai.chat([{ role: 'user', content: 'Hi' }]);
      expect(res.content).toBe('Hello!');
      expect(res.provider).toBe('openai');
      expect(res.usage.totalTokens).toBe(15);
    });

    it('formats messages for Anthropic', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'a1',
        model: 'claude',
        content: [{ text: 'Hey' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 3 },
      }));

      const ai = createBinario({
        providers: { anthropic: { apiKey: 'ak' } },
        defaultProvider: 'anthropic',
      });

      const res = await ai.chat([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hi' },
      ]);
      expect(res.content).toBe('Hey');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe('Be helpful');
      expect(body.messages).toHaveLength(1);
    });

    it('uses cache when enabled', async () => {
      mockFetch.mockResolvedValue(okJson({
        id: 'c1', model: 'gpt-4',
        choices: [{ message: { content: 'Cached' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }));

      const ai = createBinario({
        providers: { openai: { apiKey: 'k' } },
        defaultProvider: 'openai',
        cache: { enabled: true, maxSize: 10, ttl: 60000 },
      });

      const msgs = [{ role: 'user' as const, content: 'Hi' }];
      await ai.chat(msgs);
      const res2 = await ai.chat(msgs);
      expect(res2.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // only one actual fetch
    });

    it('clearCache empties the cache', async () => {
      mockFetch.mockResolvedValue(okJson({
        id: 'c1', model: 'gpt-4',
        choices: [{ message: { content: 'X' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }));

      const ai = createBinario({
        providers: { openai: { apiKey: 'k' } },
        defaultProvider: 'openai',
        cache: { enabled: true, maxSize: 10, ttl: 60000 },
      });

      const msgs = [{ role: 'user' as const, content: 'Hi' }];
      await ai.chat(msgs);
      ai.clearCache();
      await ai.chat(msgs);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('streamChat', () => {
    it('has streamChat method', () => {
      const ai = createBinario({ providers: {}, defaultProvider: 'cloudflare' });
      expect(typeof ai.streamChat).toBe('function');
    });
  });
});
