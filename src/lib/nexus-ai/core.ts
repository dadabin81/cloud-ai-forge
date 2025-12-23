// NexusAI SDK Core

import type {
  Provider,
  Message,
  ChatOptions,
  ChatResponse,
  NexusConfig,
  StreamCallbacks,
  ProviderConfig,
} from './types';

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-2.0-flash',
  mistral: 'mistral-large-latest',
  cohere: 'command-r-plus',
};

const PROVIDER_ENDPOINTS: Record<Provider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  cohere: 'https://api.cohere.ai/v1/chat',
};

class NexusCache {
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

export class NexusAI {
  private config: NexusConfig;
  private cache: NexusCache;

  constructor(config: NexusConfig) {
    this.config = {
      ...config,
      retry: config.retry || { maxRetries: 3, backoff: 'exponential', initialDelay: 1000 },
      timeout: config.timeout || 30000,
    };
    this.cache = new NexusCache(
      config.cache?.maxSize || 100,
      config.cache?.ttl || 3600000
    );
  }

  private getProvider(provider?: Provider): Provider {
    return provider || this.config.defaultProvider || 'openai';
  }

  private getProviderConfig(provider: Provider): ProviderConfig {
    const config = this.config.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} is not configured`);
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

  private formatMessagesForProvider(messages: Message[], provider: Provider): unknown {
    switch (provider) {
      case 'anthropic':
        const systemMessage = messages.find((m) => m.role === 'system');
        const otherMessages = messages.filter((m) => m.role !== 'system');
        return {
          system: systemMessage?.content,
          messages: otherMessages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        };
      case 'google':
        return {
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        };
      default:
        return { messages };
    }
  }

  private parseProviderResponse(data: unknown, provider: Provider, startTime: number): ChatResponse {
    const latency = Date.now() - startTime;

    switch (provider) {
      case 'anthropic': {
        const d = data as {
          id: string;
          model: string;
          content: Array<{ text: string }>;
          stop_reason: string;
          usage: { input_tokens: number; output_tokens: number };
        };
        return {
          id: d.id,
          provider,
          model: d.model,
          content: d.content[0]?.text || '',
          usage: {
            promptTokens: d.usage.input_tokens,
            completionTokens: d.usage.output_tokens,
            totalTokens: d.usage.input_tokens + d.usage.output_tokens,
          },
          finishReason: d.stop_reason as ChatResponse['finishReason'],
          latency,
          cached: false,
        };
      }
      case 'google': {
        const d = data as {
          candidates: Array<{ content: { parts: Array<{ text: string }> }; finishReason: string }>;
          usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
        };
        return {
          id: crypto.randomUUID(),
          provider,
          model: 'gemini',
          content: d.candidates[0]?.content.parts[0]?.text || '',
          usage: {
            promptTokens: d.usageMetadata.promptTokenCount,
            completionTokens: d.usageMetadata.candidatesTokenCount,
            totalTokens: d.usageMetadata.totalTokenCount,
          },
          finishReason: d.candidates[0]?.finishReason.toLowerCase() as ChatResponse['finishReason'],
          latency,
          cached: false,
        };
      }
      default: {
        const d = data as {
          id: string;
          model: string;
          choices: Array<{ message: { content: string; tool_calls?: unknown[] }; finish_reason: string }>;
          usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };
        return {
          id: d.id,
          provider,
          model: d.model,
          content: d.choices[0]?.message.content || '',
          toolCalls: d.choices[0]?.message.tool_calls as ChatResponse['toolCalls'],
          usage: {
            promptTokens: d.usage.prompt_tokens,
            completionTokens: d.usage.completion_tokens,
            totalTokens: d.usage.total_tokens,
          },
          finishReason: d.choices[0]?.finish_reason as ChatResponse['finishReason'],
          latency,
          cached: false,
        };
      }
    }
  }

  async chat(
    messages: Message[],
    options: ChatOptions & { provider?: Provider } = {}
  ): Promise<ChatResponse> {
    const provider = this.getProvider(options.provider);
    const providerConfig = this.getProviderConfig(provider);
    const model = options.model || providerConfig.defaultModel || DEFAULT_MODELS[provider];

    // Check cache
    if (this.config.cache?.enabled && options.cache !== false) {
      const cacheKey = options.cacheKey || this.cache.generateKey(messages, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const startTime = Date.now();

    const makeRequest = async (): Promise<ChatResponse> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

      try {
        let url = providerConfig.baseUrl || PROVIDER_ENDPOINTS[provider];
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...providerConfig.headers,
        };

        // Provider-specific auth and URL
        switch (provider) {
          case 'anthropic':
            headers['x-api-key'] = providerConfig.apiKey;
            headers['anthropic-version'] = '2024-01-01';
            break;
          case 'google':
            url = `${url}/${model}:generateContent?key=${providerConfig.apiKey}`;
            break;
          default:
            headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
        }

        const formattedMessages = this.formatMessagesForProvider(messages, provider);
        const body = {
          ...(typeof formattedMessages === 'object' ? formattedMessages : {}),
          model: provider !== 'google' ? model : undefined,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          top_p: options.topP,
          frequency_penalty: options.frequencyPenalty,
          presence_penalty: options.presencePenalty,
          stop: options.stop,
          tools: options.tools,
          tool_choice: options.toolChoice,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${provider} API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return this.parseProviderResponse(data, provider, startTime);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const response = await this.retryWithBackoff(makeRequest, options.retries);

    // Store in cache
    if (this.config.cache?.enabled && options.cache !== false) {
      const cacheKey = options.cacheKey || this.cache.generateKey(messages, options);
      this.cache.set(cacheKey, response);
    }

    return response;
  }

  async *streamChat(
    messages: Message[],
    options: ChatOptions & { provider?: Provider } = {},
    callbacks?: StreamCallbacks
  ): AsyncGenerator<string, ChatResponse, unknown> {
    const provider = this.getProvider(options.provider);
    const providerConfig = this.getProviderConfig(provider);
    const model = options.model || providerConfig.defaultModel || DEFAULT_MODELS[provider];

    const startTime = Date.now();
    let fullContent = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      let url = providerConfig.baseUrl || PROVIDER_ENDPOINTS[provider];
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...providerConfig.headers,
      };

      switch (provider) {
        case 'anthropic':
          headers['x-api-key'] = providerConfig.apiKey;
          headers['anthropic-version'] = '2024-01-01';
          break;
        case 'google':
          url = `${url}/${model}:streamGenerateContent?alt=sse&key=${providerConfig.apiKey}`;
          break;
        default:
          headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
      }

      const formattedMessages = this.formatMessagesForProvider(messages, provider);
      const body = {
        ...(typeof formattedMessages === 'object' ? formattedMessages : {}),
        model: provider !== 'google' ? model : undefined,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider} API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            let token = '';

            switch (provider) {
              case 'anthropic':
                if (parsed.type === 'content_block_delta') {
                  token = parsed.delta?.text || '';
                }
                break;
              case 'google':
                token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                break;
              default:
                token = parsed.choices?.[0]?.delta?.content || '';
            }

            if (token) {
              fullContent += token;
              callbacks?.onToken?.(token);
              yield token;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      const finalResponse: ChatResponse = {
        id: crypto.randomUUID(),
        provider,
        model,
        content: fullContent,
        usage,
        finishReason: 'stop',
        latency: Date.now() - startTime,
        cached: false,
      };

      callbacks?.onComplete?.(finalResponse);
      return finalResponse;
    } catch (error) {
      callbacks?.onError?.(error as Error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Convenience function for quick initialization
export function createNexus(config: NexusConfig): NexusAI {
  return new NexusAI(config);
}
