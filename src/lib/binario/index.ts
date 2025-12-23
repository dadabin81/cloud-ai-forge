// Binario SDK - Main Export

// Core
export { BinarioAI, createBinario } from './core';

// React Hooks
export {
  useBinarioChat,
  useBinarioStream,
  useBinarioCompletion,
  useBinarioAgent,
  useBinarioStructured,
  useBinarioTools,
} from './hooks';

// Agent Framework
export { Agent, createAgent, defineTool } from './agent';

// Schema System (Pydantic-style)
export { createSchema, zodToJsonSchema, createTool, parseStructuredOutput, z } from './schema';
export type { InferSchema } from './schema';

// Providers
export { 
  CLOUDFLARE_MODELS, 
  DEFAULT_CLOUDFLARE_MODEL,
  NEURON_COSTS,
  FREE_NEURONS_PER_DAY,
  runWithBinding,
  runWithRestAPI,
  streamWithRestAPI,
  calculateNeurons,
  estimateFreeTokens,
  supportsToolCalling,
  getRecommendedModel,
} from './providers/cloudflare';

export {
  createLovableProvider,
  streamWithLovable,
  LOVABLE_MODELS,
} from './providers/lovable';

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
} from './types';
