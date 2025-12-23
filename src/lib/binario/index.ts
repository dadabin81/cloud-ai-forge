// NexusAI SDK - Main Export

export { NexusAI, createNexus } from './core';
export { useNexusChat, useNexusStream, useNexusCompletion } from './hooks';
export type {
  Provider,
  Message,
  ChatOptions,
  ChatResponse,
  NexusConfig,
  StreamCallbacks,
  ProviderConfig,
  Tool,
  ToolCall,
  StructuredOutputSchema,
  EmbeddingOptions,
  EmbeddingResponse,
} from './types';
