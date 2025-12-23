// Cloudflare Workers AI Provider
// Supports FREE Llama 3 usage with 10,000 neurons/day

import type { Message, ChatResponse, ProviderConfig, CloudflareModel, ToolCall } from '../types';

export interface CloudflareOptions {
  model?: CloudflareModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/** Default models for Cloudflare Workers AI */
export const CLOUDFLARE_MODELS = {
  'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'llama-3.2-vision': '@cf/meta/llama-3.2-11b-vision-instruct',
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  'llama-3.1-70b': '@cf/meta/llama-3.1-70b-instruct',
  'deepseek-r1': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'qwen-coder': '@cf/qwen/qwen2.5-coder-32b-instruct',
  'gemma-7b': '@cf/google/gemma-7b-it-lora',
  'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.2-lora',
} as const;

export const DEFAULT_CLOUDFLARE_MODEL = CLOUDFLARE_MODELS['llama-3.3-70b'];

/**
 * Format messages for Cloudflare Workers AI
 * Workers AI uses a simple messages array format
 */
export function formatMessagesForCloudflare(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role === 'tool' ? 'assistant' : msg.role,
    content: msg.content,
  }));
}

/**
 * Execute inference using Cloudflare AI binding (Workers environment)
 * This is the FASTEST and CHEAPEST method - direct binding
 */
export async function runWithBinding(
  binding: { run: (model: string, input: unknown) => Promise<unknown> },
  messages: Message[],
  options: CloudflareOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;

  const input = {
    messages: formatMessagesForCloudflare(messages),
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature,
    stream: false,
  };

  const result = await binding.run(model, input) as {
    response?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };

  const latency = Date.now() - startTime;

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: result.response || '',
    toolCalls: result.tool_calls as ToolCall[],
    usage: {
      promptTokens: 0, // Workers AI doesn't return token counts
      completionTokens: 0,
      totalTokens: 0,
    },
    finishReason: result.tool_calls ? 'tool_calls' : 'stop',
    latency,
    cached: false,
  };
}

/**
 * Execute inference using Cloudflare REST API
 * For non-Workers environments (browsers, Node.js, etc.)
 */
export async function runWithRestAPI(
  config: ProviderConfig,
  messages: Message[],
  options: CloudflareOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;

  if (!config.accountId || !config.apiKey) {
    throw new Error('Cloudflare requires accountId and apiKey for REST API access');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

  const body = {
    messages: formatMessagesForCloudflare(messages),
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature,
    stream: options.stream || false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    success: boolean;
    result: {
      response?: string;
      tool_calls?: ToolCall[];
    };
    errors?: Array<{ message: string }>;
  };

  if (!data.success) {
    throw new Error(`Cloudflare error: ${data.errors?.[0]?.message || 'Unknown error'}`);
  }

  const latency = Date.now() - startTime;

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: data.result.response || '',
    toolCalls: data.result.tool_calls,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    finishReason: data.result.tool_calls ? 'tool_calls' : 'stop',
    latency,
    cached: false,
  };
}

/**
 * Stream inference using Cloudflare REST API
 */
export async function* streamWithRestAPI(
  config: ProviderConfig,
  messages: Message[],
  options: CloudflareOptions = {}
): AsyncGenerator<string, ChatResponse, unknown> {
  const startTime = Date.now();
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;

  if (!config.accountId || !config.apiKey) {
    throw new Error('Cloudflare requires accountId and apiKey for REST API access');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: formatMessagesForCloudflare(messages),
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

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
        const parsed = JSON.parse(data) as { response?: string };
        const token = parsed.response || '';
        if (token) {
          fullContent += token;
          yield token;
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: fullContent,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    finishReason: 'stop',
    latency: Date.now() - startTime,
    cached: false,
  };
}

/**
 * Check if running in Cloudflare Workers environment
 */
export function isWorkersEnvironment(): boolean {
  return typeof globalThis !== 'undefined' && 
    'navigator' in globalThis && 
    (globalThis.navigator as { userAgent?: string })?.userAgent === 'Cloudflare-Workers';
}

/**
 * Estimate neurons for a request (for free tier tracking)
 * Free tier: 10,000 neurons/day
 */
export function estimateNeurons(
  model: CloudflareModel,
  inputTokens: number,
  outputTokens: number
): number {
  // Approximate neuron costs based on model size
  const modelMultipliers: Record<string, number> = {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 1.5,
    '@cf/meta/llama-3.1-70b-instruct': 1.5,
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': 1.0,
    '@cf/qwen/qwen2.5-coder-32b-instruct': 1.0,
    '@cf/meta/llama-3.2-11b-vision-instruct': 0.5,
    '@cf/meta/llama-3.1-8b-instruct-fp8-fast': 0.3,
    '@cf/google/gemma-7b-it-lora': 0.2,
    '@cf/mistral/mistral-7b-instruct-v0.2-lora': 0.2,
  };

  const multiplier = modelMultipliers[model] || 1.0;
  return Math.ceil((inputTokens + outputTokens) * multiplier);
}
