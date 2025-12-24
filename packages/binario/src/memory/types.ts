// Memory System Types for Binario SDK

import type { Message } from '../types';

/** Base configuration for all memory types */
export interface MemoryOptions {
  /** Maximum number of messages to keep */
  maxMessages?: number;
  /** Maximum tokens to keep in context */
  maxTokens?: number;
  /** Conversation ID for multi-conversation support */
  conversationId?: string;
  /** Include system messages in memory */
  includeSystemMessages?: boolean;
}

/** Configuration for buffer memory */
export interface BufferMemoryOptions extends MemoryOptions {
  /** Strategy for trimming: 'fifo' (first-in-first-out) or 'sliding' */
  strategy?: 'fifo' | 'sliding';
}

/** Configuration for summary memory */
export interface SummaryMemoryOptions extends MemoryOptions {
  /** Token threshold before summarizing */
  summarizeThreshold?: number;
  /** Model to use for summarization */
  summaryModel?: string;
  /** Custom summarization prompt */
  summaryPrompt?: string;
}

/** Configuration for summary-buffer hybrid memory */
export interface SummaryBufferMemoryOptions extends SummaryMemoryOptions {
  /** Number of recent messages to keep in buffer */
  bufferSize?: number;
}

/** Configuration for vector memory */
export interface VectorMemoryOptions extends MemoryOptions {
  /** Number of relevant messages to retrieve */
  topK?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
  /** Embedding model to use */
  embeddingModel?: string;
}

/** Stored message with metadata */
export interface StoredMessage {
  id: string;
  message: Message;
  timestamp: number;
  conversationId: string;
  tokenCount?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/** Conversation context for LLM */
export interface ConversationContext {
  messages: Message[];
  summary?: string;
  tokenCount: number;
  messageCount: number;
}

/** Search result from vector memory */
export interface SearchResult {
  message: StoredMessage;
  score: number;
}

/** Memory store interface for persistence */
export interface MemoryStore {
  /** Get all messages for a conversation */
  getMessages(conversationId: string): Promise<StoredMessage[]>;
  
  /** Add a message to storage */
  addMessage(message: StoredMessage): Promise<void>;
  
  /** Update an existing message */
  updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void>;
  
  /** Delete a message */
  deleteMessage(id: string): Promise<void>;
  
  /** Clear all messages for a conversation */
  clear(conversationId: string): Promise<void>;
  
  /** Get conversation metadata (e.g., summary) */
  getMetadata(conversationId: string): Promise<Record<string, unknown> | null>;
  
  /** Set conversation metadata */
  setMetadata(conversationId: string, metadata: Record<string, unknown>): Promise<void>;
}

/** Base memory interface */
export interface Memory {
  /** Memory type identifier */
  readonly type: 'buffer' | 'summary' | 'summary-buffer' | 'vector';
  
  /** Add a message to memory */
  add(message: Message): Promise<void>;
  
  /** Add multiple messages at once */
  addMany(messages: Message[]): Promise<void>;
  
  /** Get messages formatted for LLM context */
  getMessages(): Promise<Message[]>;
  
  /** Get full context including summary and token info */
  getContext(): Promise<ConversationContext>;
  
  /** Get context window limited by tokens */
  getContextWindow(maxTokens: number): Promise<ConversationContext>;
  
  /** Clear all memory */
  clear(): Promise<void>;
  
  /** Get current message count */
  getMessageCount(): Promise<number>;
  
  /** Get estimated token count */
  getTokenCount(): Promise<number>;
}

/** Memory with search capability (for vector memory) */
export interface SearchableMemory extends Memory {
  /** Search for relevant messages */
  search(query: string, topK?: number): Promise<SearchResult[]>;
}

/** Memory with summarization capability */
export interface SummarizableMemory extends Memory {
  /** Get or generate summary of conversation */
  getSummary(): Promise<string | null>;
  
  /** Force regenerate summary */
  summarize(): Promise<string>;
}

/** Factory options for creating memory instances */
export interface CreateMemoryOptions {
  type: 'buffer' | 'summary' | 'summary-buffer' | 'vector';
  store?: MemoryStore;
  options?: MemoryOptions;
}
