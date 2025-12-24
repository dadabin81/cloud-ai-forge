// LocalStorage Store for Binario Memory System

import type { MemoryStore, StoredMessage } from '../types';

const MESSAGES_PREFIX = 'binario:memory:messages:';
const METADATA_PREFIX = 'binario:memory:metadata:';

/**
 * LocalStorage-based store for browser environments.
 * Data persists across page reloads.
 */
export class LocalStorageStore implements MemoryStore {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private getMessagesKey(conversationId: string): string {
    return `${MESSAGES_PREFIX}${this.prefix}${conversationId}`;
  }

  private getMetadataKey(conversationId: string): string {
    return `${METADATA_PREFIX}${this.prefix}${conversationId}`;
  }

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    const storage = this.getStorage();
    if (!storage) return [];

    try {
      const data = storage.getItem(this.getMessagesKey(conversationId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async addMessage(message: StoredMessage): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    const messages = await this.getMessages(message.conversationId);
    messages.push(message);
    
    try {
      storage.setItem(
        this.getMessagesKey(message.conversationId),
        JSON.stringify(messages)
      );
    } catch (e) {
      // Handle quota exceeded
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        // Remove oldest messages and retry
        const trimmed = messages.slice(-Math.floor(messages.length / 2));
        storage.setItem(
          this.getMessagesKey(message.conversationId),
          JSON.stringify(trimmed)
        );
      }
    }
  }

  async updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    // We need to search all conversations since we don't know which one has this message
    const keys = Object.keys(storage).filter(k => k.startsWith(MESSAGES_PREFIX + this.prefix));
    
    for (const key of keys) {
      try {
        const data = storage.getItem(key);
        if (!data) continue;
        
        const messages: StoredMessage[] = JSON.parse(data);
        const index = messages.findIndex(m => m.id === id);
        
        if (index !== -1) {
          messages[index] = { ...messages[index], ...updates };
          storage.setItem(key, JSON.stringify(messages));
          return;
        }
      } catch {
        continue;
      }
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    const keys = Object.keys(storage).filter(k => k.startsWith(MESSAGES_PREFIX + this.prefix));
    
    for (const key of keys) {
      try {
        const data = storage.getItem(key);
        if (!data) continue;
        
        const messages: StoredMessage[] = JSON.parse(data);
        const filtered = messages.filter(m => m.id !== id);
        
        if (filtered.length !== messages.length) {
          storage.setItem(key, JSON.stringify(filtered));
          return;
        }
      } catch {
        continue;
      }
    }
  }

  async clear(conversationId: string): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    storage.removeItem(this.getMessagesKey(conversationId));
    storage.removeItem(this.getMetadataKey(conversationId));
  }

  async getMetadata(conversationId: string): Promise<Record<string, unknown> | null> {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const data = storage.getItem(this.getMetadataKey(conversationId));
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async setMetadata(conversationId: string, metadata: Record<string, unknown>): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    storage.setItem(this.getMetadataKey(conversationId), JSON.stringify(metadata));
  }

  /** Clear all binario memory data */
  clearAll(): void {
    const storage = this.getStorage();
    if (!storage) return;

    const keysToRemove = Object.keys(storage).filter(
      k => k.startsWith(MESSAGES_PREFIX + this.prefix) || k.startsWith(METADATA_PREFIX + this.prefix)
    );
    
    keysToRemove.forEach(key => storage.removeItem(key));
  }

  /** Get all conversation IDs */
  getConversationIds(): string[] {
    const storage = this.getStorage();
    if (!storage) return [];

    const prefix = MESSAGES_PREFIX + this.prefix;
    return Object.keys(storage)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
}

/** Create a new localStorage store */
export function createLocalStorageStore(prefix: string = ''): LocalStorageStore {
  return new LocalStorageStore(prefix);
}
