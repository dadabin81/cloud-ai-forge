// Memory Hooks Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock React hooks since we're testing in Node
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
  };
});

// Import after mocks
import { useBinarioMemory, useBinarioChatWithMemory } from './hooks';
import { BinarioAI } from './core';
import type { Message, ChatResponse } from './types';

// Mock BinarioAI
const mockBinario = {
  chat: vi.fn(),
  streamChat: vi.fn(),
} as unknown as BinarioAI;

describe('useBinarioMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with buffer memory by default', () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      expect(result.current.memory).toBeDefined();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.conversationId).toBeDefined();
    });

    it('should initialize with custom conversation ID', () => {
      const { result } = renderHook(() => 
        useBinarioMemory({ conversationId: 'test-conv-123' })
      );
      
      expect(result.current.conversationId).toBe('test-conv-123');
    });

    it('should support different memory types', () => {
      const { result: bufferResult } = renderHook(() => 
        useBinarioMemory({ type: 'buffer' })
      );
      expect(bufferResult.current.memory.type).toBe('buffer');

      const { result: summaryResult } = renderHook(() => 
        useBinarioMemory({ 
          type: 'summary',
          summarizer: async () => 'summary'
        })
      );
      expect(summaryResult.current.memory.type).toBe('summary');

      const { result: sbResult } = renderHook(() => 
        useBinarioMemory({ 
          type: 'summary-buffer',
          summarizer: async () => 'summary'
        })
      );
      expect(sbResult.current.memory.type).toBe('summary-buffer');
    });
  });

  describe('addMessage', () => {
    it('should add a message to memory', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      const message: Message = { role: 'user', content: 'Hello!' };
      
      await act(async () => {
        await result.current.addMessage(message);
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].content).toBe('Hello!');
      });
    });

    it('should add multiple messages', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];
      
      await act(async () => {
        await result.current.addMessages(messages);
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(3);
      });
    });
  });

  describe('clear', () => {
    it('should clear all messages', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      // Add some messages
      await act(async () => {
        await result.current.addMessage({ role: 'user', content: 'Hello!' });
        await result.current.addMessage({ role: 'assistant', content: 'Hi!' });
      });
      
      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0);
      });
      
      // Clear
      await act(async () => {
        await result.current.clear();
      });
      
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('getContextWindow', () => {
    it('should return context within token limit', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      // Add messages
      await act(async () => {
        await result.current.addMessages([
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ]);
      });
      
      const context = await result.current.getContextWindow(1000);
      
      expect(context.messages).toBeDefined();
      expect(context.tokenCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('switchConversation', () => {
    it('should switch to a different conversation', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      const originalId = result.current.conversationId;
      
      act(() => {
        result.current.switchConversation('new-conv-id');
      });
      
      await waitFor(() => {
        expect(result.current.conversationId).toBe('new-conv-id');
        expect(result.current.conversationId).not.toBe(originalId);
      });
    });
  });

  describe('context', () => {
    it('should update context when messages change', async () => {
      const { result } = renderHook(() => useBinarioMemory());
      
      expect(result.current.context?.messageCount ?? 0).toBe(0);
      
      await act(async () => {
        await result.current.addMessage({ role: 'user', content: 'Hello!' });
      });
      
      await waitFor(() => {
        expect(result.current.context?.messageCount).toBe(1);
        expect(result.current.context?.tokenCount).toBeGreaterThan(0);
      });
    });
  });
});

describe('useBinarioChatWithMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResponse: ChatResponse = {
    id: 'test-id',
    provider: 'openai',
    model: 'gpt-4',
    content: 'Hello! How can I help?',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    finishReason: 'stop',
    latency: 100,
    cached: false,
  };

  describe('initialization', () => {
    it('should initialize with empty messages and memory', () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      expect(result.current.messages).toEqual([]);
      expect(result.current.memory).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should support custom memory options', () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, {
          memory: {
            type: 'buffer',
            maxMessages: 20,
            maxTokens: 2000,
          }
        })
      );
      
      expect(result.current.memory.memory.type).toBe('buffer');
    });
  });

  describe('append', () => {
    it('should append user message and get response', async () => {
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, { autoSave: true })
      );
      
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.messages[1].role).toBe('assistant');
        expect(result.current.messages[1].content).toBe('Hello! How can I help?');
      });
    });

    it('should auto-save to memory when enabled', async () => {
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, { autoSave: true })
      );
      
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      await waitFor(() => {
        // Memory should have both messages
        expect(result.current.memory.messages.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle errors', async () => {
      const error = new Error('API Error');
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      
      const onError = vi.fn();
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, { onError })
      );
      
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      await waitFor(() => {
        expect(result.current.error).toBe(error);
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('reload', () => {
    it('should reload the last user message', async () => {
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      // First, add a message
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
      
      // Reload
      await act(async () => {
        await result.current.reload();
      });
      
      // Should have called chat twice
      expect(mockBinario.chat).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop loading', async () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      act(() => {
        result.current.stop();
      });
      
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('loadConversation', () => {
    it('should load conversation from memory', async () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      // Add messages to memory directly
      await act(async () => {
        await result.current.memory.addMessage({ role: 'user', content: 'Old message' });
      });
      
      // Load conversation
      await act(async () => {
        await result.current.loadConversation();
      });
      
      // Messages should be synced
      await waitFor(() => {
        expect(result.current.memory.messages.length).toBeGreaterThan(0);
      });
    });

    it('should switch and load a different conversation', async () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      const originalId = result.current.memory.conversationId;
      
      await act(async () => {
        await result.current.loadConversation('different-conv');
      });
      
      expect(result.current.memory.conversationId).not.toBe(originalId);
    });
  });

  describe('saveConversation', () => {
    it('should save current messages to memory', async () => {
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, { autoSave: false })
      );
      
      // Add message without auto-save
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      // Manually save
      await act(async () => {
        await result.current.saveConversation();
      });
      
      // Verify saved
      await waitFor(() => {
        expect(result.current.memory.messages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('setMessages', () => {
    it('should set messages directly', () => {
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario)
      );
      
      const newMessages: Message[] = [
        { role: 'user', content: 'Test 1' },
        { role: 'assistant', content: 'Response 1' },
      ];
      
      act(() => {
        result.current.setMessages(newMessages);
      });
      
      expect(result.current.messages).toEqual(newMessages);
    });
  });

  describe('contextWindowSize', () => {
    it('should use context window for API calls', async () => {
      (mockBinario.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      
      const { result } = renderHook(() => 
        useBinarioChatWithMemory(mockBinario, {
          contextWindowSize: 2000,
        })
      );
      
      await act(async () => {
        await result.current.append({ role: 'user', content: 'Hello!' });
      });
      
      expect(mockBinario.chat).toHaveBeenCalled();
    });
  });
});

describe('Memory Integration', () => {
  it('should work with buffer memory for short conversations', async () => {
    const { result } = renderHook(() => 
      useBinarioMemory({ 
        type: 'buffer',
        maxMessages: 5,
      })
    );
    
    // Add 10 messages
    const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
    } as Message));
    
    await act(async () => {
      await result.current.addMessages(messages);
    });
    
    // Should only keep last 5
    await waitFor(() => {
      expect(result.current.messages.length).toBeLessThanOrEqual(5);
    });
  });

  it('should persist to localStorage store', async () => {
    // Mock localStorage
    const storage: Record<string, string> = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
      key: vi.fn(),
      length: 0,
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    const { result } = renderHook(() => 
      useBinarioMemory({ 
        store: 'localStorage',
        conversationId: 'test-persist',
      })
    );
    
    await act(async () => {
      await result.current.addMessage({ role: 'user', content: 'Persisted message' });
    });
    
    // Check localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});
