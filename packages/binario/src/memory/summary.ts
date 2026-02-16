// Summary Memory for Binario SDK
// Uses LLM to summarize conversation history

import type { Message } from '../types';
import type { 
  Memory, 
  MemoryStore, 
  SummaryMemoryOptions, 
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

const DEFAULT_SUMMARIZE_THRESHOLD = 2000; // tokens
const DEFAULT_SUMMARY_MODEL = 'google/gemini-2.5-flash';

/** Summarizer function type */
export type SummarizerFn = (messages: Message[], prompt: string) => Promise<string>;

/**
 * Summary Memory - Summarizes old conversation history.
 * 
 * Best for:
 * - Long conversations
 * - When you need to preserve context but reduce tokens
 * - Cost optimization
 * 
 * @example
 * ```ts
 * const memory = new SummaryMemory({
 *   summarizer: async (messages, prompt) => {
 *     const response = await binario.chat([
 *       { role: 'system', content: prompt },
 *       { role: 'user', content: formatConversation(messages) }
 *     ]);
 *     return response.content;
 *   }
 * });
 * ```
 */
export class SummaryMemory implements Memory, SummarizableMemory {
  readonly type = 'summary' as const;
  
  private store: MemoryStore;
  private conversationId: string;
  private summarizeThreshold: number;
  private summaryModel: string;
  private summaryPrompt: string;
  private summarizer?: SummarizerFn;
  private includeSystemMessages: boolean;

  constructor(options: SummaryMemoryOptions & { 
    store?: MemoryStore;
    summarizer?: SummarizerFn;
  } = {}) {
    this.store = options.store ?? new InMemoryStore();
    this.conversationId = options.conversationId ?? generateId();
    this.summarizeThreshold = options.summarizeThreshold ?? DEFAULT_SUMMARIZE_THRESHOLD;
    this.summaryModel = options.summaryModel ?? DEFAULT_SUMMARY_MODEL;
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
    
    // Check if we need to summarize
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
    
    if (summary) {
      // Prepend summary as system message
      const summaryMsg: Message = {
        role: 'system',
        content: `Previous conversation summary:\n${summary}`,
      };
      
      // Filter out old system summary messages
      const filtered = messages.filter(
        m => !(m.role === 'system' && m.content.startsWith('Previous conversation summary:'))
      );
      
      return [summaryMsg, ...filtered];
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
    
    if (messages.length === 0) {
      return '';
    }

    const conversationText = formatConversationForSummary(messages);
    const prompt = this.summaryPrompt.replace('{conversation}', conversationText);
    
    const summary = await this.summarizer(messages, prompt);
    
    // Store the summary
    await this.store.setMetadata(this.conversationId, { summary });
    
    return summary;
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

    const tokenCount = await this.getTokenCount();
    
    if (tokenCount > this.summarizeThreshold) {
      // Get current messages
      const stored = await this.store.getMessages(this.conversationId);
      const messages = this.extractMessages(stored);
      
      // Keep last few messages, summarize the rest
      const keepCount = Math.max(4, Math.floor(messages.length / 4));
      const toSummarize = messages.slice(0, -keepCount);
      const toKeep = messages.slice(-keepCount);
      
      if (toSummarize.length > 0) {
        // Get existing summary
        const existingSummary = await this.getSummary();
        
        // Create messages to summarize including existing summary
        const messagesForSummary = existingSummary 
          ? [{ role: 'system' as const, content: `Previous summary: ${existingSummary}` }, ...toSummarize]
          : toSummarize;
        
        // Generate new summary
        const conversationText = formatConversationForSummary(messagesForSummary);
        const prompt = this.summaryPrompt.replace('{conversation}', conversationText);
        const summary = await this.summarizer(messagesForSummary, prompt);
        
        // Clear and re-add only kept messages
        await this.store.clear(this.conversationId);
        await this.store.setMetadata(this.conversationId, { summary });
        
        for (const message of toKeep) {
          const storedMsg = createStoredMessage(message, this.conversationId);
          await this.store.addMessage(storedMsg);
        }
      }
    }
  }
}

/** Create a new summary memory instance */
export function createSummaryMemory(
  options: SummaryMemoryOptions & { 
    store?: MemoryStore;
    summarizer?: SummarizerFn;
  } = {}
): SummaryMemory {
  return new SummaryMemory(options);
}
