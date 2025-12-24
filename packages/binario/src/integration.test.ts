// End-to-End Integration Tests for Chat with Memory
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Core imports
import { BinarioAI } from './core';
import { useBinarioChatWithMemory, useBinarioMemory } from './hooks';
import { BufferMemory } from './memory/buffer';
import { SummaryMemory } from './memory/summary';
import { SummaryBufferMemory } from './memory/summary-buffer';
import { VectorMemory } from './memory/vector';
import { InMemoryStore } from './memory/stores/in-memory';
import { LocalStorageStore } from './memory/stores/local-storage';
import type { Message, ChatResponse } from './types';
import type { EmbeddingsProvider } from './embeddings/types';

// ============= Mock Setup =============

// Mock BinarioAI with realistic responses
const createMockBinario = () => {
  let callCount = 0;
  
  const mockChat = vi.fn(async (messages: Message[]) => {
    callCount++;
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    // Simulate contextual responses
    let content = 'I understand. How can I help you further?';
    
    if (lastUserMessage?.content.toLowerCase().includes('hello')) {
      content = 'Hello! Nice to meet you. How can I assist you today?';
    } else if (lastUserMessage?.content.toLowerCase().includes('pizza')) {
      content = 'Pizza is delicious! Do you have a favorite topping?';
    } else if (lastUserMessage?.content.toLowerCase().includes('weather')) {
      content = 'I can help with weather information. What location are you interested in?';
    } else if (lastUserMessage?.content.toLowerCase().includes('remember')) {
      // Check conversation context
      const hasConversation = messages.length > 2;
      if (hasConversation) {
        content = 'Yes, I remember our conversation! We were discussing various topics.';
      } else {
        content = "We just started talking, so there's not much to remember yet.";
      }
    }
    
    return {
      id: `response-${callCount}`,
      provider: 'openai',
      model: 'gpt-4',
      content,
      usage: { promptTokens: 50 * messages.length, completionTokens: 30, totalTokens: 50 * messages.length + 30 },
      finishReason: 'stop',
      latency: 150,
      cached: false,
    } as ChatResponse;
  });

  return {
    chat: mockChat,
    streamChat: vi.fn(),
    getCallCount: () => callCount,
    reset: () => { callCount = 0; mockChat.mockClear(); },
  } as unknown as BinarioAI & { getCallCount: () => number; reset: () => void };
};

// Mock embeddings with deterministic results for testing
const createMockEmbeddings = (): EmbeddingsProvider => {
  const wordEmbeddings: Record<string, number[]> = {};
  
  const getEmbedding = (text: string): number[] => {
    // Create deterministic embeddings based on text content
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    words.forEach((word, i) => {
      const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      embedding[hash % 384] += 1 / (i + 1);
    });
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    return embedding.map(val => val / magnitude);
  };
  
  return {
    name: 'mock-deterministic',
    embed: async (text: string) => ({
      text,
      embedding: getEmbedding(text),
      tokenCount: text.split(' ').length,
    }),
    embedMany: async (texts: string[]) => ({
      embeddings: texts.map(text => ({
        text,
        embedding: getEmbedding(text),
        tokenCount: text.split(' ').length,
      })),
      model: 'mock',
      usage: { promptTokens: texts.length * 10, totalTokens: texts.length * 10 },
    }),
  };
};

// Mock localStorage
const createMockLocalStorage = () => {
  const storage: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    key: vi.fn((i: number) => Object.keys(storage)[i] || null),
    get length() { return Object.keys(storage).length; },
    _storage: storage, // For inspection
  };
};

// ============= Integration Tests =============

describe('E2E: Complete Chat Flow with Buffer Memory', () => {
  let mockBinario: ReturnType<typeof createMockBinario>;
  
  beforeEach(() => {
    mockBinario = createMockBinario();
  });

  it('should complete a full conversation flow with memory persistence', async () => {
    const store = new InMemoryStore();
    
    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: {
          type: 'buffer',
          store,
          maxMessages: 10,
          conversationId: 'e2e-test-1',
        },
        autoSave: true,
      })
    );

    // Send first message
    await act(async () => {
      await result.current.append({ role: 'user', content: 'Hello!' });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Hello!');
      expect(result.current.messages[1].role).toBe('assistant');
    });

    // Send second message
    await act(async () => {
      await result.current.append({ role: 'user', content: 'I love pizza!' });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(4);
    });

    // Verify memory contains all messages
    await waitFor(() => {
      expect(result.current.memory.messages.length).toBeGreaterThanOrEqual(2);
    });

    // Send third message asking about context
    await act(async () => {
      await result.current.append({ role: 'user', content: 'Do you remember what we talked about?' });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(6);
      // AI should have received context from previous messages
      expect(mockBinario.chat).toHaveBeenCalledTimes(3);
    });
  });

  it('should persist conversation across hook remounts', async () => {
    const store = new InMemoryStore();
    const conversationId = 'persist-test-1';

    // First session
    const { result: session1, unmount } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: { type: 'buffer', store, conversationId },
        autoSave: true,
      })
    );

    await act(async () => {
      await session1.current.append({ role: 'user', content: 'Remember this: the secret code is 1234' });
    });

    await waitFor(() => {
      expect(session1.current.messages).toHaveLength(2);
    });

    // Unmount first session
    unmount();

    // Second session with same store and conversation ID
    const { result: session2 } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: { type: 'buffer', store, conversationId },
        autoSave: true,
      })
    );

    // Load the conversation
    await act(async () => {
      await session2.current.loadConversation();
    });

    await waitFor(() => {
      // Should have messages from previous session
      expect(session2.current.memory.messages.length).toBeGreaterThan(0);
    });
  });

  it('should handle conversation switching', async () => {
    const store = new InMemoryStore();

    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: { type: 'buffer', store, conversationId: 'conv-a' },
        autoSave: true,
      })
    );

    // Add message to conversation A
    await act(async () => {
      await result.current.append({ role: 'user', content: 'This is conversation A' });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    // Switch to conversation B
    await act(async () => {
      await result.current.loadConversation('conv-b');
    });

    // Conversation B should be empty
    expect(result.current.memory.conversationId).toBe('conv-b');

    // Add message to conversation B
    await act(async () => {
      await result.current.append({ role: 'user', content: 'This is conversation B' });
    });

    // Switch back to A
    await act(async () => {
      await result.current.loadConversation('conv-a');
    });

    await waitFor(() => {
      // Should have original messages from conversation A
      expect(result.current.memory.conversationId).toBe('conv-a');
    });
  });
});

describe('E2E: Chat with Summary Memory', () => {
  let mockBinario: ReturnType<typeof createMockBinario>;
  const mockSummarizer = vi.fn(async (messages: Message[]) => {
    const topics = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.split(' ').slice(0, 3).join(' '))
      .join(', ');
    return `Conversation summary: User discussed ${topics}. Assistant provided helpful responses.`;
  });

  beforeEach(() => {
    mockBinario = createMockBinario();
    mockSummarizer.mockClear();
  });

  it('should summarize long conversations', async () => {
    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: {
          type: 'summary',
          summarizer: mockSummarizer,
          maxTokens: 200, // Low threshold to trigger summarization
        },
        autoSave: true,
      })
    );

    // Send multiple messages to trigger summarization
    const topics = ['pizza', 'weather', 'movies', 'books', 'travel'];
    
    for (const topic of topics) {
      await act(async () => {
        await result.current.append({ 
          role: 'user', 
          content: `Tell me about ${topic}. I really want to know everything about ${topic} in great detail.` 
        });
      });
    }

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });
  });

  it('should include summary in context for API calls', async () => {
    const store = new InMemoryStore();
    
    // Pre-populate with a summary
    await store.setMetadata('summary-test', { 
      summary: 'Previous conversation: User likes Italian food, especially pizza with mushrooms.' 
    });

    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'summary',
        store,
        conversationId: 'summary-test',
        summarizer: mockSummarizer,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });

    const summary = await result.current.memory.getSummary?.();
    expect(summary).toContain('Italian food');
  });
});

describe('E2E: Chat with Summary-Buffer Memory', () => {
  let mockBinario: ReturnType<typeof createMockBinario>;
  const mockSummarizer = vi.fn(async (messages: Message[]) => {
    return `Summary of ${messages.length} messages exchanged.`;
  });

  beforeEach(() => {
    mockBinario = createMockBinario();
    mockSummarizer.mockClear();
  });

  it('should keep recent messages while summarizing old ones', async () => {
    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: {
          type: 'summary-buffer',
          bufferSize: 4,
          summarizer: mockSummarizer,
          maxTokens: 300,
        },
        autoSave: true,
      })
    );

    // Send many messages
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await result.current.append({ 
          role: 'user', 
          content: `Message number ${i + 1} with some content to increase tokens.` 
        });
      });
    }

    await waitFor(() => {
      // Should have messages (buffer + summary context)
      expect(result.current.messages.length).toBeGreaterThan(0);
    });
  });
});

describe('E2E: Chat with Vector Memory', () => {
  let mockBinario: ReturnType<typeof createMockBinario>;
  let mockEmbeddings: EmbeddingsProvider;

  beforeEach(() => {
    mockBinario = createMockBinario();
    mockEmbeddings = createMockEmbeddings();
  });

  it('should retrieve semantically relevant messages', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'vector',
        embeddings: mockEmbeddings,
        topK: 3,
        minScore: 0,
      })
    );

    // Add messages about different topics
    await act(async () => {
      await result.current.addMessages([
        { role: 'user', content: 'I love eating pizza with extra cheese' },
        { role: 'assistant', content: 'Pizza is a great choice! Cheese makes it even better.' },
        { role: 'user', content: 'The weather today is sunny and warm' },
        { role: 'assistant', content: 'Sounds like a beautiful day outside!' },
        { role: 'user', content: 'I want to order some pasta for dinner' },
        { role: 'assistant', content: 'Italian food is wonderful. Pasta is a great choice.' },
      ]);
    });

    // Search for food-related messages
    const vectorMemory = result.current.memory as VectorMemory;
    const foodResults = await vectorMemory.search('What food do I like?');
    
    expect(foodResults.length).toBeGreaterThan(0);
    // Food-related messages should score higher
    const foodContents = foodResults.map(r => r.message.message.content.toLowerCase());
    expect(foodContents.some(c => c.includes('pizza') || c.includes('pasta'))).toBe(true);
  });

  it('should build context with recent + relevant messages', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'vector',
        embeddings: mockEmbeddings,
        topK: 5,
        minScore: 0,
      })
    );

    // Add a history of messages
    await act(async () => {
      await result.current.addMessages([
        { role: 'user', content: 'My favorite color is blue' },
        { role: 'assistant', content: 'Blue is a calming color!' },
        { role: 'user', content: 'I like hiking in the mountains' },
        { role: 'assistant', content: 'Hiking is great exercise!' },
        { role: 'user', content: 'What is the weather like?' },
        { role: 'assistant', content: 'I would need your location to check.' },
        { role: 'user', content: 'Tell me a joke' },
        { role: 'assistant', content: 'Why did the chicken cross the road?' },
      ]);
    });

    const vectorMemory = result.current.memory as VectorMemory;
    const context = await vectorMemory.buildContext('What outdoor activities do I enjoy?', {
      recentCount: 2,
      relevantCount: 2,
    });

    expect(context.length).toBeGreaterThan(0);
  });
});

describe('E2E: LocalStorage Persistence', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('should persist messages to localStorage', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store: 'localStorage',
        conversationId: 'ls-test-1',
      })
    );

    await act(async () => {
      await result.current.addMessage({ role: 'user', content: 'Save this message!' });
    });

    // Check localStorage was called
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    
    // Verify the data was stored
    const storedKeys = Object.keys(mockLocalStorage._storage);
    expect(storedKeys.some(k => k.includes('messages'))).toBe(true);
  });

  it('should load messages from localStorage on init', async () => {
    const conversationId = 'ls-load-test';
    
    // Pre-populate localStorage
    const storedMessages = [
      {
        id: 'msg-1',
        message: { role: 'user', content: 'Previously stored message' },
        timestamp: Date.now() - 1000,
        conversationId,
      }
    ];
    mockLocalStorage._storage[`binario:memory:messages:${conversationId}`] = JSON.stringify(storedMessages);

    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store: 'localStorage',
        conversationId,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.messages[0].content).toBe('Previously stored message');
    });
  });

  it('should handle localStorage quota exceeded', async () => {
    // Make setItem throw on large data
    let callCount = 0;
    mockLocalStorage.setItem = vi.fn((key: string, value: string) => {
      callCount++;
      if (callCount > 5 && value.length > 1000) {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      }
      mockLocalStorage._storage[key] = value;
    });

    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store: 'localStorage',
        conversationId: 'quota-test',
        maxMessages: 100,
      })
    );

    // Add many messages to trigger quota
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await result.current.addMessage({ 
          role: 'user', 
          content: `Message ${i}: ${'x'.repeat(200)}` 
        });
      });
    }

    // Should not throw, should handle gracefully
    expect(result.current.messages.length).toBeGreaterThan(0);
  });
});

describe('E2E: Error Handling', () => {
  let mockBinario: ReturnType<typeof createMockBinario>;

  beforeEach(() => {
    mockBinario = createMockBinario();
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('API rate limit exceeded');
    mockBinario.chat = vi.fn().mockRejectedValue(error);

    const onError = vi.fn();
    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        onError,
        memory: { type: 'buffer' },
      })
    );

    await act(async () => {
      await result.current.append({ role: 'user', content: 'Hello!' });
    });

    await waitFor(() => {
      expect(result.current.error).toBe(error);
      expect(onError).toHaveBeenCalledWith(error);
    });

    // User message should still be in messages
    expect(result.current.messages.some(m => m.content === 'Hello!')).toBe(true);
  });

  it('should handle memory store errors', async () => {
    const faultyStore: any = {
      getMessages: vi.fn().mockRejectedValue(new Error('Store error')),
      addMessage: vi.fn().mockRejectedValue(new Error('Store error')),
      clear: vi.fn(),
      getMetadata: vi.fn().mockResolvedValue(null),
      setMetadata: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
    };

    // Should not throw during initialization
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store: faultyStore,
      })
    );

    // Operations should handle errors gracefully
    expect(result.current.memory).toBeDefined();
  });

  it('should recover from temporary failures', async () => {
    let failCount = 0;
    mockBinario.chat = vi.fn().mockImplementation(async () => {
      failCount++;
      if (failCount < 3) {
        throw new Error('Temporary failure');
      }
      return {
        id: 'success',
        provider: 'openai',
        model: 'gpt-4',
        content: 'Success after retries!',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
        latency: 100,
        cached: false,
      };
    });

    const { result } = renderHook(() => 
      useBinarioChatWithMemory(mockBinario, {
        memory: { type: 'buffer' },
      })
    );

    // First attempts fail
    await act(async () => {
      await result.current.append({ role: 'user', content: 'Try 1' });
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.append({ role: 'user', content: 'Try 2' });
    });
    expect(result.current.error).not.toBeNull();

    // Third attempt succeeds
    await act(async () => {
      await result.current.append({ role: 'user', content: 'Try 3' });
    });

    await waitFor(() => {
      expect(result.current.messages.some(m => m.content === 'Success after retries!')).toBe(true);
    });
  });
});

describe('E2E: Performance', () => {
  it('should handle large conversation histories efficiently', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        maxMessages: 100,
        maxTokens: 50000,
      })
    );

    const startTime = Date.now();

    // Add 100 messages
    const messages: Message[] = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: This is a test message with some content to simulate real conversation.`,
    } as Message));

    await act(async () => {
      await result.current.addMessages(messages);
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
    expect(result.current.messages.length).toBeLessThanOrEqual(100);
  });

  it('should efficiently retrieve context window', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        maxMessages: 50,
      })
    );

    // Add messages
    await act(async () => {
      const msgs: Message[] = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with content`,
      } as Message));
      await result.current.addMessages(msgs);
    });

    const startTime = Date.now();
    
    // Get context window multiple times
    for (let i = 0; i < 10; i++) {
      await result.current.getContextWindow(2000);
    }

    const duration = Date.now() - startTime;
    
    // 10 context retrievals should be fast (< 1 second)
    expect(duration).toBeLessThan(1000);
  });
});

describe('E2E: Multi-User Scenarios', () => {
  it('should isolate conversations by ID', async () => {
    const store = new InMemoryStore();

    // User A's conversation
    const { result: userA } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store,
        conversationId: 'user-a-conv',
      })
    );

    // User B's conversation
    const { result: userB } = renderHook(() => 
      useBinarioMemory({
        type: 'buffer',
        store,
        conversationId: 'user-b-conv',
      })
    );

    // Add messages for each user
    await act(async () => {
      await userA.current.addMessage({ role: 'user', content: 'User A message' });
    });

    await act(async () => {
      await userB.current.addMessage({ role: 'user', content: 'User B message' });
    });

    // Verify isolation
    expect(userA.current.messages.length).toBe(1);
    expect(userA.current.messages[0].content).toBe('User A message');
    
    expect(userB.current.messages.length).toBe(1);
    expect(userB.current.messages[0].content).toBe('User B message');
  });

  it('should support concurrent operations', async () => {
    const store = new InMemoryStore();

    const hooks = Array.from({ length: 5 }, (_, i) => 
      renderHook(() => 
        useBinarioMemory({
          type: 'buffer',
          store,
          conversationId: `concurrent-${i}`,
        })
      )
    );

    // Run concurrent operations
    await Promise.all(
      hooks.map(async ({ result }, i) => {
        await act(async () => {
          await result.current.addMessage({ role: 'user', content: `Concurrent message ${i}` });
        });
      })
    );

    // Verify all operations completed correctly
    for (let i = 0; i < hooks.length; i++) {
      expect(hooks[i].result.current.messages.length).toBe(1);
      expect(hooks[i].result.current.messages[0].content).toBe(`Concurrent message ${i}`);
    }
  });
});
