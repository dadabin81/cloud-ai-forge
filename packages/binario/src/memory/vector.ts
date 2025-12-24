// Vector Memory for Binario SDK
// Semantic search using embeddings

import type { Message } from '../types';
import type { 
  Memory, 
  MemoryStore, 
  VectorMemoryOptions, 
  SearchableMemory,
  ConversationContext,
  StoredMessage,
  SearchResult
} from './types';
import type { EmbeddingsProvider } from '../embeddings/types';
import { 
  countMessagesTokens, 
  createStoredMessage,
  createContext,
  generateId,
  cosineSimilarity,
  truncateMessages
} from './utils';
import { InMemoryStore } from './stores/in-memory';

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.5;

/**
 * Vector Memory - Semantic search using embeddings.
 * Retrieves the most relevant messages based on similarity.
 * 
 * Best for:
 * - Very long conversations
 * - Finding relevant context from history
 * - RAG-like applications
 * 
 * @example
 * ```ts
 * const memory = new VectorMemory({
 *   embeddings: new CloudflareEmbeddings({ binding: env.AI }),
 *   topK: 5,
 *   minScore: 0.7
 * });
 * 
 * await memory.add({ role: 'user', content: 'I love pizza' });
 * const results = await memory.search('What food do I like?');
 * // Returns the pizza message with high similarity score
 * ```
 */
export class VectorMemory implements Memory, SearchableMemory {
  readonly type = 'vector' as const;
  
  private store: MemoryStore;
  private embeddings: EmbeddingsProvider;
  private conversationId: string;
  private topK: number;
  private minScore: number;
  private maxMessages?: number;
  private maxTokens?: number;
  private includeSystemMessages: boolean;

  constructor(options: VectorMemoryOptions & { 
    store?: MemoryStore;
    embeddings: EmbeddingsProvider;
  }) {
    if (!options.embeddings) {
      throw new Error('VectorMemory requires an embeddings provider');
    }
    
    this.store = options.store ?? new InMemoryStore();
    this.embeddings = options.embeddings;
    this.conversationId = options.conversationId ?? generateId();
    this.topK = options.topK ?? DEFAULT_TOP_K;
    this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    this.maxMessages = options.maxMessages;
    this.maxTokens = options.maxTokens;
    this.includeSystemMessages = options.includeSystemMessages ?? true;
  }

  async add(message: Message): Promise<void> {
    // Generate embedding for the message
    const { embedding } = await this.embeddings.embed(message.content);
    
    const stored = createStoredMessage(message, this.conversationId, {
      embedding,
    });
    
    await this.store.addMessage(stored);
  }

  async addMany(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;
    
    // Batch embed all messages
    const texts = messages.map(m => m.content);
    const { embeddings } = await this.embeddings.embedMany(texts);
    
    for (let i = 0; i < messages.length; i++) {
      const stored = createStoredMessage(messages[i], this.conversationId, {
        embedding: embeddings[i].embedding,
      });
      await this.store.addMessage(stored);
    }
  }

  async getMessages(): Promise<Message[]> {
    const stored = await this.store.getMessages(this.conversationId);
    return this.extractMessages(stored);
  }

  async getContext(): Promise<ConversationContext> {
    const messages = await this.getMessages();
    return createContext(messages);
  }

  async getContextWindow(maxTokens: number): Promise<ConversationContext> {
    const messages = await this.getMessages();
    const truncated = truncateMessages(messages, maxTokens, {
      keepSystemMessages: this.includeSystemMessages,
    });
    return createContext(truncated);
  }

  async clear(): Promise<void> {
    await this.store.clear(this.conversationId);
  }

  async getMessageCount(): Promise<number> {
    const stored = await this.store.getMessages(this.conversationId);
    return stored.length;
  }

  async getTokenCount(): Promise<number> {
    const messages = await this.getMessages();
    return countMessagesTokens(messages);
  }

  async search(query: string, topK?: number): Promise<SearchResult[]> {
    const k = topK ?? this.topK;
    
    // Get query embedding
    const { embedding: queryEmbedding } = await this.embeddings.embed(query);
    
    // Get all stored messages
    const stored = await this.store.getMessages(this.conversationId);
    
    // Calculate similarity for each message
    const results: SearchResult[] = [];
    
    for (const msg of stored) {
      if (!msg.embedding) continue;
      
      const score = cosineSimilarity(queryEmbedding, msg.embedding);
      
      if (score >= this.minScore) {
        results.push({ message: msg, score });
      }
    }
    
    // Sort by score (highest first) and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** 
   * Get relevant context for a query.
   * Returns messages most semantically similar to the query.
   */
  async getRelevantContext(query: string, topK?: number): Promise<Message[]> {
    const results = await this.search(query, topK);
    
    // Sort by timestamp (oldest first) to maintain conversation order
    const sorted = results.sort((a, b) => a.message.timestamp - b.message.timestamp);
    
    return sorted.map(r => r.message.message);
  }

  /**
   * Build context with recent messages + relevant history.
   * Useful for including both recency and relevance.
   */
  async buildContext(
    query: string,
    options?: { recentCount?: number; relevantCount?: number }
  ): Promise<Message[]> {
    const { recentCount = 5, relevantCount = 3 } = options ?? {};
    
    const stored = await this.store.getMessages(this.conversationId);
    const messages = this.extractMessages(stored);
    
    // Get recent messages
    const recent = messages.slice(-recentCount);
    const recentIds = new Set(stored.slice(-recentCount).map(s => s.id));
    
    // Get relevant messages (excluding recent ones)
    const relevantResults = await this.search(query, relevantCount + recentCount);
    const relevant = relevantResults
      .filter(r => !recentIds.has(r.message.id))
      .slice(0, relevantCount)
      .sort((a, b) => a.message.timestamp - b.message.timestamp)
      .map(r => r.message.message);
    
    // Combine: relevant history + recent messages
    return [...relevant, ...recent];
  }

  /** Get the conversation ID */
  getConversationId(): string {
    return this.conversationId;
  }

  /** Switch to a different conversation */
  setConversationId(id: string): void {
    this.conversationId = id;
  }

  private extractMessages(stored: StoredMessage[]): Message[] {
    return stored
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(s => s.message);
  }
}

/** Create a new vector memory instance */
export function createVectorMemory(
  options: VectorMemoryOptions & { 
    store?: MemoryStore;
    embeddings: EmbeddingsProvider;
  }
): VectorMemory {
  return new VectorMemory(options);
}
