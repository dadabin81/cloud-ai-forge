// Binario SDK - Main Entry Point

// Client (SaaS)
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
