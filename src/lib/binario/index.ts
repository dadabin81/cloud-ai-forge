// Binario SDK - Main Export

// Simplified Client (SaaS)
export { Binario, BinarioAgent, createBinarioClient, BinarioRateLimitError, BinarioPaymentError } from './client';
export type { BinarioOptions, StreamOptions, AgentOptions, UsageInfo } from './client';

// Core (Self-hosted)
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

// Dependency Injection
export { createDeps, createScope, runtimeDep, createRequestContext, DepsConfigSchema } from './deps';
export type { DepsContainer, DepsScope, RuntimeDep, RequestContext, DepsConfig } from './deps';

// Observability
export { createObservability, consoleHooks, ObservabilityManager } from './observability';
export type { ObservabilityHooks, Span, SpanEvent, Metrics, LogEntry, LogLevel } from './observability';

// Usage Tracking
export { createUsageTracker, UsageTracker, FREE_FALLBACK_MODELS, DEFAULT_FALLBACK_CONFIG } from './usage';
export type { UsageRecord, DailyUsage, UsageReport, FallbackConfig } from './usage';

// Providers - Cloudflare (with @cloudflare/ai-utils integration)
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
  // New: @cloudflare/ai-utils compatible exports
  runWithTools,
  runWithToolsTracked,
  tool,
  autoTrimTools,
} from './providers/cloudflare';

// OpenAPI Agent Builder
export { createOpenAPIAgent, createMultiAPIAgent } from './cloudflare/openapi-agent';

// Providers - Lovable
export {
  createLovableProvider,
  streamWithLovable,
  LOVABLE_MODELS,
} from './providers/lovable';

// Providers - OpenRouter
export {
  createOpenRouterProvider,
  runWithOpenRouter,
  streamWithOpenRouter,
  OPENROUTER_MODELS,
  DEFAULT_FREE_MODEL,
  getFreeModels,
  isModelFree,
  getRecommendedOpenRouterModel,
} from './providers/openrouter';

// Cloudflare Worker Utilities
export {
  createWorkerHandler,
  SessionManager,
  DatabaseManager,
  StorageManager,
  corsHeaders,
  handleCors,
  jsonResponse,
  streamResponse,
  errorResponse,
} from './cloudflare/worker-template';

export {
  generateWranglerConfig,
  generateEnvTypes,
  generateWorkerEntry,
  generatePackageScripts,
  generateD1Schema,
  generateProjectStructure,
  getProjectSetupCommands,
} from './cloudflare/generate-config';

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
