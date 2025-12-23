// Cloudflare Workers AI Provider
// Real integration with accurate neuron costs and model information

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

/**
 * Cloudflare Workers AI Models
 * Updated with correct model identifiers and categorization
 */
export const CLOUDFLARE_MODELS = {
  // ========== SMALL MODELS - Best for Free Tier ==========
  // These consume fewer neurons and are ideal for the 10K neurons/day free tier
  'llama-3.2-1b': '@cf/meta/llama-3.2-1b-instruct',           // ~550 tokens/day free
  'llama-3.2-3b': '@cf/meta/llama-3.2-3b-instruct',           // ~300 tokens/day free
  'llama-3.1-8b-fast': '@cf/meta/llama-3.1-8b-instruct-fp8-fast', // ~287 tokens/day free
  
  // ========== MEDIUM MODELS ==========
  'llama-3.2-11b-vision': '@cf/meta/llama-3.2-11b-vision-instruct',
  'mistral-small': '@cf/mistralai/mistral-small-3.1-24b-instruct',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  
  // ========== LARGE MODELS - High Neuron Cost ==========
  // NOT recommended for free tier - 70B models consume ~208K neurons per request
  'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'llama-3.1-70b': '@cf/meta/llama-3.1-70b-instruct',
  'llama-4-scout': '@cf/meta/llama-4-scout-17b-16e-instruct',
  
  // ========== FUNCTION CALLING MODELS ==========
  // These models support native tool/function calling
  'hermes-2-pro': '@hf/nousresearch/hermes-2-pro-mistral-7b',
  'granite-4': '@cf/ibm/granite-4.0-h-micro',
  
  // ========== REASONING MODELS ==========
  'deepseek-r1': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'qwq-32b': '@cf/qwen/qwq-32b',
} as const;

// Default to small, economical model for free tier
export const DEFAULT_CLOUDFLARE_MODEL = CLOUDFLARE_MODELS['llama-3.2-1b'];

// Model recommended for function calling
export const FUNCTION_CALLING_MODEL = CLOUDFLARE_MODELS['hermes-2-pro'];

/**
 * Neuron costs per million tokens
 * Source: Cloudflare Workers AI Pricing documentation
 * Formula: neurons = (input_tokens * input_cost + output_tokens * output_cost) / 1,000,000
 */
export const NEURON_COSTS: Record<string, { input: number; output: number }> = {
  // Small models - most economical
  '@cf/meta/llama-3.2-1b-instruct': { input: 2457, output: 18252 },
  '@cf/meta/llama-3.2-3b-instruct': { input: 4625, output: 30475 },
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { input: 4119, output: 34868 },
  
  // Medium models
  '@cf/meta/llama-3.2-11b-vision-instruct': { input: 8500, output: 65000 },
  '@cf/mistralai/mistral-small-3.1-24b-instruct': { input: 12000, output: 95000 },
  '@cf/qwen/qwen3-30b-a3b-fp8': { input: 15000, output: 110000 },
  
  // Large models - very expensive in neurons
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26668, output: 204805 },
  '@cf/meta/llama-3.1-70b-instruct': { input: 28000, output: 210000 },
  '@cf/meta/llama-4-scout-17b-16e-instruct': { input: 35000, output: 250000 },
  
  // Function calling models
  '@hf/nousresearch/hermes-2-pro-mistral-7b': { input: 4000, output: 32000 },
  '@cf/ibm/granite-4.0-h-micro': { input: 3500, output: 28000 },
  
  // Reasoning models
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': { input: 16000, output: 120000 },
  '@cf/qwen/qwq-32b': { input: 16000, output: 120000 },
};

export const FREE_NEURONS_PER_DAY = 10_000;

/**
 * Calculate neuron consumption for a request
 * @returns Neuron count for the request
 */
export function calculateNeurons(
  model: CloudflareModel,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = NEURON_COSTS[model];
  if (!costs) {
    // Default estimate for unknown models
    return Math.ceil((inputTokens * 5000 + outputTokens * 40000) / 1_000_000);
  }
  return Math.ceil((inputTokens * costs.input + outputTokens * costs.output) / 1_000_000);
}

/**
 * Estimate maximum tokens available with free tier for a model
 */
export function estimateFreeTokens(model: CloudflareModel): { input: number; output: number } {
  const costs = NEURON_COSTS[model];
  if (!costs) return { input: 0, output: 0 };
  
  // Assuming 1:1 input:output ratio
  const avgCost = (costs.input + costs.output) / 2;
  const totalTokens = Math.floor((FREE_NEURONS_PER_DAY * 1_000_000) / avgCost);
  
  return {
    input: Math.floor(totalTokens / 2),
    output: Math.floor(totalTokens / 2),
  };
}

/**
 * Get models that support function calling
 */
export function getFunctionCallingModels(): string[] {
  return [
    CLOUDFLARE_MODELS['llama-3.3-70b'],
    CLOUDFLARE_MODELS['llama-4-scout'],
    CLOUDFLARE_MODELS['hermes-2-pro'],
    CLOUDFLARE_MODELS['mistral-small'],
    CLOUDFLARE_MODELS['qwen3-30b'],
    CLOUDFLARE_MODELS['granite-4'],
  ];
}

/**
 * Check if a model supports function calling
 */
export function supportsToolCalling(model: CloudflareModel): boolean {
  return getFunctionCallingModels().includes(model);
}

/**
 * Format messages for Cloudflare Workers AI
 */
export function formatMessagesForCloudflare(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role === 'tool' ? 'assistant' : msg.role,
    content: msg.content,
  }));
}

/**
 * Execute inference using Cloudflare AI binding (Workers environment)
 * This is the FASTEST method - direct binding without network latency
 */
export async function runWithBinding(
  binding: { run: (model: string, input: unknown) => Promise<unknown> },
  messages: Message[],
  options: CloudflareOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;

  const input: Record<string, unknown> = {
    messages: formatMessagesForCloudflare(messages),
    max_tokens: options.maxTokens || 256, // Conservative default for free tier
    temperature: options.temperature,
    stream: false,
  };

  // Add tools if model supports function calling
  if (options.tools && supportsToolCalling(model)) {
    input.tools = options.tools;
  }

  const result = await binding.run(model, input) as {
    response?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };

  const latency = Date.now() - startTime;

  // Estimate token usage (Workers AI doesn't return exact counts)
  const estimatedInputTokens = JSON.stringify(messages).length / 4;
  const estimatedOutputTokens = (result.response?.length || 0) / 4;
  const neuronsUsed = calculateNeurons(model, estimatedInputTokens, estimatedOutputTokens);

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: result.response || '',
    toolCalls: result.tool_calls as ToolCall[],
    usage: {
      promptTokens: Math.ceil(estimatedInputTokens),
      completionTokens: Math.ceil(estimatedOutputTokens),
      totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
    },
    finishReason: result.tool_calls ? 'tool_calls' : 'stop',
    latency,
    cached: false,
    // Extended info
    _neuronsUsed: neuronsUsed,
  } as ChatResponse & { _neuronsUsed: number };
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
    throw new Error(
      'Cloudflare requires accountId and apiKey for REST API access.\n' +
      'Get these from: https://dash.cloudflare.com/profile/api-tokens'
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

  const body: Record<string, unknown> = {
    messages: formatMessagesForCloudflare(messages),
    max_tokens: options.maxTokens || 256,
    temperature: options.temperature,
    stream: options.stream || false,
  };

  // Add tools if model supports function calling
  if (options.tools && supportsToolCalling(model)) {
    body.tools = options.tools;
  }

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

  // Estimate token usage
  const estimatedInputTokens = JSON.stringify(messages).length / 4;
  const estimatedOutputTokens = (data.result.response?.length || 0) / 4;
  const neuronsUsed = calculateNeurons(model, estimatedInputTokens, estimatedOutputTokens);

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: data.result.response || '',
    toolCalls: data.result.tool_calls,
    usage: {
      promptTokens: Math.ceil(estimatedInputTokens),
      completionTokens: Math.ceil(estimatedOutputTokens),
      totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
    },
    finishReason: data.result.tool_calls ? 'tool_calls' : 'stop',
    latency,
    cached: false,
    _neuronsUsed: neuronsUsed,
  } as ChatResponse & { _neuronsUsed: number };
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
      max_tokens: options.maxTokens || 256,
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

  const estimatedInputTokens = JSON.stringify(messages).length / 4;
  const estimatedOutputTokens = fullContent.length / 4;

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: fullContent,
    usage: {
      promptTokens: Math.ceil(estimatedInputTokens),
      completionTokens: Math.ceil(estimatedOutputTokens),
      totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
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
 * Create a Cloudflare provider configuration
 */
export function createCloudflareProvider(config: {
  accountId?: string;
  apiKey?: string;
  binding?: { run: (model: string, input: unknown) => Promise<unknown> };
  defaultModel?: CloudflareModel;
}) {
  return {
    ...config,
    defaultModel: config.defaultModel || DEFAULT_CLOUDFLARE_MODEL,
  };
}

/**
 * Get model recommendations based on use case
 */
export function getRecommendedModel(useCase: 'free-tier' | 'function-calling' | 'vision' | 'reasoning' | 'best'): CloudflareModel {
  switch (useCase) {
    case 'free-tier':
      return CLOUDFLARE_MODELS['llama-3.2-1b'];
    case 'function-calling':
      return CLOUDFLARE_MODELS['hermes-2-pro'];
    case 'vision':
      return CLOUDFLARE_MODELS['llama-3.2-11b-vision'];
    case 'reasoning':
      return CLOUDFLARE_MODELS['deepseek-r1'];
    case 'best':
      return CLOUDFLARE_MODELS['llama-3.3-70b'];
    default:
      return DEFAULT_CLOUDFLARE_MODEL;
  }
}
