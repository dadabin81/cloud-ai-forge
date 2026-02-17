import { describe, it, expect } from 'vitest';
import { BinarioAI, createBinario } from './core';

describe('BinarioAI Core', () => {
  describe('createBinario', () => {
    it('should create a BinarioAI instance', () => {
      const ai = createBinario({
        providers: {},
        defaultProvider: 'cloudflare',
      });

      expect(ai).toBeInstanceOf(BinarioAI);
    });

    it('should create with OpenRouter provider', () => {
      const ai = createBinario({
        providers: {
          openrouter: {
            apiKey: 'test_key',
          },
        },
        defaultProvider: 'openrouter',
      });

      expect(ai).toBeInstanceOf(BinarioAI);
    });

    it('should create with Cloudflare provider', () => {
      const ai = createBinario({
        providers: {
          cloudflare: {
            accountId: 'test_account',
            apiToken: 'test_token',
          },
        },
        defaultProvider: 'cloudflare',
      });

      expect(ai).toBeInstanceOf(BinarioAI);
    });
  });

  describe('BinarioAI instance', () => {
    it('should have chat method', () => {
      const ai = createBinario({
        providers: {},
        defaultProvider: 'cloudflare',
      });

      expect(typeof ai.chat).toBe('function');
    });

    it('should have streamChat method', () => {
      const ai = createBinario({
        providers: {},
        defaultProvider: 'cloudflare',
      });

      expect(typeof ai.streamChat).toBe('function');
    });

    it('should have clearCache method', () => {
      const ai = createBinario({
        providers: {},
        defaultProvider: 'cloudflare',
      });

      expect(typeof ai.clearCache).toBe('function');
    });
  });
});
