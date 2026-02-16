/**
 * Binario RAG Service - Vector Storage and Retrieval
 * Uses Cloudflare Vectorize for persistent embeddings
 */

// Embedding model configuration
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const EMBEDDING_DIMENSIONS = 768;

export interface RagEnv {
  AI: Ai;
  DB: D1Database;
  VECTORIZE_INDEX: VectorizeIndex;
}

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, string | number | boolean>;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

/**
 * Split text into chunks for embedding
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const {
    chunkSize = 500,
    chunkOverlap = 50,
    separator = '\n\n',
  } = options;

  // First split by separator
  const sections = text.split(separator);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    // If section is small enough, add to current chunk
    if (currentChunk.length + section.length + separator.length <= chunkSize) {
      currentChunk += (currentChunk ? separator : '') + section;
    } else {
      // Save current chunk if not empty
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If section is larger than chunk size, split it further
      if (section.length > chunkSize) {
        const words = section.split(' ');
        currentChunk = '';
        
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              // Keep overlap
              const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
              currentChunk = currentChunk.substring(overlapStart) + ' ' + word;
            } else {
              currentChunk = word;
            }
          }
        }
      } else {
        currentChunk = section;
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Generate embeddings for text using Workers AI
 */
export async function generateEmbedding(
  env: RagEnv,
  text: string
): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, {
    text: [text],
  });

  if (!result.data?.[0]) {
    throw new Error('Failed to generate embedding');
  }

  return result.data[0];
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  env: RagEnv,
  texts: string[]
): Promise<number[][]> {
  const result = await env.AI.run(EMBEDDING_MODEL, {
    text: texts,
  });

  if (!result.data || result.data.length !== texts.length) {
    throw new Error('Failed to generate embeddings');
  }

  return result.data;
}

/**
 * Store documents with embeddings in Vectorize
 */
export async function upsertDocuments(
  env: RagEnv,
  documents: Document[],
  namespace?: string
): Promise<{ inserted: number; updated: number }> {
  // Generate embeddings for documents that don't have them
  const docsNeedingEmbeddings = documents.filter(d => !d.embedding);
  
  if (docsNeedingEmbeddings.length > 0) {
    const texts = docsNeedingEmbeddings.map(d => d.content);
    const embeddings = await generateEmbeddings(env, texts);
    
    docsNeedingEmbeddings.forEach((doc, i) => {
      doc.embedding = embeddings[i];
    });
  }

  // Prepare vectors for Vectorize
  const vectors = documents.map(doc => ({
    id: doc.id,
    values: doc.embedding!,
    metadata: {
      content: doc.content.substring(0, 1000), // Vectorize has metadata size limits
      ...doc.metadata,
    },
    namespace,
  }));

  // Upsert to Vectorize
  const result = await env.VECTORIZE_INDEX.upsert(vectors);

  return {
    inserted: result.count || vectors.length,
    updated: 0,
  };
}

/**
 * Search for similar documents
 */
export async function searchDocuments(
  env: RagEnv,
  query: string,
  options: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, unknown>;
    returnContent?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const {
    topK = 5,
    namespace,
    filter,
    returnContent = true,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(env, query);

  // Search Vectorize
  const results = await env.VECTORIZE_INDEX.query(queryEmbedding, {
    topK,
    namespace,
    filter,
    returnMetadata: returnContent ? 'all' : 'none',
    returnValues: false,
  });

  return results.matches.map(match => ({
    id: match.id,
    score: match.score,
    content: returnContent ? (match.metadata?.content as string) : undefined,
    metadata: match.metadata,
  }));
}

/**
 * Delete documents from Vectorize
 */
export async function deleteDocuments(
  env: RagEnv,
  ids: string[],
  namespace?: string
): Promise<{ deleted: number }> {
  await env.VECTORIZE_INDEX.deleteByIds(ids);
  return { deleted: ids.length };
}

/**
 * RAG Query - Search and generate response
 */
export async function ragQuery(
  env: RagEnv,
  query: string,
  options: {
    topK?: number;
    namespace?: string;
    model?: string;
    systemPrompt?: string;
  } = {}
): Promise<{
  answer: string;
  sources: SearchResult[];
}> {
  const {
    topK = 5,
    namespace,
    model = '@cf/meta/llama-3.1-8b-instruct',
    systemPrompt = 'You are a helpful assistant. Answer questions based on the provided context. If you cannot find the answer in the context, say so.',
  } = options;

  // Search for relevant documents
  const sources = await searchDocuments(env, query, { topK, namespace });

  // Build context from sources
  const context = sources
    .map((s, i) => `[${i + 1}] ${s.content}`)
    .join('\n\n');

  // Generate answer
  const response = await env.AI.run(model as BaseAiTextGenerationModels, {
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nContext:\n${context}`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
  });

  const answer = typeof response === 'object' && 'response' in response
    ? (response as { response: string }).response
    : '';

  return { answer, sources };
}

/**
 * Ingest text document - chunk, embed, and store
 */
export async function ingestDocument(
  env: RagEnv,
  content: string,
  options: {
    documentId?: string;
    namespace?: string;
    metadata?: Record<string, string | number | boolean>;
    chunkOptions?: ChunkOptions;
  } = {}
): Promise<{
  documentId: string;
  chunks: number;
  inserted: number;
}> {
  const {
    documentId = crypto.randomUUID(),
    namespace,
    metadata = {},
    chunkOptions,
  } = options;

  // Chunk the document
  const chunks = chunkText(content, chunkOptions);

  // Create documents from chunks
  const documents: Document[] = chunks.map((chunk, i) => ({
    id: `${documentId}_chunk_${i}`,
    content: chunk,
    metadata: {
      ...metadata,
      documentId,
      chunkIndex: i,
      totalChunks: chunks.length,
    },
  }));

  // Store in Vectorize
  const result = await upsertDocuments(env, documents, namespace);

  return {
    documentId,
    chunks: chunks.length,
    inserted: result.inserted,
  };
}

/**
 * Get embedding info
 */
export function getEmbeddingInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}
