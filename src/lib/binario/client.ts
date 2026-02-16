// Binario SDK - Ultra-Simple Client for End Users
// Users just do: npm install binario && new Binario('bsk_xxx')

import type { Message, ChatResponse, StreamCallbacks, Tool, AgentRunOptions, AgentResult } from './types';

// API Base URL
const BINARIO_API_URL = 'https://api.binario.dev';

export interface BinarioOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: Tool[];
  stream?: boolean;
}

export interface StreamOptions extends ChatOptions {
  onToken?: (token: string) => void;
  onComplete?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface AgentOptions {
  name?: string;
  systemPrompt?: string;
  tools: Tool[];
  maxIterations?: number;
  model?: string;
}

export interface UsageInfo {
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  plan: 'free' | 'pro' | 'enterprise';
  resetAt: string;
}

/**
 * Binario - Ultra-simple AI SDK
 * 
 * @example
 * ```typescript
 * import { Binario } from 'binario';
 * 
 * const ai = new Binario('bsk_your_api_key');
 * 
 * // Simple chat
 * const response = await ai.chat('Hello!');
 * console.log(response.content);
 * 
 * // Streaming
 * for await (const token of ai.stream('Tell me a story')) {
 *   process.stdout.write(token);
 * }
 * 
 * // Agent with tools
 * const agent = ai.agent({
 *   tools: [searchTool, calculatorTool],
 *   systemPrompt: 'You are a helpful assistant'
 * });
 * const result = await agent.run('Search for weather in Madrid');
 * ```
 */
export class Binario {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(apiKey: string, options: BinarioOptions = {}) {
    if (!apiKey || !apiKey.startsWith('bsk_')) {
      throw new Error('Invalid API key. Keys should start with "bsk_"');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || BINARIO_API_URL;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Simple chat completion
   */
  async chat(
    messageOrMessages: string | Message[],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const messages = this.normalizeMessages(messageOrMessages, options.systemPrompt);
    
    const response = await this.request('/v1/chat/completions', {
      messages,
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools,
    });

    return response;
  }

  /**
   * Streaming chat - returns async iterator
   */
  async *stream(
    messageOrMessages: string | Message[],
    options: ChatOptions = {}
  ): AsyncGenerator<string, ChatResponse, unknown> {
    const messages = this.normalizeMessages(messageOrMessages, options.systemPrompt);
    
    const response = await fetch(`${this.baseUrl}/v1/chat/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              yield content;
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      provider: 'cloudflare' as const,
      content: fullContent,
      model: options.model || 'default',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop' as const,
      latency: 0,
      cached: false,
    };
  }

  /**
   * Stream with callbacks (alternative API)
   */
  async streamWithCallbacks(
    messageOrMessages: string | Message[],
    options: StreamOptions
  ): Promise<ChatResponse> {
    const { onToken, onComplete, onError, ...chatOptions } = options;

    try {
      let fullContent = '';
      
      for await (const token of this.stream(messageOrMessages, chatOptions)) {
        fullContent += token;
        onToken?.(token);
      }

      const response: ChatResponse = {
        id: crypto.randomUUID(),
        provider: 'cloudflare' as const,
        content: fullContent,
        model: chatOptions.model || 'default',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop' as const,
        latency: 0,
        cached: false,
      };

      onComplete?.(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  /**
   * Create an agent with tools
   */
  agent(options: AgentOptions): BinarioAgent {
    return new BinarioAgent(this, options);
  }

  /**
   * Get current usage
   */
  async getUsage(): Promise<UsageInfo> {
    return this.request('/v1/usage', {}, 'GET');
  }

  /**
   * List available models
   */
  async listModels(): Promise<{ id: string; name: string; free: boolean }[]> {
    return this.request('/v1/models', {}, 'GET');
  }

  // Private helpers
  private normalizeMessages(input: string | Message[], systemPrompt?: string): Message[] {
    const messages: Message[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    if (typeof input === 'string') {
      messages.push({ role: 'user', content: input });
    } else {
      messages.push(...input);
    }
    
    return messages;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Binario-SDK': 'js/1.0.0',
    };
  }

  private async request(
    endpoint: string,
    body: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST'
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: this.getHeaders(),
          body: method === 'POST' ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new BinarioRateLimitError(
              error.error || 'Rate limit exceeded',
              retryAfter ? parseInt(retryAfter) : 60
            );
          }
          
          // Handle payment required
          if (response.status === 402) {
            throw new BinarioPaymentError(error.error || 'Payment required');
          }
          
          throw new Error(error.error || `Request failed: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on payment or specific errors
        if (error instanceof BinarioPaymentError) {
          throw error;
        }
        
        // Exponential backoff
        if (i < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed');
  }
}

/**
 * Binario Agent - Multi-step reasoning with tools
 */
export class BinarioAgent {
  private client: Binario;
  private options: AgentOptions;

  constructor(client: Binario, options: AgentOptions) {
    this.client = client;
    this.options = options;
  }

  /**
   * Run the agent with a user message
   */
  async run(message: string): Promise<AgentResult> {
    const response = await (this.client as any).request('/v1/agents/run', {
      message,
      name: this.options.name,
      systemPrompt: this.options.systemPrompt,
      tools: this.options.tools,
      maxIterations: this.options.maxIterations || 10,
      model: this.options.model,
    });

    return response;
  }

  /**
   * Run agent with streaming
   */
  async *runStream(message: string): AsyncGenerator<{
    type: 'thinking' | 'tool_call' | 'tool_result' | 'response';
    content: string;
    tool?: string;
  }> {
    const response = await fetch(`${(this.client as any).baseUrl}/v1/agents/stream`, {
      method: 'POST',
      headers: (this.client as any).getHeaders(),
      body: JSON.stringify({
        message,
        name: this.options.name,
        systemPrompt: this.options.systemPrompt,
        tools: this.options.tools,
        maxIterations: this.options.maxIterations || 10,
        model: this.options.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.status}`);
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            yield JSON.parse(data);
          } catch {
            // Ignore
          }
        }
      }
    }
  }
}

// Custom error classes
export class BinarioRateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'BinarioRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BinarioPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinarioPaymentError';
  }
}

// Factory function
export function createBinarioClient(apiKey: string, options?: BinarioOptions): Binario {
  return new Binario(apiKey, options);
}
