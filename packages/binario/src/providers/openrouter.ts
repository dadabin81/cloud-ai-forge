// OpenRouter Provider for Binario
// Access to free and paid models from multiple providers

import type { Message, ChatResponse, ProviderConfig, Tool } from '../types';

/**
 * OpenRouter configuration
 */
export interface OpenRouterConfig extends ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  siteUrl?: string;
  siteName?: string;
  defaultModel?: string;
}

/**
 * OpenRouter models - includes many free options
 */
export const OPENROUTER_MODELS = {
  // Free models (unlimited)
  free: {
    'llama-3-8b': 'meta-llama/llama-3-8b-instruct:free',
    'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct:free',
    'gemma-7b': 'google/gemma-7b-it:free',
    'mistral-7b': 'mistralai/mistral-7b-instruct:free',
    'phi-3-mini': 'microsoft/phi-3-mini-128k-instruct:free',
    'qwen2-7b': 'qwen/qwen-2-7b-instruct:free',
    'deepseek-coder': 'deepseek/deepseek-coder-6.7b-instruct:free',
    'toppy-m-7b': 'undi95/toppy-m-7b:free',
    'mythomax-l2-13b': 'gryphe/mythomax-l2-13b:free',
    'zephyr-7b': 'huggingfaceh4/zephyr-7b-beta:free',
  },
  // Paid models
  paid: {
    // OpenAI
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-4-turbo': 'openai/gpt-4-turbo',
    // Anthropic
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3-opus': 'anthropic/claude-3-opus',
    'claude-3-haiku': 'anthropic/claude-3-haiku',
    // Google
    'gemini-pro': 'google/gemini-pro',
    'gemini-2.0-flash': 'google/gemini-2.0-flash-exp',
    // Meta
    'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
    'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct',
    // Mistral
    'mistral-large': 'mistralai/mistral-large',
    'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct',
    // DeepSeek
    'deepseek-chat': 'deepseek/deepseek-chat',
    'deepseek-r1': 'deepseek/deepseek-r1',
  },
} as const;

/**
 * Default free model
 */
export const DEFAULT_FREE_MODEL = OPENROUTER_MODELS.free['llama-3.1-8b'];

/**
 * OpenRouter API response type
 */
interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Create OpenRouter provider configuration
 */
export function createOpenRouterProvider(config: {
  apiKey: string;
  defaultModel?: string;
  siteUrl?: string;
  siteName?: string;
}): OpenRouterConfig {
  return {
    apiKey: config.apiKey,
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: config.defaultModel || DEFAULT_FREE_MODEL,
    siteUrl: config.siteUrl,
    siteName: config.siteName,
    headers: {
      'HTTP-Referer': config.siteUrl || '',
      'X-Title': config.siteName || 'Binario App',
    },
  };
}

/**
 * Format messages for OpenRouter API
 */
function formatMessages(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * Run inference with OpenRouter API
 */
export async function runWithOpenRouter(
  messages: Message[],
  config: OpenRouterConfig,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: Tool[];
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  } = {}
): Promise<ChatResponse> {
  const startTime = Date.now();

  const body: Record<string, unknown> = {
    model: options.model || config.defaultModel || DEFAULT_FREE_MODEL,
    messages: formatMessages(messages),
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature ?? 0.7,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice || 'auto';
  }

  const response = await fetch(`${config.baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const choice = data.choices[0];

  return {
    id: data.id,
    provider: 'openrouter' as any,
    model: data.model,
    content: choice.message.content,
    toolCalls: choice.message.tool_calls,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    finishReason: choice.finish_reason as ChatResponse['finishReason'],
    latency: Date.now() - startTime,
    cached: false,
  };
}

/**
 * Stream inference with OpenRouter API
 */
export async function* streamWithOpenRouter(
  messages: Message[],
  config: OpenRouterConfig,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const body: Record<string, unknown> = {
    model: options.model || config.defaultModel || DEFAULT_FREE_MODEL,
    messages: formatMessages(messages),
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature ?? 0.7,
    stream: true,
  };

  const response = await fetch(`${config.baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    throw new Error(`OpenRouter stream error: ${response.status} - ${error}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Ignore parse errors for partial chunks
      }
    }
  }
}

/**
 * Get list of free models
 */
export function getFreeModels(): string[] {
  return Object.values(OPENROUTER_MODELS.free);
}

/**
 * Check if a model is free
 */
export function isModelFree(model: string): boolean {
  return model.endsWith(':free') || Object.values(OPENROUTER_MODELS.free).includes(model as any);
}

/**
 * Get recommended model based on use case
 */
export function getRecommendedOpenRouterModel(useCase: 'chat' | 'code' | 'reasoning' | 'creative'): string {
  switch (useCase) {
    case 'chat':
      return OPENROUTER_MODELS.free['llama-3.1-8b'];
    case 'code':
      return OPENROUTER_MODELS.free['deepseek-coder'];
    case 'reasoning':
      return OPENROUTER_MODELS.free['mistral-7b'];
    case 'creative':
      return OPENROUTER_MODELS.free['mythomax-l2-13b'];
    default:
      return DEFAULT_FREE_MODEL;
  }
}

/**
 * Model info for display
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  free: boolean;
  description: string;
}

/**
 * Get model information
 */
export function getModelInfo(modelId: string): ModelInfo | null {
  const freeModels: Record<string, ModelInfo> = {
    'meta-llama/llama-3.1-8b-instruct:free': {
      id: 'meta-llama/llama-3.1-8b-instruct:free',
      name: 'Llama 3.1 8B',
      provider: 'Meta',
      contextLength: 131072,
      free: true,
      description: 'Excellent all-around model for chat and reasoning',
    },
    'google/gemma-7b-it:free': {
      id: 'google/gemma-7b-it:free',
      name: 'Gemma 7B',
      provider: 'Google',
      contextLength: 8192,
      free: true,
      description: 'Fast and efficient for general tasks',
    },
    'mistralai/mistral-7b-instruct:free': {
      id: 'mistralai/mistral-7b-instruct:free',
      name: 'Mistral 7B',
      provider: 'Mistral AI',
      contextLength: 32768,
      free: true,
      description: 'Strong reasoning and instruction following',
    },
    'deepseek/deepseek-coder-6.7b-instruct:free': {
      id: 'deepseek/deepseek-coder-6.7b-instruct:free',
      name: 'DeepSeek Coder 6.7B',
      provider: 'DeepSeek',
      contextLength: 16384,
      free: true,
      description: 'Specialized for code generation and explanation',
    },
  };

  return freeModels[modelId] || null;
}
