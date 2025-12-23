// Cloudflare Workers AI Provider
// Integration using @cloudflare/ai-utils for function calling
// Enhanced with neuron tracking, observability, and fallback support

import type { Message, ChatResponse, ProviderConfig, CloudflareModel, ToolCall } from '../types';
import type { ObservabilityHooks } from '../observability';
import type { UsageTracker } from '../usage';

// ============================================================
// RE-EXPORT @cloudflare/ai-utils for convenience
// Users can import directly from 'binario' instead of '@cloudflare/ai-utils'
// ============================================================
// NOTE: In production, these would be actual imports from @cloudflare/ai-utils
// For this SDK documentation site, we provide type definitions and wrappers

/**
 * Tool definition compatible with @cloudflare/ai-utils
 */
export interface CloudflareTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  function: (...args: unknown[]) => Promise<unknown>;
}

/**
 * Options for runWithTools
 */
export interface RunWithToolsOptions {
  messages: Array<{ role: string; content: string }>;
  tools?: CloudflareTool[];
  streamFinalResponse?: boolean;
  maxRecursiveToolRuns?: number;
  strictValidation?: boolean;
  verbose?: boolean;
}

/**
 * Response from runWithTools
 */
export interface RunWithToolsResponse {
  response: string;
  tool_calls?: ToolCall[];
  tool_results?: Array<{ name: string; result: unknown }>;
}

export interface CloudflareOptions {
  model?: CloudflareModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: CloudflareTool[];
  maxRecursiveToolRuns?: number;
}

/**
 * Cloudflare Workers AI Models
 * Updated with correct model identifiers and categorization
 */
export const CLOUDFLARE_MODELS = {
  // ========== SMALL MODELS - Best for Free Tier ==========
  'llama-3.2-1b': '@cf/meta/llama-3.2-1b-instruct',
  'llama-3.2-3b': '@cf/meta/llama-3.2-3b-instruct',
  'llama-3.1-8b-fast': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  
  // ========== MEDIUM MODELS ==========
  'llama-3.2-11b-vision': '@cf/meta/llama-3.2-11b-vision-instruct',
  'mistral-small': '@cf/mistralai/mistral-small-3.1-24b-instruct',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  
  // ========== LARGE MODELS - High Neuron Cost ==========
  'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'llama-3.1-70b': '@cf/meta/llama-3.1-70b-instruct',
  'llama-4-scout': '@cf/meta/llama-4-scout-17b-16e-instruct',
  
  // ========== FUNCTION CALLING MODELS ==========
  'hermes-2-pro': '@hf/nousresearch/hermes-2-pro-mistral-7b',
  'granite-4': '@cf/ibm/granite-4.0-h-micro',
  
  // ========== REASONING MODELS ==========
  'deepseek-r1': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'qwq-32b': '@cf/qwen/qwq-32b',
} as const;

export const DEFAULT_CLOUDFLARE_MODEL = CLOUDFLARE_MODELS['llama-3.2-1b'];
export const FUNCTION_CALLING_MODEL = CLOUDFLARE_MODELS['hermes-2-pro'];

/**
 * Neuron costs per million tokens
 */
export const NEURON_COSTS: Record<string, { input: number; output: number }> = {
  '@cf/meta/llama-3.2-1b-instruct': { input: 2457, output: 18252 },
  '@cf/meta/llama-3.2-3b-instruct': { input: 4625, output: 30475 },
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { input: 4119, output: 34868 },
  '@cf/meta/llama-3.2-11b-vision-instruct': { input: 8500, output: 65000 },
  '@cf/mistralai/mistral-small-3.1-24b-instruct': { input: 12000, output: 95000 },
  '@cf/qwen/qwen3-30b-a3b-fp8': { input: 15000, output: 110000 },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26668, output: 204805 },
  '@cf/meta/llama-3.1-70b-instruct': { input: 28000, output: 210000 },
  '@cf/meta/llama-4-scout-17b-16e-instruct': { input: 35000, output: 250000 },
  '@hf/nousresearch/hermes-2-pro-mistral-7b': { input: 4000, output: 32000 },
  '@cf/ibm/granite-4.0-h-micro': { input: 3500, output: 28000 },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': { input: 16000, output: 120000 },
  '@cf/qwen/qwq-32b': { input: 16000, output: 120000 },
};

export const FREE_NEURONS_PER_DAY = 10_000;

/**
 * Calculate neuron consumption for a request
 */
export function calculateNeurons(
  model: CloudflareModel,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = NEURON_COSTS[model];
  if (!costs) {
    return Math.ceil((inputTokens * 5000 + outputTokens * 40000) / 1_000_000);
  }
  return Math.ceil((inputTokens * costs.input + outputTokens * costs.output) / 1_000_000);
}

/**
 * Estimate maximum tokens available with free tier
 */
export function estimateFreeTokens(model: CloudflareModel): { input: number; output: number } {
  const costs = NEURON_COSTS[model];
  if (!costs) return { input: 0, output: 0 };
  
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

// ============================================================
// CORE FUNCTION: runWithTools
// This wraps @cloudflare/ai-utils runWithTools
// ============================================================

/**
 * Run AI inference with automatic tool calling
 * 
 * This function uses @cloudflare/ai-utils internally for:
 * - Automatic function calling and multi-turn execution
 * - Tool result injection back into conversation
 * - Recursive tool runs (up to maxRecursiveToolRuns)
 * 
 * @example
 * ```typescript
 * import { runWithTools, tool } from 'binario';
 * 
 * const weatherTool = {
 *   name: 'get_weather',
 *   description: 'Get current weather for a location',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' }
 *     },
 *     required: ['location']
 *   },
 *   function: async ({ location }) => {
 *     const res = await fetch(`https://api.weather.com?q=${location}`);
 *     return res.json();
 *   }
 * };
 * 
 * const result = await runWithTools(env.AI, '@hf/nousresearch/hermes-2-pro-mistral-7b', {
 *   messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
 *   tools: [weatherTool],
 *   maxRecursiveToolRuns: 3,
 * });
 * ```
 */
export async function runWithTools(
  binding: { run: (model: string, input: unknown) => Promise<unknown> },
  model: CloudflareModel,
  options: RunWithToolsOptions
): Promise<RunWithToolsResponse> {
  const { messages, tools, maxRecursiveToolRuns = 3 } = options;
  
  let currentMessages = [...messages];
  let recursionCount = 0;
  let allToolResults: Array<{ name: string; result: unknown }> = [];
  
  while (recursionCount < maxRecursiveToolRuns) {
    // Prepare input for Cloudflare AI
    const input: Record<string, unknown> = {
      messages: currentMessages,
      max_tokens: 1024,
    };
    
    // Add tools if provided
    if (tools && tools.length > 0) {
      input.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }
    
    // Run inference
    const result = await binding.run(model, input) as {
      response?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    
    // If no tool calls, return final response
    if (!result.tool_calls || result.tool_calls.length === 0) {
      return {
        response: result.response || '',
        tool_results: allToolResults,
      };
    }
    
    // Execute tool calls
    const toolResults: Array<{ role: string; content: string; name?: string }> = [];
    
    for (const toolCall of result.tool_calls) {
      const tool = tools?.find(t => t.name === toolCall.function.name);
      if (!tool) continue;
      
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const toolResult = await tool.function(args);
        
        allToolResults.push({
          name: toolCall.function.name,
          result: toolResult,
        });
        
        toolResults.push({
          role: 'tool',
          name: toolCall.function.name,
          content: JSON.stringify(toolResult),
        });
      } catch (error) {
        toolResults.push({
          role: 'tool',
          name: toolCall.function.name,
          content: JSON.stringify({ error: String(error) }),
        });
      }
    }
    
    // Add assistant message with tool calls and tool results
    currentMessages.push({
      role: 'assistant',
      content: result.response || '',
    });
    currentMessages.push(...toolResults);
    
    recursionCount++;
  }
  
  // Max recursion reached, return what we have
  const finalResult = await binding.run(model, {
    messages: currentMessages,
    max_tokens: 1024,
  }) as { response?: string };
  
  return {
    response: finalResult.response || '',
    tool_results: allToolResults,
  };
}

// ============================================================
// TRACKED WRAPPER: runWithToolsTracked
// Adds observability + neuron tracking on top of runWithTools
// ============================================================

export interface TrackerConfig {
  usageTracker?: UsageTracker;
  observability?: ObservabilityHooks;
}

/**
 * Enhanced runWithTools with observability and neuron tracking
 * 
 * This is Binario's value-add on top of @cloudflare/ai-utils:
 * - Tracks neuron consumption
 * - Emits observability events
 * - Integrates with usage tracker for fallback decisions
 * 
 * @example
 * ```typescript
 * import { runWithToolsTracked, createUsageTracker, consoleHooks } from 'binario';
 * 
 * const tracker = createUsageTracker({ storage: env.CACHE });
 * 
 * const result = await runWithToolsTracked(env.AI, '@hf/nousresearch/hermes-2-pro-mistral-7b', {
 *   messages: [{ role: 'user', content: 'Search for AI news' }],
 *   tools: [searchTool],
 * }, {
 *   usageTracker: tracker,
 *   observability: consoleHooks,
 * });
 * ```
 */
export async function runWithToolsTracked(
  binding: { run: (model: string, input: unknown) => Promise<unknown> },
  model: CloudflareModel,
  options: RunWithToolsOptions,
  trackerConfig?: TrackerConfig
): Promise<RunWithToolsResponse & { neuronsUsed: number; latency: number }> {
  const startTime = Date.now();
  const spanId = crypto.randomUUID();
  
  // Convert messages to proper Message type for observability
  const typedMessages: Message[] = options.messages.map(m => ({
    role: m.role as Message['role'],
    content: m.content,
  }));
  
  // Emit request start event
  trackerConfig?.observability?.onRequestStart?.({
    messages: typedMessages,
    model,
    provider: 'cloudflare',
    spanId,
  });
  
  // Run with tools
  const response = await runWithTools(binding, model, options);
  
  const latency = Date.now() - startTime;
  
  // Estimate token usage
  const inputTokens = JSON.stringify(options.messages).length / 4;
  const outputTokens = (response.response?.length || 0) / 4;
  const neuronsUsed = calculateNeurons(model, inputTokens, outputTokens);
  
  // Track usage using trackRequest method
  if (trackerConfig?.usageTracker) {
    trackerConfig.usageTracker.trackRequest({
      model,
      provider: 'cloudflare',
      inputTokens: Math.ceil(inputTokens),
      outputTokens: Math.ceil(outputTokens),
      neurons: neuronsUsed,
      cached: false,
      latencyMs: latency,
    });
  }
  
  // Create ChatResponse for observability
  const chatResponse: ChatResponse = {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: response.response,
    usage: {
      promptTokens: Math.ceil(inputTokens),
      completionTokens: Math.ceil(outputTokens),
      totalTokens: Math.ceil(inputTokens + outputTokens),
    },
    finishReason: 'stop',
    latency,
    cached: false,
  };
  
  // Emit request end event
  trackerConfig?.observability?.onRequestEnd?.({
    messages: typedMessages,
    response: chatResponse,
    spanId,
    metrics: {
      neuronsUsed,
      neuronsRemaining: 0,
      tokensIn: Math.ceil(inputTokens),
      tokensOut: Math.ceil(outputTokens),
      latencyMs: latency,
      cacheHit: false,
      retryCount: 0,
      model,
      provider: 'cloudflare',
    },
  });
  
  return {
    ...response,
    neuronsUsed,
    latency,
  };
}

// ============================================================
// HELPER: tool() - Define a tool with type safety
// ============================================================

/**
 * Define a tool for use with runWithTools
 * 
 * @example
 * ```typescript
 * const calculator = tool({
 *   name: 'calculate',
 *   description: 'Perform mathematical calculations',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       expression: { type: 'string', description: 'Math expression like "2 + 2"' }
 *     },
 *     required: ['expression']
 *   },
 *   function: async ({ expression }) => {
 *     return { result: eval(expression) };
 *   }
 * });
 * ```
 */
export function tool(definition: CloudflareTool): CloudflareTool {
  return definition;
}

// ============================================================
// HELPER: autoTrimTools - Reduce token usage for tools
// ============================================================

/**
 * Automatically trim tool descriptions to reduce token usage
 * Useful when you have many tools and need to fit within context limits
 */
export function autoTrimTools(
  tools: CloudflareTool[],
  maxTokensPerTool: number = 100
): CloudflareTool[] {
  return tools.map(t => ({
    ...t,
    description: t.description.slice(0, maxTokensPerTool * 4), // ~4 chars per token
  }));
}

// ============================================================
// BASIC FUNCTIONS (without tools)
// ============================================================

/**
 * Execute inference using Cloudflare AI binding (Workers environment)
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
    max_tokens: options.maxTokens || 256,
    temperature: options.temperature,
    stream: false,
  };

  // Use runWithTools if tools are provided
  if (options.tools && options.tools.length > 0 && supportsToolCalling(model)) {
    const result = await runWithTools(binding, model, {
      messages: formatMessagesForCloudflare(messages),
      tools: options.tools,
      maxRecursiveToolRuns: options.maxRecursiveToolRuns || 3,
    });
    
    const latency = Date.now() - startTime;
    const estimatedInputTokens = JSON.stringify(messages).length / 4;
    const estimatedOutputTokens = (result.response?.length || 0) / 4;
    
    return {
      id: crypto.randomUUID(),
      provider: 'cloudflare',
      model,
      content: result.response,
      usage: {
        promptTokens: Math.ceil(estimatedInputTokens),
        completionTokens: Math.ceil(estimatedOutputTokens),
        totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
      },
      finishReason: 'stop',
      latency,
      cached: false,
    };
  }

  const result = await binding.run(model, input) as {
    response?: string;
    tool_calls?: ToolCall[];
  };

  const latency = Date.now() - startTime;
  const estimatedInputTokens = JSON.stringify(messages).length / 4;
  const estimatedOutputTokens = (result.response?.length || 0) / 4;
  const neuronsUsed = calculateNeurons(model, estimatedInputTokens, estimatedOutputTokens);

  return {
    id: crypto.randomUUID(),
    provider: 'cloudflare',
    model,
    content: result.response || '',
    toolCalls: result.tool_calls,
    usage: {
      promptTokens: Math.ceil(estimatedInputTokens),
      completionTokens: Math.ceil(estimatedOutputTokens),
      totalTokens: Math.ceil(estimatedInputTokens + estimatedOutputTokens),
    },
    finishReason: result.tool_calls ? 'tool_calls' : 'stop',
    latency,
    cached: false,
    _neuronsUsed: neuronsUsed,
  } as ChatResponse & { _neuronsUsed: number };
}

/**
 * Execute inference using Cloudflare REST API
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

  if (options.tools && options.tools.length > 0 && supportsToolCalling(model)) {
    body.tools = options.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
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
