// Binario SDK Core - Cloudflare Workers AI ONLY

import type {
  Provider,
  Message,
  ChatOptions,
  ChatResponse,
  BinarioConfig,
  StreamCallbacks,
  ProviderConfig,
  CloudflareModel,
} from './types';
import { runWithBinding, runWithRestAPI, streamWithRestAPI, DEFAULT_CLOUDFLARE_MODEL } from './providers/cloudflare';
import { parseStructuredOutput } from './schema';

const DEFAULT_MODELS: Partial<Record<Provider, string>> = {
  cloudflare: DEFAULT_CLOUDFLARE_MODEL,
};

const PROVIDER_ENDPOINTS: Partial<Record<Provider, string>> = {
  cloudflare: 'https://api.cloudflare.com/client/v4/accounts',
};

class BinarioCache {
  private cache = new Map<string, { data: ChatResponse; timestamp: number }>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): ChatResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: ChatResponse): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  generateKey(messages: Message[], options: ChatOptions): string {
    return btoa(JSON.stringify({ messages, options })).slice(0, 64);
  }

  clear(): void {
    this.cache.clear();
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BinarioAI {
  private config: BinarioConfig;
  private cache: BinarioCache;

  constructor(config: BinarioConfig) {
    this.config = {
      ...config,
      retry: config.retry || { maxRetries: 3, backoff: 'exponential', initialDelay: 1000 },
      timeout: config.timeout || 30000,
    };
    this.cache = new BinarioCache(
      config.cache?.maxSize || 100,
      config.cache?.ttl || 3600000
    );
  }

  private getProvider(): Provider {
    return 'cloudflare';
  }

  private getProviderConfig(): ProviderConfig {
    const config = this.config.providers['cloudflare'];
    if (!config) {
      throw new Error('Cloudflare provider is not configured');
    }
    return config;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.config.retry?.maxRetries || 3
  ): Promise<T> {
    let lastError: Error | null = null;
    const { backoff, initialDelay } = this.config.retry || { backoff: 'exponential', initialDelay: 1000 };

    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          const delay = backoff === 'exponential' 
            ? initialDelay * Math.pow(2, i) 
            : initialDelay * (i + 1);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  async chat(
    messages: Message[],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const providerConfig = this.getProviderConfig();
    const model = options.model || providerConfig.defaultModel || DEFAULT_CLOUDFLARE_MODEL;

    // Check cache
    if (this.config.cache?.enabled && options.cache !== false) {
      const cacheKey = options.cacheKey || this.cache.generateKey(messages, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const cfOptions = { model, maxTokens: options.maxTokens, temperature: options.temperature };
    
    let response: ChatResponse;
    if (providerConfig.binding) {
      response = await this.retryWithBackoff(
        () => runWithBinding(providerConfig.binding as { run: (model: string, input: unknown) => Promise<unknown> }, messages, cfOptions),
        options.retries
      );
    } else {
      response = await this.retryWithBackoff(
        () => runWithRestAPI(providerConfig.accountId || '', providerConfig.apiKey || '', messages, cfOptions),
        options.retries
      );
    }

    const finalResponse = this.handleStructuredOutput(response, options);

    if (this.config.cache?.enabled && options.cache !== false) {
      const cacheKey = options.cacheKey || this.cache.generateKey(messages, options);
      this.cache.set(cacheKey, finalResponse);
    }

    return finalResponse;
  }

  private handleStructuredOutput(response: ChatResponse, options: ChatOptions): ChatResponse {
    if (options.outputSchema && response.content) {
      const parsed = parseStructuredOutput(response.content, options.outputSchema);
      if (parsed.success) {
        return { ...response, data: parsed.data };
      }
    }
    return response;
  }

  async *streamChat(
    messages: Message[],
    options: ChatOptions = {},
    callbacks?: StreamCallbacks
  ): AsyncGenerator<string, ChatResponse, unknown> {
    const providerConfig = this.getProviderConfig();
    const model = options.model || providerConfig.defaultModel || DEFAULT_CLOUDFLARE_MODEL;

    const stream = streamWithRestAPI(providerConfig.accountId || '', providerConfig.apiKey || '', messages, {
      model: model as CloudflareModel,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    let fullStreamContent = '';
    for await (const token of stream) {
      callbacks?.onToken?.(token);
      fullStreamContent += token;
      yield token;
    }

    const streamResponse: ChatResponse = {
      id: crypto.randomUUID(),
      provider: 'cloudflare',
      model,
      content: fullStreamContent,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      latency: 0,
      cached: false,
    };
    callbacks?.onComplete?.(streamResponse);
    return streamResponse;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function createBinario(config: BinarioConfig): BinarioAI {
  return new BinarioAI(config);
}
