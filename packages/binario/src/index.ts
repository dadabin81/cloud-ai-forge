// Binario SDK v0.3.0 - Main Entry Point
// Now with Agents SDK, MCP, and media service support

// Client (SaaS) - Primary API
export { Binario, BinarioAgent, createBinarioClient, BinarioRateLimitError, BinarioPaymentError } from './client';
export type { BinarioOptions, ChatOptions as ClientChatOptions, StreamOptions, AgentOptions, UsageInfo } from './client';

// Core (Self-hosted)
export { BinarioAI, createBinario } from './core';

// Agent Framework
export { Agent, createAgent, defineTool } from './agent';

// Schema System (Pydantic-style)
export { createSchema, zodToJsonSchema, createTool, parseStructuredOutput, z } from './schema';

// Memory System
export * from './memory';

// Embeddings
export * from './embeddings';

// React Hooks - Self-hosted
export { useBinarioAgent } from './hooks';
export type { UseBinarioAgentOptions, UseBinarioAgentReturn } from './hooks';

// React Hooks - SaaS Client
export { useChat, useStream, useAgent, useUsage, BinarioProvider, useBinarioClient } from './client-hooks';
export type { UseChatOptions, UseChatReturn, UseStreamOptions, UseStreamReturn, UseAgentOptions, UseAgentReturn, UseUsageReturn } from './client-hooks';

// Cloudflare Agents SDK helpers
export { createBinarioAgentConfig } from './cloudflare';

// Observability & Usage
export { consoleHooks } from './observability';
export type { ObservabilityHooks, RequestStartEvent, RequestEndEvent } from './observability';
export { createUsageTracker } from './usage';
export type { UsageTracker, TrackRequestParams } from './usage';

// Types
export type {
  Provider,
  Message,
  ChatOptions,
  ChatResponse,
  BinarioConfig,
  StreamCallbacks,
  ProviderConfig,
  Tool,
  ToolCall,
  StructuredOutputSchema,
  EmbeddingOptions,
  EmbeddingResponse,
  AgentConfig,
  AgentTool,
  AgentRunOptions,
  AgentResult,
  CloudflareModel,
} from './types';
