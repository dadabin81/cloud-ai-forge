// Memory System Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BufferMemory, createBufferMemory } from './buffer';
import { SummaryMemory, createSummaryMemory } from './summary';
import { SummaryBufferMemory, createSummaryBufferMemory } from './summary-buffer';
import { VectorMemory, createVectorMemory } from './vector';
import { InMemoryStore } from './stores/in-memory';
import type { Message } from '../types';
import type { EmbeddingsProvider } from '../embeddings/types';

// Mock embeddings provider
const mockEmbeddings: EmbeddingsProvider = {
  name: 'mock',
  embed: vi.fn(async (text: string) => ({
    text,
    embedding: Array(768).fill(0).map(() => Math.random()),
    tokenCount: text.split(' ').length,
  })),
  embedMany: vi.fn(async (texts: string[]) => ({
    embeddings: texts.map(text => ({
      text,
      embedding: Array(768).fill(0).map(() => Math.random()),
      tokenCount: text.split(' ').length,
    })),
    model: 'mock',
    usage: { promptTokens: 100, totalTokens: 100 },
  })),
};

// Mock summarizer
const mockSummarizer = vi.fn(async (messages: Message[]) => {
  return `Summary of ${messages.length} messages`;
});

describe('BufferMemory', () => {
  let memory: BufferMemory;

  beforeEach(() => {
    memory = new BufferMemory({ maxMessages: 5, maxTokens: 500 });
  });

  describe('add', () => {
    it('should add a message', async () => {
      await memory.add({ role: 'user', content: 'Hello!' });
      const messages = await memory.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello!');
    });

    it('should add multiple messages', async () => {
      await memory.addMany([
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
      const messages = await memory.getMessages();
      expect(messages).toHaveLength(2);
    });
  });

  describe('sliding window', () => {
    it('should keep only last N messages', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.add({ role: 'user', content: `Message ${i}` });
      }
      const messages = await memory.getMessages();
      expect(messages.length).toBeLessThanOrEqual(5);
      expect(messages[messages.length - 1].content).toBe('Message 9');
    });
  });

  describe('getContext', () => {
    it('should return context with token count', async () => {
      await memory.add({ role: 'user', content: 'Hello world!' });
      const context = await memory.getContext();
      expect(context.messages).toHaveLength(1);
      expect(context.tokenCount).toBeGreaterThan(0);
      expect(context.messageCount).toBe(1);
    });
  });

  describe('getContextWindow', () => {
    it('should return messages within token limit', async () => {
      await memory.addMany([
        { role: 'user', content: 'First message with lots of text' },
        { role: 'assistant', content: 'Second message with even more text content' },
        { role: 'user', content: 'Third message' },
      ]);
      const context = await memory.getContextWindow(50);
      expect(context.tokenCount).toBeLessThanOrEqual(50);
    });
  });

  describe('clear', () => {
    it('should clear all messages', async () => {
      await memory.add({ role: 'user', content: 'Hello!' });
      await memory.clear();
      const messages = await memory.getMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('conversation management', () => {
    it('should support multiple conversations', async () => {
      await memory.add({ role: 'user', content: 'Conv 1 message' });
      
      memory.setConversationId('conv-2');
      await memory.add({ role: 'user', content: 'Conv 2 message' });
      
      const conv2Messages = await memory.getMessages();
      expect(conv2Messages).toHaveLength(1);
      expect(conv2Messages[0].content).toBe('Conv 2 message');
    });
  });
});

describe('SummaryMemory', () => {
  let memory: SummaryMemory;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new SummaryMemory({
      summarizeThreshold: 100,
      summarizer: mockSummarizer,
    });
  });

  describe('add', () => {
    it('should add messages', async () => {
      await memory.add({ role: 'user', content: 'Hello!' });
      const messages = await memory.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('summarize', () => {
    it('should generate summary', async () => {
      await memory.addMany([
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
      ]);
      
      const summary = await memory.summarize();
      expect(summary).toContain('Summary of');
      expect(mockSummarizer).toHaveBeenCalled();
    });

    it('should throw if no summarizer', async () => {
      const noSummarizerMemory = new SummaryMemory({});
      await noSummarizerMemory.add({ role: 'user', content: 'Hello!' });
      
      await expect(noSummarizerMemory.summarize()).rejects.toThrow(
        'No summarizer function provided'
      );
    });
  });

  describe('getSummary', () => {
    it('should return null if no summary', async () => {
      const summary = await memory.getSummary();
      expect(summary).toBeNull();
    });

    it('should return summary after summarizing', async () => {
      await memory.addMany([
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi!' },
      ]);
      await memory.summarize();
      
      const summary = await memory.getSummary();
      expect(summary).not.toBeNull();
    });
  });
});

describe('SummaryBufferMemory', () => {
  let memory: SummaryBufferMemory;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new SummaryBufferMemory({
      bufferSize: 3,
      summarizeThreshold: 100,
      summarizer: mockSummarizer,
    });
  });

  describe('buffer behavior', () => {
    it('should keep recent messages in buffer', async () => {
      await memory.addMany([
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Message 3' },
      ]);
      
      const messages = await memory.getMessages();
      // Should have buffer messages
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });

    it('should return buffer size', () => {
      expect(memory.getBufferSize()).toBe(3);
    });
  });

  describe('hybrid summarization', () => {
    it('should summarize old messages and keep buffer', async () => {
      // Add many messages to trigger summarization
      for (let i = 0; i < 20; i++) {
        await memory.add({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `This is a long message number ${i} with extra content to increase token count.` 
        });
      }
      
      // Check that summarizer was called
      expect(mockSummarizer).toHaveBeenCalled();
    });
  });
});

describe('VectorMemory', () => {
  let memory: VectorMemory;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new VectorMemory({
      embeddings: mockEmbeddings,
      topK: 3,
      minScore: 0.0, // Set low for testing with random embeddings
    });
  });

  describe('add with embeddings', () => {
    it('should generate embeddings when adding messages', async () => {
      await memory.add({ role: 'user', content: 'I love pizza!' });
      expect(mockEmbeddings.embed).toHaveBeenCalledWith('I love pizza!');
    });

    it('should batch embed when adding many messages', async () => {
      await memory.addMany([
        { role: 'user', content: 'Message 1' },
        { role: 'user', content: 'Message 2' },
      ]);
      expect(mockEmbeddings.embedMany).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should return relevant messages', async () => {
      await memory.addMany([
        { role: 'user', content: 'I love pizza!' },
        { role: 'assistant', content: 'Pizza is great!' },
        { role: 'user', content: 'The weather is nice' },
      ]);
      
      const results = await memory.search('What food do I like?');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should respect topK parameter', async () => {
      await memory.addMany([
        { role: 'user', content: 'Message 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'user', content: 'Message 3' },
        { role: 'user', content: 'Message 4' },
        { role: 'user', content: 'Message 5' },
      ]);
      
      const results = await memory.search('query', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getRelevantContext', () => {
    it('should return messages sorted by timestamp', async () => {
      await memory.addMany([
        { role: 'user', content: 'First message' },
        { role: 'user', content: 'Second message' },
        { role: 'user', content: 'Third message' },
      ]);
      
      const context = await memory.getRelevantContext('query');
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('buildContext', () => {
    it('should combine recent and relevant messages', async () => {
      await memory.addMany([
        { role: 'user', content: 'Old relevant message about pizza' },
        { role: 'assistant', content: 'Response about pizza' },
        { role: 'user', content: 'Unrelated message 1' },
        { role: 'user', content: 'Unrelated message 2' },
        { role: 'user', content: 'Recent message' },
      ]);
      
      const context = await memory.buildContext('pizza', {
        recentCount: 2,
        relevantCount: 2,
      });
      
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw if no embeddings provider', () => {
      expect(() => new VectorMemory({} as any)).toThrow(
        'VectorMemory requires an embeddings provider'
      );
    });
  });
});

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('should store and retrieve messages', async () => {
    await store.addMessage({
      id: 'msg-1',
      message: { role: 'user', content: 'Hello!' },
      timestamp: Date.now(),
      conversationId: 'conv-1',
    });
    
    const messages = await store.getMessages('conv-1');
    expect(messages).toHaveLength(1);
  });

  it('should support multiple conversations', async () => {
    await store.addMessage({
      id: 'msg-1',
      message: { role: 'user', content: 'Conv 1' },
      timestamp: Date.now(),
      conversationId: 'conv-1',
    });
    
    await store.addMessage({
      id: 'msg-2',
      message: { role: 'user', content: 'Conv 2' },
      timestamp: Date.now(),
      conversationId: 'conv-2',
    });
    
    expect(await store.getMessages('conv-1')).toHaveLength(1);
    expect(await store.getMessages('conv-2')).toHaveLength(1);
  });

  it('should clear conversation', async () => {
    await store.addMessage({
      id: 'msg-1',
      message: { role: 'user', content: 'Hello!' },
      timestamp: Date.now(),
      conversationId: 'conv-1',
    });
    
    await store.clear('conv-1');
    expect(await store.getMessages('conv-1')).toHaveLength(0);
  });

  it('should handle metadata', async () => {
    await store.setMetadata('conv-1', { summary: 'Test summary' });
    const metadata = await store.getMetadata('conv-1');
    expect(metadata?.summary).toBe('Test summary');
  });
});

describe('Factory functions', () => {
  it('should create buffer memory', () => {
    const memory = createBufferMemory({ maxMessages: 10 });
    expect(memory).toBeInstanceOf(BufferMemory);
  });

  it('should create summary memory', () => {
    const memory = createSummaryMemory({ summarizer: mockSummarizer });
    expect(memory).toBeInstanceOf(SummaryMemory);
  });

  it('should create summary buffer memory', () => {
    const memory = createSummaryBufferMemory({ 
      bufferSize: 5,
      summarizer: mockSummarizer,
    });
    expect(memory).toBeInstanceOf(SummaryBufferMemory);
  });

  it('should create vector memory', () => {
    const memory = createVectorMemory({ embeddings: mockEmbeddings });
    expect(memory).toBeInstanceOf(VectorMemory);
  });
});
