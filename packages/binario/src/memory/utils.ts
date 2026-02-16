// Memory Utilities for Binario SDK

import type { Message } from '../types';
import type { StoredMessage, ConversationContext } from './types';

/** 
 * Estimate token count for text using character-based approximation.
 * Average English text: ~4 characters per token
 * Code/technical: ~3.5 characters per token
 * We use 4 as a conservative estimate.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  // More accurate estimation considering whitespace and punctuation
  const words = text.split(/\s+/).filter(Boolean);
  const avgCharsPerWord = text.length / Math.max(words.length, 1);
  
  // Adjust ratio based on content type
  const ratio = avgCharsPerWord > 6 ? 3.5 : 4;
  return Math.ceil(text.length / ratio);
}

/** Count tokens for a single message */
export function countMessageTokens(message: Message): number {
  let tokens = 0;
  
  // Role token overhead (~4 tokens per message for formatting)
  tokens += 4;
  
  // Content tokens
  tokens += countTokens(message.content);
  
  // Name tokens if present
  if (message.name) {
    tokens += countTokens(message.name) + 1;
  }
  
  // Tool calls if present
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      tokens += countTokens(call.function.name);
      tokens += countTokens(call.function.arguments);
      tokens += 10; // Overhead for tool call structure
    }
  }
  
  return tokens;
}

/** Count total tokens for an array of messages */
export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
}

/** Generate unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Create a stored message from a regular message */
export function createStoredMessage(
  message: Message,
  conversationId: string,
  options?: { embedding?: number[]; metadata?: Record<string, unknown> }
): StoredMessage {
  return {
    id: generateId(),
    message,
    timestamp: Date.now(),
    conversationId,
    tokenCount: countMessageTokens(message),
    embedding: options?.embedding,
    metadata: options?.metadata,
  };
}

/** 
 * Truncate messages to fit within token limit.
 * Removes oldest messages first (FIFO).
 */
export function truncateMessages(
  messages: Message[],
  maxTokens: number,
  options?: { keepSystemMessages?: boolean }
): Message[] {
  const { keepSystemMessages = true } = options ?? {};
  
  // Separate system messages if we need to keep them
  const systemMessages = keepSystemMessages 
    ? messages.filter(m => m.role === 'system')
    : [];
  const nonSystemMessages = keepSystemMessages
    ? messages.filter(m => m.role !== 'system')
    : [...messages];
  
  // Calculate tokens for system messages
  const systemTokens = countMessagesTokens(systemMessages);
  const remainingTokens = maxTokens - systemTokens;
  
  if (remainingTokens <= 0) {
    // If system messages alone exceed limit, truncate them too
    return truncateMessagesSimple(messages, maxTokens);
  }
  
  // Truncate non-system messages from the beginning
  const truncated = truncateMessagesSimple(nonSystemMessages, remainingTokens);
  
  return [...systemMessages, ...truncated];
}

/** Simple truncation without special handling */
function truncateMessagesSimple(messages: Message[], maxTokens: number): Message[] {
  let totalTokens = 0;
  const result: Message[] = [];
  
  // Work backwards from most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = countMessageTokens(messages[i]);
    if (totalTokens + msgTokens > maxTokens) {
      break;
    }
    totalTokens += msgTokens;
    result.unshift(messages[i]);
  }
  
  return result;
}

/** Truncate messages by count */
export function truncateMessagesByCount(
  messages: Message[],
  maxMessages: number,
  options?: { keepSystemMessages?: boolean }
): Message[] {
  const { keepSystemMessages = true } = options ?? {};
  
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  if (keepSystemMessages) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const remainingSlots = maxMessages - systemMessages.length;
    if (remainingSlots <= 0) {
      return systemMessages.slice(-maxMessages);
    }
    
    return [...systemMessages, ...nonSystemMessages.slice(-remainingSlots)];
  }
  
  return messages.slice(-maxMessages);
}

/** Format messages for LLM context with conversation summary */
export function formatContextWithSummary(
  recentMessages: Message[],
  summary: string | null
): Message[] {
  if (!summary) {
    return recentMessages;
  }
  
  // Insert summary as a system message at the beginning
  const summaryMessage: Message = {
    role: 'system',
    content: `Previous conversation summary:\n${summary}`,
  };
  
  // Filter out existing system messages about summary
  const filtered = recentMessages.filter(
    m => !(m.role === 'system' && m.content.startsWith('Previous conversation summary:'))
  );
  
  // Find index after regular system messages
  const firstNonSystemIdx = filtered.findIndex(m => m.role !== 'system');
  const insertIdx = firstNonSystemIdx === -1 ? filtered.length : firstNonSystemIdx;
  
  return [
    ...filtered.slice(0, insertIdx),
    summaryMessage,
    ...filtered.slice(insertIdx),
  ];
}

/** Create conversation context object */
export function createContext(
  messages: Message[],
  summary?: string | null
): ConversationContext {
  return {
    messages,
    summary: summary ?? undefined,
    tokenCount: countMessagesTokens(messages),
    messageCount: messages.length,
  };
}

/** Calculate cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/** Default summarization prompt */
export const DEFAULT_SUMMARY_PROMPT = `Summarize the following conversation concisely, preserving key information, decisions, and context that would be useful for continuing the conversation. Focus on:
- Main topics discussed
- Key decisions or conclusions
- Important user preferences or requirements
- Any pending questions or tasks

Conversation:
{conversation}

Summary:`;

/** Format conversation for summarization */
export function formatConversationForSummary(messages: Message[]): string {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
}
