// Binario SDK - React Hooks Entry Point
// Import with: import { useBinarioChat } from 'binario/react'

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
