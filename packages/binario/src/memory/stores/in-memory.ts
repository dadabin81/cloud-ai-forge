// In-Memory Store for Binario Memory System

import type { MemoryStore, StoredMessage } from '../types';

/**
 * In-memory store for development and testing.
 * Data is lost when the process ends.
 */
export class InMemoryStore implements MemoryStore {
  private messages: Map<string, StoredMessage[]> = new Map();
  private metadata: Map<string, Record<string, unknown>> = new Map();

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    return this.messages.get(conversationId) ?? [];
  }

  async addMessage(message: StoredMessage): Promise<void> {
    const messages = this.messages.get(message.conversationId) ?? [];
    messages.push(message);
    this.messages.set(message.conversationId, messages);
  }

  async updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void> {
    for (const [conversationId, messages] of this.messages) {
      const index = messages.findIndex(m => m.id === id);
      if (index !== -1) {
        messages[index] = { ...messages[index], ...updates };
        this.messages.set(conversationId, messages);
        return;
      }
    }
  }

  async deleteMessage(id: string): Promise<void> {
    for (const [conversationId, messages] of this.messages) {
      const filtered = messages.filter(m => m.id !== id);
      if (filtered.length !== messages.length) {
        this.messages.set(conversationId, filtered);
        return;
      }
    }
  }

  async clear(conversationId: string): Promise<void> {
    this.messages.delete(conversationId);
    this.metadata.delete(conversationId);
  }

  async getMetadata(conversationId: string): Promise<Record<string, unknown> | null> {
    return this.metadata.get(conversationId) ?? null;
  }

  async setMetadata(conversationId: string, metadata: Record<string, unknown>): Promise<void> {
    this.metadata.set(conversationId, metadata);
  }

  /** Clear all data (useful for testing) */
  clearAll(): void {
    this.messages.clear();
    this.metadata.clear();
  }

  /** Get all conversation IDs */
  getConversationIds(): string[] {
    return Array.from(this.messages.keys());
  }
}

/** Create a new in-memory store */
export function createInMemoryStore(): InMemoryStore {
  return new InMemoryStore();
}
