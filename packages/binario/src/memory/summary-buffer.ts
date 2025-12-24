// Summary Buffer Memory for Binario SDK
// Hybrid: keeps recent messages in buffer + summarizes older history

import type { Message } from '../types';
import type { 
  Memory, 
  MemoryStore, 
  SummaryBufferMemoryOptions, 
  SummarizableMemory,
  ConversationContext,
  StoredMessage 
} from './types';
import { 
  countMessagesTokens, 
  createStoredMessage,
  createContext,
  generateId,
  formatConversationForSummary,
  DEFAULT_SUMMARY_PROMPT,
  truncateMessages
} from './utils';
import { InMemoryStore } from './stores/in-memory';
import type { SummarizerFn } from './summary';

const DEFAULT_BUFFER_SIZE = 10;
const DEFAULT_SUMMARIZE_THRESHOLD = 2000;

/**
 * Summary Buffer Memory - Best of both worlds.
 * Keeps recent messages intact + summarizes older history.
 * 
 * Best for:
 * - Production chat applications
 * - Long conversations where recent context matters
 * - Balancing token usage with context quality
 * 
 * @example
 * ```ts
 * const memory = new SummaryBufferMemory({
 *   bufferSize: 10, // Keep last 10 messages
 *   summarizeThreshold: 2000, // Summarize when > 2000 tokens
 *   summarizer: async (messages, prompt) => {
 *     return await binario.chat([{ role: 'user', content: prompt }]).content;
 *   }
 * });
 * ```
 */
export class SummaryBufferMemory implements Memory, SummarizableMemory {
  readonly type = 'summary-buffer' as const;
  
  private store: MemoryStore;
  private conversationId: string;
  private bufferSize: number;
  private summarizeThreshold: number;
  private summaryPrompt: string;
  private summarizer?: SummarizerFn;
  private includeSystemMessages: boolean;

  constructor(options: SummaryBufferMemoryOptions & { 
    store?: MemoryStore;
    summarizer?: SummarizerFn;
  } = {}) {
    this.store = options.store ?? new InMemoryStore();
    this.conversationId = options.conversationId ?? generateId();
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.summarizeThreshold = options.summarizeThreshold ?? DEFAULT_SUMMARIZE_THRESHOLD;
    this.summaryPrompt = options.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT;
    this.summarizer = options.summarizer;
    this.includeSystemMessages = options.includeSystemMessages ?? true;
  }

  /** Set the summarizer function */
  setSummarizer(fn: SummarizerFn): void {
    this.summarizer = fn;
  }

  async add(message: Message): Promise<void> {
    const stored = createStoredMessage(message, this.conversationId);
    await this.store.addMessage(stored);
    await this.checkAndSummarize();
  }

  async addMany(messages: Message[]): Promise<void> {
    for (const message of messages) {
      const stored = createStoredMessage(message, this.conversationId);
      await this.store.addMessage(stored);
    }
    await this.checkAndSummarize();
  }

  async getMessages(): Promise<Message[]> {
    const stored = await this.store.getMessages(this.conversationId);
    const messages = this.extractMessages(stored);
    const summary = await this.getSummary();
    
    // Get buffer (recent messages)
    const buffer = messages.slice(-this.bufferSize);
    
    if (summary) {
      const summaryMsg: Message = {
        role: 'system',
        content: `Previous conversation summary:\n${summary}`,
      };
      
      // Get system messages
      const systemMessages = messages
        .slice(0, -this.bufferSize)
        .filter(m => m.role === 'system' && !m.content.startsWith('Previous conversation summary:'));
      
      return [...systemMessages, summaryMsg, ...buffer];
    }
    
    return messages;
  }

  async getContext(): Promise<ConversationContext> {
    const messages = await this.getMessages();
    const summary = await this.getSummary();
    return createContext(messages, summary);
  }

  async getContextWindow(maxTokens: number): Promise<ConversationContext> {
    const messages = await this.getMessages();
    const summary = await this.getSummary();
    const truncated = truncateMessages(messages, maxTokens, {
      keepSystemMessages: this.includeSystemMessages,
    });
    return createContext(truncated, summary);
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

  async getSummary(): Promise<string | null> {
    const metadata = await this.store.getMetadata(this.conversationId);
    return (metadata?.summary as string) ?? null;
  }

  async summarize(): Promise<string> {
    if (!this.summarizer) {
      throw new Error('No summarizer function provided. Set one with setSummarizer()');
    }

    const stored = await this.store.getMessages(this.conversationId);
    const messages = this.extractMessages(stored);
    
    // Messages outside the buffer
    const toSummarize = messages.slice(0, -this.bufferSize);
    
    if (toSummarize.length === 0) {
      return '';
    }

    const existingSummary = await this.getSummary();
    const messagesForSummary = existingSummary 
      ? [{ role: 'system' as const, content: `Previous summary: ${existingSummary}` }, ...toSummarize]
      : toSummarize;

    const conversationText = formatConversationForSummary(messagesForSummary);
    const prompt = this.summaryPrompt.replace('{conversation}', conversationText);
    
    const summary = await this.summarizer(messagesForSummary, prompt);
    
    await this.store.setMetadata(this.conversationId, { summary });
    
    return summary;
  }

  /** Get buffer size */
  getBufferSize(): number {
    return this.bufferSize;
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

  private async checkAndSummarize(): Promise<void> {
    if (!this.summarizer) return;

    const stored = await this.store.getMessages(this.conversationId);
    const messages = this.extractMessages(stored);
    
    // Only summarize if we have more messages than buffer size
    if (messages.length <= this.bufferSize) return;
    
    const tokenCount = await this.getTokenCount();
    
    if (tokenCount > this.summarizeThreshold) {
      // Get messages to keep in buffer
      const buffer = messages.slice(-this.bufferSize);
      const toSummarize = messages.slice(0, -this.bufferSize);
      
      if (toSummarize.length > 0) {
        const existingSummary = await this.getSummary();
        
        const messagesForSummary = existingSummary 
          ? [{ role: 'system' as const, content: `Previous summary: ${existingSummary}` }, ...toSummarize]
          : toSummarize;
        
        const conversationText = formatConversationForSummary(messagesForSummary);
        const prompt = this.summaryPrompt.replace('{conversation}', conversationText);
        const summary = await this.summarizer(messagesForSummary, prompt);
        
        // Clear and re-add only buffer messages
        await this.store.clear(this.conversationId);
        await this.store.setMetadata(this.conversationId, { summary });
        
        for (const message of buffer) {
          const storedMsg = createStoredMessage(message, this.conversationId);
          await this.store.addMessage(storedMsg);
        }
      }
    }
  }
}

/** Create a new summary buffer memory instance */
export function createSummaryBufferMemory(
  options: SummaryBufferMemoryOptions & { 
    store?: MemoryStore;
    summarizer?: SummarizerFn;
  } = {}
): SummaryBufferMemory {
  return new SummaryBufferMemory(options);
}
