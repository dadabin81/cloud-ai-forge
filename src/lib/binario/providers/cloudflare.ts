// Cloudflare Workers AI Provider (Frontend mirror)
// CLOUDFLARE-ONLY: No external providers

import type { Message, ChatResponse, ProviderConfig, CloudflareModel, ToolCall } from '../types';
import type { ObservabilityHooks } from '../observability';
import type { UsageTracker } from '../usage';

// ============================================================
// TYPES
// ============================================================

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

export interface RunWithToolsOptions {
  messages: Array<{ role: string; content: string }>;
  tools?: CloudflareTool[];
  streamFinalResponse?: boolean;
  maxRecursiveToolRuns?: number;
  strictValidation?: boolean;
  verbose?: boolean;
}

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

// ============================================================
// MODEL CATALOG - Cloudflare Workers AI ONLY
// Official 2025 neuron costs
// ============================================================

export const CLOUDFLARE_MODELS = {
  // ========== ULTRA EFFICIENT ==========
  'granite-micro': '@cf/ibm-granite/granite-4.0-h-micro',
  'llama-3.2-1b': '@cf/meta/llama-3.2-1b-instruct',
  'llama-3.2-3b': '@cf/meta/llama-3.2-3b-instruct',
  'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.1',
  
  // ========== EFFICIENT ==========
  'llama-3.1-8b-fast': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash',
  'gpt-oss-20b': '@cf/openai/gpt-oss-20b',
  
  // ========== MEDIUM ==========
  'llama-3.2-11b-vision': '@cf/meta/llama-3.2-11b-vision-instruct',
  'gemma-3-12b': '@cf/google/gemma-3-12b-it',
  'mistral-small': '@cf/mistralai/mistral-small-3.1-24b-instruct',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  
  // ========== LARGE ==========
  'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'llama-4-scout': '@cf/meta/llama-4-scout-17b-16e-instruct',
  'gpt-oss-120b': '@cf/openai/gpt-oss-120b',
  
  // ========== REASONING ==========
  'deepseek-r1': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'qwq-32b': '@cf/qwen/qwq-32b',
} as const;

export const DEFAULT_CLOUDFLARE_MODEL = CLOUDFLARE_MODELS['granite-micro'];
export const FUNCTION_CALLING_MODEL = CLOUDFLARE_MODELS['mistral-small'];

export const MODEL_CATEGORIES: Record<string, { models: string[]; label: string; description: string }> = {
  'most-efficient': {
    label: 'Most Efficient',
    description: 'Maximum free tokens per day',
    models: ['granite-micro', 'llama-3.2-1b', 'mistral-7b'],
  },
  'best-quality': {
    label: 'Best Quality',
    description: 'Highest quality responses',
    models: ['llama-3.3-70b', 'gpt-oss-120b', 'llama-4-scout'],
  },
  'best-for-code': {
    label: 'Best for Code',
    description: 'Optimized for code generation',
    models: ['qwen3-30b', 'mistral-small', 'gpt-oss-20b'],
  },
  'reasoning': {
    label: 'Reasoning',
    description: 'Complex reasoning and analysis',
    models: ['deepseek-r1', 'qwq-32b', 'gpt-oss-120b'],
  },
};

export const NEURON_COSTS: Record<string, { input: number; output: number }> = {
  '@cf/ibm-granite/granite-4.0-h-micro':           { input: 1542,  output: 10158  },
  '@cf/meta/llama-3.2-1b-instruct':                { input: 2457,  output: 18252  },
  '@cf/meta/llama-3.2-3b-instruct':                { input: 4625,  output: 30475  },
  '@cf/mistral/mistral-7b-instruct-v0.1':          { input: 10000, output: 17300  },
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast':       { input: 4119,  output: 34868  },
  '@cf/zai-org/glm-4.7-flash':                     { input: 5500,  output: 36400  },
  '@cf/openai/gpt-oss-20b':                        { input: 18182, output: 27273  },
  '@cf/meta/llama-3.2-11b-vision-instruct':        { input: 4410,  output: 61493  },
  '@cf/google/gemma-3-12b-it':                     { input: 31371, output: 50560  },
  '@cf/mistralai/mistral-small-3.1-24b-instruct':  { input: 31876, output: 50488  },
  '@cf/qwen/qwen3-30b-a3b-fp8':                    { input: 4625,  output: 30475  },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast':      { input: 26668, output: 204805 },
  '@cf/meta/llama-4-scout-17b-16e-instruct':       { input: 24545, output: 77273  },
  '@cf/openai/gpt-oss-120b':                       { input: 31818, output: 68182  },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b':  { input: 45170, output: 443756 },
  '@cf/qwen/qwq-32b':                              { input: 60000, output: 90909  },
};

export const FREE_NEURONS_PER_DAY = 10_000;
export const PAID_NEURON_COST_PER_1K = 0.011;

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

export function estimateFreeTokens(model: CloudflareModel): { input: number; output: number } {
  const costs = NEURON_COSTS[model];
  if (!costs) return { input: 0, output: 0 };
  
  const outputTokens = Math.floor((FREE_NEURONS_PER_DAY * 1_000_000) / costs.output);
  const inputTokens = Math.floor((FREE_NEURONS_PER_DAY * 1_000_000) / costs.input);
  
  return { input: inputTokens, output: outputTokens };
}

export function calculateCostUSD(neurons: number): number {
  return (neurons / 1000) * PAID_NEURON_COST_PER_1K;
}

export function getFunctionCallingModels(): string[] {
  return [
    CLOUDFLARE_MODELS['llama-3.3-70b'],
    CLOUDFLARE_MODELS['llama-4-scout'],
    CLOUDFLARE_MODELS['mistral-small'],
    CLOUDFLARE_MODELS['qwen3-30b'],
    CLOUDFLARE_MODELS['granite-micro'],
  ];
}

export function supportsToolCalling(model: CloudflareModel): boolean {
  return getFunctionCallingModels().includes(model);
}

export function formatMessagesForCloudflare(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role === 'tool' ? 'assistant' : msg.role,
    content: msg.content,
  }));
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

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
    const input: Record<string, unknown> = {
      messages: currentMessages,
      max_tokens: 1024,
    };
    
    if (tools && tools.length > 0) {
      input.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    
    const result = await binding.run(model, input) as {
      response?: string;
      tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
    };
    
    if (!result.tool_calls || result.tool_calls.length === 0) {
      return { response: result.response || '', tool_results: allToolResults };
    }
    
    const toolResults: Array<{ role: string; content: string; name?: string }> = [];
    
    for (const toolCall of result.tool_calls) {
      const tool = tools?.find(t => t.name === toolCall.function.name);
      if (!tool) continue;
      
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const toolResult = await tool.function(args);
        allToolResults.push({ name: toolCall.function.name, result: toolResult });
        toolResults.push({ role: 'tool', name: toolCall.function.name, content: JSON.stringify(toolResult) });
      } catch (error) {
        toolResults.push({ role: 'tool', name: toolCall.function.name, content: JSON.stringify({ error: String(error) }) });
      }
    }
    
    currentMessages.push({ role: 'assistant', content: result.response || '' });
    currentMessages.push(...toolResults);
    recursionCount++;
  }
  
  const finalResult = await binding.run(model, { messages: currentMessages, max_tokens: 1024 }) as { response?: string };
  return { response: finalResult.response || '', tool_results: allToolResults };
}

export interface TrackerConfig {
  usageTracker?: UsageTracker;
  observability?: ObservabilityHooks;
}

export async function runWithToolsTracked(
  binding: { run: (model: string, input: unknown) => Promise<unknown> },
  model: CloudflareModel,
  options: RunWithToolsOptions,
  trackerConfig?: TrackerConfig
): Promise<RunWithToolsResponse & { neuronsUsed: number; latency: number }> {
  const startTime = Date.now();
  const spanId = crypto.randomUUID();
  
  const typedMessages: Message[] = options.messages.map(m => ({
    role: m.role as Message['role'],
    content: m.content,
  }));
  
  trackerConfig?.observability?.onRequestStart?.({
    messages: typedMessages,
    model,
    provider: 'cloudflare',
    spanId,
  });
  
  const response = await runWithTools(binding, model, options);
  
  const latency = Date.now() - startTime;
  const inputTokens = JSON.stringify(options.messages).length / 4;
  const outputTokens = (response.response?.length || 0) / 4;
  const neuronsUsed = calculateNeurons(model, inputTokens, outputTokens);
  
  if (trackerConfig?.usageTracker) {
    trackerConfig.usageTracker.trackRequest({
      model, provider: 'cloudflare',
      inputTokens: Math.ceil(inputTokens), outputTokens: Math.ceil(outputTokens),
      neurons: neuronsUsed, cached: false, latencyMs: latency,
    });
  }
  
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
  
  return { ...response, neuronsUsed, latency };
}

export function tool(definition: CloudflareTool): CloudflareTool {
  return definition;
}

export function autoTrimTools(tools: CloudflareTool[], maxTokensPerTool: number = 100): CloudflareTool[] {
  return tools.map(t => ({ ...t, description: t.description.slice(0, maxTokensPerTool * 4) }));
}

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
  };

  if (options.tools && options.tools.length > 0) {
    const result = await runWithTools(binding, model, {
      messages: formatMessagesForCloudflare(messages),
      tools: options.tools,
      maxRecursiveToolRuns: options.maxRecursiveToolRuns || 3,
    });
    const latency = Date.now() - startTime;
    const inputTokens = JSON.stringify(messages).length / 4;
    const outputTokens = (result.response?.length || 0) / 4;
    return {
      id: crypto.randomUUID(), provider: 'cloudflare', model,
      content: result.response, toolCalls: result.tool_calls,
      usage: { promptTokens: Math.ceil(inputTokens), completionTokens: Math.ceil(outputTokens), totalTokens: Math.ceil(inputTokens + outputTokens) },
      finishReason: 'stop', latency, cached: false,
    };
  }

  const result = await binding.run(model, input) as { response?: string };
  const latency = Date.now() - startTime;
  const inputTokens = JSON.stringify(messages).length / 4;
  const outputTokens = (result.response?.length || 0) / 4;
  return {
    id: crypto.randomUUID(), provider: 'cloudflare', model,
    content: result.response || '',
    usage: { promptTokens: Math.ceil(inputTokens), completionTokens: Math.ceil(outputTokens), totalTokens: Math.ceil(inputTokens + outputTokens) },
    finishReason: 'stop', latency, cached: false,
  };
}

export async function runWithRestAPI(
  accountId: string, apiKey: string, messages: Message[], options: CloudflareOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: formatMessagesForCloudflare(messages), max_tokens: options.maxTokens || 256, temperature: options.temperature }),
  });
  if (!response.ok) throw new Error(`Cloudflare API error: ${response.status}`);
  const data = (await response.json()) as { result: { response: string }; success: boolean };
  const latency = Date.now() - startTime;
  const inputTokens = JSON.stringify(messages).length / 4;
  const outputTokens = (data.result.response?.length || 0) / 4;
  return {
    id: crypto.randomUUID(), provider: 'cloudflare', model,
    content: data.result.response,
    usage: { promptTokens: Math.ceil(inputTokens), completionTokens: Math.ceil(outputTokens), totalTokens: Math.ceil(inputTokens + outputTokens) },
    finishReason: 'stop', latency, cached: false,
  };
}

export async function* streamWithRestAPI(
  accountId: string, apiKey: string, messages: Message[], options: CloudflareOptions = {}
): AsyncGenerator<string, void, unknown> {
  const model = options.model || DEFAULT_CLOUDFLARE_MODEL;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: formatMessagesForCloudflare(messages), max_tokens: options.maxTokens || 256, temperature: options.temperature, stream: true }),
  });
  if (!response.ok || !response.body) throw new Error(`Cloudflare stream error: ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try { const json = JSON.parse(trimmed.slice(6)); if (json.response) yield json.response; } catch { /* skip */ }
    }
  }
}

export function isWorkersEnvironment(): boolean {
  return typeof globalThis !== 'undefined' && 'caches' in globalThis;
}

export function createCloudflareProvider(config?: { accountId?: string; apiKey?: string; model?: CloudflareModel }): ProviderConfig {
  return {
    apiKey: config?.apiKey || '',
    baseUrl: config?.accountId ? `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai` : undefined,
    defaultModel: config?.model || DEFAULT_CLOUDFLARE_MODEL,
  };
}

export function getRecommendedModel(useCase: 'chat' | 'code' | 'reasoning' | 'creative' | 'vision' | 'efficient'): CloudflareModel {
  switch (useCase) {
    case 'efficient': return CLOUDFLARE_MODELS['granite-micro'];
    case 'chat': return CLOUDFLARE_MODELS['qwen3-30b'];
    case 'code': return CLOUDFLARE_MODELS['qwen3-30b'];
    case 'reasoning': return CLOUDFLARE_MODELS['deepseek-r1'];
    case 'creative': return CLOUDFLARE_MODELS['llama-3.3-70b'];
    case 'vision': return CLOUDFLARE_MODELS['llama-3.2-11b-vision'];
    default: return DEFAULT_CLOUDFLARE_MODEL;
  }
}

export function getTierModel(tier: 'free' | 'pro' | 'enterprise'): CloudflareModel {
  switch (tier) {
    case 'free': return CLOUDFLARE_MODELS['granite-micro'];
    case 'pro': return CLOUDFLARE_MODELS['qwen3-30b'];
    case 'enterprise': return CLOUDFLARE_MODELS['llama-3.3-70b'];
    default: return DEFAULT_CLOUDFLARE_MODEL;
  }
}
