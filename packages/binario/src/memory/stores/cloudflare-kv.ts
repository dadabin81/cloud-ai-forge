// Cloudflare KV Store for Binario Memory System

import type { MemoryStore, StoredMessage } from '../types';

/** KV Namespace interface (Cloudflare Workers) */
interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

const MESSAGES_PREFIX = 'messages:';
const METADATA_PREFIX = 'metadata:';

/**
 * Cloudflare KV-based store for Workers.
 * Provides persistent, globally distributed storage.
 */
export class CloudflareKVStore implements MemoryStore {
  private kv: KVNamespace;
  private ttl?: number;

  /**
   * @param kv - Cloudflare KV namespace binding
   * @param ttl - Optional TTL in seconds for automatic expiration
   */
  constructor(kv: KVNamespace, ttl?: number) {
    this.kv = kv;
    this.ttl = ttl;
  }

  private getMessagesKey(conversationId: string): string {
    return `${MESSAGES_PREFIX}${conversationId}`;
  }

  private getMetadataKey(conversationId: string): string {
    return `${METADATA_PREFIX}${conversationId}`;
  }

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    try {
      const data = await this.kv.get(this.getMessagesKey(conversationId), { type: 'json' });
      return (data as StoredMessage[]) ?? [];
    } catch {
      return [];
    }
  }

  async addMessage(message: StoredMessage): Promise<void> {
    const messages = await this.getMessages(message.conversationId);
    messages.push(message);
    
    await this.kv.put(
      this.getMessagesKey(message.conversationId),
      JSON.stringify(messages),
      this.ttl ? { expirationTtl: this.ttl } : undefined
    );
  }

  async updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void> {
    // List all message keys to find the conversation
    const { keys } = await this.kv.list({ prefix: MESSAGES_PREFIX });
    
    for (const { name: key } of keys) {
      const conversationId = key.slice(MESSAGES_PREFIX.length);
      const messages = await this.getMessages(conversationId);
      const index = messages.findIndex(m => m.id === id);
      
      if (index !== -1) {
        messages[index] = { ...messages[index], ...updates };
        await this.kv.put(
          key,
          JSON.stringify(messages),
          this.ttl ? { expirationTtl: this.ttl } : undefined
        );
        return;
      }
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const { keys } = await this.kv.list({ prefix: MESSAGES_PREFIX });
    
    for (const { name: key } of keys) {
      const conversationId = key.slice(MESSAGES_PREFIX.length);
      const messages = await this.getMessages(conversationId);
      const filtered = messages.filter(m => m.id !== id);
      
      if (filtered.length !== messages.length) {
        await this.kv.put(
          key,
          JSON.stringify(filtered),
          this.ttl ? { expirationTtl: this.ttl } : undefined
        );
        return;
      }
    }
  }

  async clear(conversationId: string): Promise<void> {
    await Promise.all([
      this.kv.delete(this.getMessagesKey(conversationId)),
      this.kv.delete(this.getMetadataKey(conversationId)),
    ]);
  }

  async getMetadata(conversationId: string): Promise<Record<string, unknown> | null> {
    try {
      const data = await this.kv.get(this.getMetadataKey(conversationId), { type: 'json' });
      return (data as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  async setMetadata(conversationId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.kv.put(
      this.getMetadataKey(conversationId),
      JSON.stringify(metadata),
      this.ttl ? { expirationTtl: this.ttl } : undefined
    );
  }

  /** Clear all binario memory data in this KV namespace */
  async clearAll(): Promise<void> {
    const { keys } = await this.kv.list();
    await Promise.all(keys.map(({ name }) => this.kv.delete(name)));
  }

  /** Get all conversation IDs */
  async getConversationIds(): Promise<string[]> {
    const { keys } = await this.kv.list({ prefix: MESSAGES_PREFIX });
    return keys.map(({ name }) => name.slice(MESSAGES_PREFIX.length));
  }
}

/** Create a new Cloudflare KV store */
export function createCloudflareKVStore(kv: KVNamespace, ttl?: number): CloudflareKVStore {
  return new CloudflareKVStore(kv, ttl);
}
