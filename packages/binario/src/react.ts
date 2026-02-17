// Binario SDK - React Hooks Entry Point
// Import with: import { useBinarioChat, useChat } from 'binario/react'

// ============= Self-Hosted Hooks (BinarioAI core) =============
export {
  useBinarioChat,
  useBinarioStream,
  useBinarioCompletion,
  useBinarioAgent,
  useBinarioStructured,
  useBinarioTools,
  useBinarioMemory,
  useBinarioChatWithMemory,
  useBinarioEmbed,
  useBinarioSemanticSearch,
} from './hooks';

export type {
  UseBinarioChatOptions,
  UseBinarioChatReturn,
  UseBinarioStreamOptions,
  UseBinarioStreamReturn,
  UseBinarioCompletionOptions,
  UseBinarioAgentOptions,
  UseBinarioAgentReturn,
  UseBinarioStructuredOptions,
  UseBinarioStructuredReturn,
  UseBinarioToolsOptions,
  UseBinarioToolsReturn,
  UseBinarioMemoryOptions,
  UseBinarioMemoryReturn,
  UseBinarioChatWithMemoryOptions,
  UseBinarioChatWithMemoryReturn,
  UseBinarioEmbedOptions,
  UseBinarioEmbedReturn,
  UseBinarioSemanticSearchOptions,
  UseBinarioSemanticSearchReturn,
  SearchDocument,
  SearchResult,
  HookTool,
  MemoryType,
  EmbeddingsProviderType,
} from './hooks';

// ============= SaaS Client Hooks (Binario API key) =============
export {
  BinarioProvider,
  useBinarioClient,
  useChat,
  useStream,
  useAgent,
  useUsage,
} from './client-hooks';

export type {
  BinarioProviderProps,
  UseChatOptions,
  UseChatReturn,
  UseStreamOptions,
  UseStreamReturn,
  UseAgentOptions,
  UseAgentReturn,
  UseUsageReturn,
} from './client-hooks';
