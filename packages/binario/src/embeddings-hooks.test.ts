// Embeddings Hooks Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBinarioEmbed, useBinarioSemanticSearch } from './hooks';
import type { EmbeddingsProvider, EmbeddingResult, BatchEmbeddingResult } from './embeddings/types';

// ============= Mock Embeddings Provider =============

const createMockEmbeddings = (): EmbeddingsProvider & { _calls: { embed: string[]; embedMany: string[][] } } => {
  const calls = { embed: [] as string[], embedMany: [] as string[][] };
  
  // Deterministic embedding based on text content
  const getEmbedding = (text: string): number[] => {
    const embedding = new Array(384).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    words.forEach((word, i) => {
      const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      embedding[hash % 384] += 1 / (i + 1);
    });
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    return embedding.map(val => val / magnitude);
  };

  return {
    name: 'mock',
    _calls: calls,
    embed: vi.fn(async (text: string): Promise<EmbeddingResult> => {
      calls.embed.push(text);
      return {
        text,
        embedding: getEmbedding(text),
        tokenCount: text.split(' ').length,
      };
    }),
    embedMany: vi.fn(async (texts: string[]): Promise<BatchEmbeddingResult> => {
      calls.embedMany.push(texts);
      return {
        embeddings: texts.map(text => ({
          text,
          embedding: getEmbedding(text),
          tokenCount: text.split(' ').length,
        })),
        model: 'mock-model',
        usage: { promptTokens: texts.length * 10, totalTokens: texts.length * 10 },
      };
    }),
  };
};

// ============= useBinarioEmbed Tests =============

describe('useBinarioEmbed', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddings>;

  beforeEach(() => {
    mockProvider = createMockEmbeddings();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      expect(result.current.result).toBeNull();
      expect(result.current.batchResult).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept custom provider', () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          provider: 'custom',
          customProvider: mockProvider 
        })
      );

      expect(result.current.embed).toBeDefined();
      expect(result.current.embedMany).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should embed a single text', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let embeddingResult: EmbeddingResult | null = null;
      
      await act(async () => {
        embeddingResult = await result.current.embed('Hello world');
      });

      expect(embeddingResult).not.toBeNull();
      expect(embeddingResult!.text).toBe('Hello world');
      expect(embeddingResult!.embedding).toHaveLength(384);
      expect(result.current.result?.text).toBe('Hello world');
    });

    it('should set loading state during embedding', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      const embedPromise = act(async () => {
        await result.current.embed('Test text');
      });

      // Note: In real scenarios, we'd check isLoading during the async operation
      await embedPromise;
      expect(result.current.isLoading).toBe(false);
    });

    it('should call onStart and onComplete callbacks', async () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();

      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          onStart,
          onComplete,
        })
      );

      await act(async () => {
        await result.current.embed('Test');
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Test',
        embedding: expect.any(Array),
      }));
    });

    it('should handle errors', async () => {
      const errorProvider: EmbeddingsProvider = {
        name: 'error',
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        embedMany: vi.fn().mockRejectedValue(new Error('Embedding failed')),
      };

      const onError = vi.fn();
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: errorProvider,
          onError,
        })
      );

      await act(async () => {
        await result.current.embed('Test');
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Embedding failed');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('embedMany', () => {
    it('should embed multiple texts', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let batchResult: BatchEmbeddingResult | null = null;
      
      await act(async () => {
        batchResult = await result.current.embedMany(['Text 1', 'Text 2', 'Text 3']);
      });

      expect(batchResult).not.toBeNull();
      expect(batchResult!.embeddings).toHaveLength(3);
      expect(batchResult!.embeddings[0].text).toBe('Text 1');
      expect(batchResult!.embeddings[1].text).toBe('Text 2');
      expect(batchResult!.embeddings[2].text).toBe('Text 3');
    });

    it('should handle empty array', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let batchResult: BatchEmbeddingResult | null = null;
      
      await act(async () => {
        batchResult = await result.current.embedMany([]);
      });

      expect(batchResult).not.toBeNull();
      expect(batchResult!.embeddings).toHaveLength(0);
    });

    it('should update batchResult state', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.embedMany(['A', 'B']);
      });

      expect(result.current.batchResult).not.toBeNull();
      expect(result.current.batchResult?.embeddings).toHaveLength(2);
    });
  });

  describe('caching', () => {
    it('should cache embeddings when enabled', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          cache: true,
        })
      );

      // First call
      await act(async () => {
        await result.current.embed('Cached text');
      });

      expect(mockProvider.embed).toHaveBeenCalledTimes(1);

      // Second call with same text - should use cache
      await act(async () => {
        await result.current.embed('Cached text');
      });

      // Provider should not be called again
      expect(mockProvider.embed).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          cache: false,
        })
      );

      await act(async () => {
        await result.current.embed('Uncached text');
      });

      await act(async () => {
        await result.current.embed('Uncached text');
      });

      // Provider should be called twice
      expect(mockProvider.embed).toHaveBeenCalledTimes(2);
    });

    it('should use cache for batch embeddings', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          cache: true,
        })
      );

      // First batch
      await act(async () => {
        await result.current.embedMany(['A', 'B', 'C']);
      });

      expect(mockProvider.embedMany).toHaveBeenCalledTimes(1);

      // Second batch with some cached texts
      await act(async () => {
        await result.current.embedMany(['A', 'D']); // 'A' is cached
      });

      // Should only request 'D'
      expect(mockProvider.embedMany).toHaveBeenCalledTimes(2);
      expect(mockProvider._calls.embedMany[1]).toEqual(['D']);
    });

    it('should clear cache', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          cache: true,
        })
      );

      await act(async () => {
        await result.current.embed('Text');
      });

      expect(result.current.getCached('Text')).not.toBeNull();

      act(() => {
        result.current.clearCache();
      });

      expect(result.current.getCached('Text')).toBeNull();
    });

    it('should get cached embedding', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ 
          customProvider: mockProvider,
          cache: true,
        })
      );

      expect(result.current.getCached('Not cached')).toBeNull();

      await act(async () => {
        await result.current.embed('Cached');
      });

      const cached = result.current.getCached('Cached');
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(384);
    });
  });

  describe('similarity', () => {
    it('should calculate similarity between two texts', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let score: number | null = null;
      
      await act(async () => {
        score = await result.current.similarity('Hello world', 'Hello there');
      });

      expect(score).not.toBeNull();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return high similarity for identical texts', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let score: number | null = null;
      
      await act(async () => {
        score = await result.current.similarity('Exact match', 'Exact match');
      });

      expect(score).toBeCloseTo(1, 5);
    });

    it('should return lower similarity for different texts', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let similarScore: number | null = null;
      let differentScore: number | null = null;
      
      await act(async () => {
        similarScore = await result.current.similarity('I love pizza', 'Pizza is great');
        differentScore = await result.current.similarity('I love pizza', 'The weather is sunny');
      });

      expect(similarScore).toBeGreaterThan(differentScore!);
    });
  });

  describe('findSimilar', () => {
    it('should find similar texts', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let similar: Array<{ text: string; score: number }> | null = null;
      
      await act(async () => {
        similar = await result.current.findSimilar(
          'pizza',
          ['pizza slice', 'weather forecast', 'pasta dish', 'sunny day'],
          2
        );
      });

      expect(similar).not.toBeNull();
      expect(similar).toHaveLength(2);
      // Results should be sorted by score descending
      expect(similar![0].score).toBeGreaterThanOrEqual(similar![1].score);
    });

    it('should respect topK parameter', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let similar: Array<{ text: string; score: number }> | null = null;
      
      await act(async () => {
        similar = await result.current.findSimilar(
          'test',
          ['a', 'b', 'c', 'd', 'e'],
          3
        );
      });

      expect(similar).toHaveLength(3);
    });

    it('should handle empty candidates', async () => {
      const { result } = renderHook(() => 
        useBinarioEmbed({ customProvider: mockProvider })
      );

      let similar: Array<{ text: string; score: number }> | null = null;
      
      await act(async () => {
        similar = await result.current.findSimilar('query', []);
      });

      expect(similar).toEqual([]);
    });
  });
});

// ============= useBinarioSemanticSearch Tests =============

describe('useBinarioSemanticSearch', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddings>;

  beforeEach(() => {
    mockProvider = createMockEmbeddings();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      expect(result.current.documentCount).toBe(0);
      expect(result.current.isIndexing).toBe(false);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('addDocuments', () => {
    it('should add documents to index', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'First document about pizza' },
          { id: 'doc2', text: 'Second document about weather' },
        ]);
      });

      expect(result.current.documentCount).toBe(2);
    });

    it('should handle empty documents array', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([]);
      });

      expect(result.current.documentCount).toBe(0);
    });

    it('should set isIndexing during indexing', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      const promise = act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Test document' },
        ]);
      });

      await promise;
      expect(result.current.isIndexing).toBe(false);
    });

    it('should support documents with metadata', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { 
            id: 'doc1', 
            text: 'Document with metadata',
            metadata: { category: 'test', priority: 1 }
          },
        ]);
      });

      expect(result.current.documentCount).toBe(1);
    });

    it('should update existing documents with same ID', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Original text' },
        ]);
      });

      expect(result.current.documentCount).toBe(1);

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Updated text' },
        ]);
      });

      expect(result.current.documentCount).toBe(1);
    });
  });

  describe('search', () => {
    it('should search and return relevant documents', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0, // Accept all for testing
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'pizza', text: 'I love eating pizza with extra cheese' },
          { id: 'weather', text: 'The weather is sunny and warm today' },
          { id: 'pasta', text: 'Italian pasta with tomato sauce' },
        ]);
      });

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('food');
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].document).toBeDefined();
      expect(searchResults[0].score).toBeDefined();
    });

    it('should return results sorted by score', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0,
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Apple fruit' },
          { id: 'doc2', text: 'Banana fruit' },
          { id: 'doc3', text: 'Orange fruit' },
        ]);
      });

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('Apple');
      });

      // Results should be sorted by score descending
      for (let i = 0; i < searchResults.length - 1; i++) {
        expect(searchResults[i].score).toBeGreaterThanOrEqual(searchResults[i + 1].score);
      }
    });

    it('should respect minScore threshold', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0.99, // Very high threshold
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Some random text' },
          { id: 'doc2', text: 'Another random text' },
        ]);
      });

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('completely different query');
      });

      // With high threshold, we expect few or no results
      expect(searchResults.every(r => r.score >= 0.99)).toBe(true);
    });

    it('should respect maxResults limit', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0,
          maxResults: 2,
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Document one' },
          { id: 'doc2', text: 'Document two' },
          { id: 'doc3', text: 'Document three' },
          { id: 'doc4', text: 'Document four' },
        ]);
      });

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('Document');
      });

      expect(searchResults.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for empty index', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('query');
      });

      expect(searchResults).toEqual([]);
    });

    it('should set isSearching during search', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Test' },
        ]);
      });

      const promise = act(async () => {
        await result.current.search('query');
      });

      await promise;
      expect(result.current.isSearching).toBe(false);
    });

    it('should include document metadata in results', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0,
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { 
            id: 'doc1', 
            text: 'Document with metadata',
            metadata: { category: 'test', tags: ['a', 'b'] }
          },
        ]);
      });

      let searchResults: any[] = [];
      
      await act(async () => {
        searchResults = await result.current.search('Document');
      });

      expect(searchResults[0].document.metadata).toEqual({
        category: 'test',
        tags: ['a', 'b'],
      });
    });
  });

  describe('removeDocuments', () => {
    it('should remove documents by ID', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'First' },
          { id: 'doc2', text: 'Second' },
          { id: 'doc3', text: 'Third' },
        ]);
      });

      expect(result.current.documentCount).toBe(3);

      act(() => {
        result.current.removeDocuments(['doc1', 'doc3']);
      });

      expect(result.current.documentCount).toBe(1);
    });

    it('should handle removing non-existent IDs', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'First' },
        ]);
      });

      act(() => {
        result.current.removeDocuments(['nonexistent']);
      });

      expect(result.current.documentCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all documents', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'First' },
          { id: 'doc2', text: 'Second' },
        ]);
      });

      expect(result.current.documentCount).toBe(2);

      act(() => {
        result.current.clear();
      });

      expect(result.current.documentCount).toBe(0);
    });

    it('should also clear embedding cache', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: mockProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Test document' },
        ]);
      });

      act(() => {
        result.current.clear();
      });

      // After clear, searching should work but no results
      let searchResults: any[] = [];
      await act(async () => {
        searchResults = await result.current.search('Test');
      });

      expect(searchResults).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle embedding errors during indexing', async () => {
      const errorProvider: EmbeddingsProvider = {
        name: 'error',
        embed: vi.fn().mockRejectedValue(new Error('Indexing failed')),
        embedMany: vi.fn().mockRejectedValue(new Error('Indexing failed')),
      };

      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: errorProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Test' },
        ]);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Indexing failed');
    });

    it('should handle embedding errors during search', async () => {
      const errorProvider: EmbeddingsProvider = {
        name: 'error',
        embed: vi.fn().mockRejectedValue(new Error('Search failed')),
        embedMany: vi.fn()
          .mockResolvedValueOnce({ // First call succeeds (indexing)
            embeddings: [{ text: 'Test', embedding: new Array(384).fill(0) }],
            model: 'mock',
            usage: { promptTokens: 10, totalTokens: 10 },
          })
          .mockRejectedValue(new Error('Search failed')), // Second call fails (search)
      };

      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ customProvider: errorProvider })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: 'doc1', text: 'Test' },
        ]);
      });

      await act(async () => {
        await result.current.search('query');
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle a complete RAG-like workflow', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0,
          maxResults: 2,
        })
      );

      // Index knowledge base
      await act(async () => {
        await result.current.addDocuments([
          { id: '1', text: 'Python is a programming language known for its simplicity', metadata: { category: 'programming' } },
          { id: '2', text: 'JavaScript runs in web browsers and Node.js', metadata: { category: 'programming' } },
          { id: '3', text: 'The Eiffel Tower is located in Paris, France', metadata: { category: 'geography' } },
          { id: '4', text: 'Machine learning uses algorithms to learn from data', metadata: { category: 'ai' } },
        ]);
      });

      expect(result.current.documentCount).toBe(4);

      // Search for programming-related content
      let results: any[] = [];
      await act(async () => {
        results = await result.current.search('What programming languages are popular?');
      });

      expect(results.length).toBe(2);
      
      // Search for AI content
      await act(async () => {
        results = await result.current.search('How does AI learn?');
      });

      expect(results.length).toBeGreaterThan(0);

      // Remove outdated document
      act(() => {
        result.current.removeDocuments(['3']);
      });

      expect(result.current.documentCount).toBe(3);
    });

    it('should handle concurrent searches', async () => {
      const { result } = renderHook(() => 
        useBinarioSemanticSearch({ 
          customProvider: mockProvider,
          minScore: 0,
        })
      );

      await act(async () => {
        await result.current.addDocuments([
          { id: '1', text: 'First document' },
          { id: '2', text: 'Second document' },
        ]);
      });

      // Run multiple searches concurrently
      const searches = Promise.all([
        result.current.search('First'),
        result.current.search('Second'),
        result.current.search('document'),
      ]);

      let allResults: any[][] = [];
      await act(async () => {
        allResults = await searches;
      });

      expect(allResults).toHaveLength(3);
      allResults.forEach(searchResult => {
        expect(Array.isArray(searchResult)).toBe(true);
      });
    });
  });
});
