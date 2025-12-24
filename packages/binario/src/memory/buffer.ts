// Buffer Memory for Binario SDK
// Simple sliding window memory that keeps the most recent messages

import type { Message } from '../types';
import type { 
  Memory, 
  MemoryStore, 
  BufferMemoryOptions, 
  ConversationContext,
  StoredMessage 
} from './types';
import { 
  countMessagesTokens, 
  truncateMessages, 
  truncateMessagesByCount,
  createStoredMessage,
  createContext,
  generateId
} from './utils';
import { InMemoryStore } from './stores/in-memory';

const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Buffer Memory - Sliding window of recent messages.
 * 
 * Best for:
 * - Simple chat applications
 * - Short conversations
 * - When you don't need long-term context
 * 
 * @example
 * ```ts
 * const memory = new BufferMemory({ maxMessages: 20 });
 * await memory.add({ role: 'user', content: 'Hello!' });
 * const messages = await memory.getMessages();
 * ```
 */
export class BufferMemory implements Memory {
  readonly type = 'buffer' as const;
  
  private store: MemoryStore;
  private conversationId: string;
  private maxMessages: number;
  private maxTokens: number;
  private includeSystemMessages: boolean;
  private strategy: 'fifo' | 'sliding';

  constructor(options: BufferMemoryOptions & { store?: MemoryStore } = {}) {
    this.store = options.store ?? new InMemoryStore();
    this.conversationId = options.conversationId ?? generateId();
    this.maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.includeSystemMessages = options.includeSystemMessages ?? true;
    this.strategy = options.strategy ?? 'sliding';
  }

  async add(message: Message): Promise<void> {
    const stored = createStoredMessage(message, this.conversationId);
    await this.store.addMessage(stored);
    await this.trim();
  }

  async addMany(messages: Message[]): Promise<void> {
    for (const message of messages) {
      const stored = createStoredMessage(message, this.conversationId);
      await this.store.addMessage(stored);
    }
    await this.trim();
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

  private async trim(): Promise<void> {
    const stored = await this.store.getMessages(this.conversationId);
    const messages = this.extractMessages(stored);
    
    // First, trim by message count
    let trimmed = truncateMessagesByCount(messages, this.maxMessages, {
      keepSystemMessages: this.includeSystemMessages,
    });
    
    // Then, trim by token count
    trimmed = truncateMessages(trimmed, this.maxTokens, {
      keepSystemMessages: this.includeSystemMessages,
    });
    
    // If we trimmed, update the store
    if (trimmed.length < messages.length) {
      await this.store.clear(this.conversationId);
      for (const message of trimmed) {
        const storedMsg = createStoredMessage(message, this.conversationId);
        await this.store.addMessage(storedMsg);
      }
    }
  }
}

/** Create a new buffer memory instance */
export function createBufferMemory(
  options: BufferMemoryOptions & { store?: MemoryStore } = {}
): BufferMemory {
  return new BufferMemory(options);
}
