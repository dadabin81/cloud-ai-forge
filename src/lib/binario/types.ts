// Binario SDK Types
import type { z } from 'zod';

export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere' | 'cloudflare';

export type CloudflareModel =
  | '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  | '@cf/meta/llama-3.2-11b-vision-instruct'
  | '@cf/meta/llama-3.1-8b-instruct-fp8-fast'
  | '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
  | string;

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  images?: string[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Tool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface ChatOptions {
  provider?: Provider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  outputSchema?: z.ZodType<unknown>;
}

export interface ChatResponse {
  id: string;
  provider: Provider;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  latency: number;
  cached: boolean;
  data?: unknown;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  binding?: unknown;
  accountId?: string;
}

export interface BinarioConfig {
  providers: Partial<Record<Provider, ProviderConfig>>;
  defaultProvider?: Provider;
  cache?: { enabled: boolean; ttl?: number; maxSize?: number };
  retry?: { maxRetries: number; backoff: 'linear' | 'exponential'; initialDelay: number };
  timeout?: number;
  debug?: boolean;
}

export type NexusConfig = BinarioConfig;

export interface StructuredOutputSchema<T = unknown> {
  name: string;
  description?: string;
  schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  parse: (json: string) => T;
}

export interface EmbeddingOptions { model?: string; dimensions?: number; }
export interface EmbeddingResponse { embeddings: number[][]; model: string; usage: { promptTokens: number; totalTokens: number } }

export interface AgentTool<TContext = unknown, TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs, context: TContext) => Promise<TResult> | TResult;
}

export interface AgentConfig<TContext = unknown, TDeps = unknown> {
  name?: string;
  model?: string;
  provider?: Provider;
  systemPrompt?: string | ((context: TContext) => string);
  tools?: AgentTool<TContext>[];
  maxIterations?: number;
  dependencies?: TDeps;
  outputSchema?: z.ZodType<unknown>;
}

export interface AgentRunOptions {
  maxIterations?: number;
  onToolCall?: (tool: string, args: unknown, result: unknown) => void;
  onThinking?: (content: string) => void;
  signal?: AbortSignal;
}

export interface AgentResult<T = string> {
  output: T;
  messages: Message[];
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  iterations: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}
