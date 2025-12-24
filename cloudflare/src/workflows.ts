/**
 * Binario Workflows - Multi-step Agent Execution
 * Uses Cloudflare Workflows for durable, retryable task execution
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// Environment interface for workflows
export interface WorkflowEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  VECTORIZE_INDEX: VectorizeIndex;
}

// ============ Research Workflow ============
// Multi-step workflow for research tasks: analyze -> search -> synthesize

interface ResearchPayload {
  query: string;
  userId: string;
  model?: string;
  topK?: number;
  includeRag?: boolean;
}

interface ResearchResult {
  query: string;
  analysis: string;
  sources: Array<{ id: string; score: number; content?: string }>;
  answer: string;
  steps: string[];
  duration: number;
}

export class ResearchWorkflow extends WorkflowEntrypoint<WorkflowEnv, ResearchPayload> {
  async run(event: WorkflowEvent<ResearchPayload>, step: WorkflowStep): Promise<ResearchResult> {
    const startTime = Date.now();
    const { query, userId, model = '@cf/meta/llama-3.1-8b-instruct', topK = 5, includeRag = true } = event.payload;
    const steps: string[] = [];

    // Step 1: Analyze the query to understand intent
    const analysis = await step.do('analyze-query', async () => {
      steps.push('analyze-query');
      
      const response = await this.env.AI.run(model as BaseAiTextGenerationModels, {
        messages: [
          {
            role: 'system',
            content: `You are a research assistant. Analyze the following query and identify:
1. The main topic or subject
2. Key concepts to search for
3. The type of answer expected (factual, opinion, explanation, etc.)

Be concise and structured in your analysis.`,
          },
          { role: 'user', content: query },
        ],
      });

      return typeof response === 'object' && 'response' in response
        ? (response as { response: string }).response
        : '';
    });

    // Step 2: Search for relevant context (if RAG is enabled)
    let sources: Array<{ id: string; score: number; content?: string }> = [];
    
    if (includeRag) {
      sources = await step.do('search-context', async () => {
        steps.push('search-context');

        try {
          // Generate embedding for the query
          const embeddingResult = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [query],
          });

          if (!embeddingResult.data?.[0]) {
            return [];
          }

          // Search Vectorize
          const results = await this.env.VECTORIZE_INDEX.query(embeddingResult.data[0], {
            topK,
            namespace: userId,
            returnMetadata: 'all',
          });

          return results.matches.map(match => ({
            id: match.id,
            score: match.score,
            content: match.metadata?.content as string | undefined,
          }));
        } catch (error) {
          console.error('Search error:', error);
          return [];
        }
      });
    }

    // Step 3: Synthesize the final answer
    const answer = await step.do('synthesize-answer', async () => {
      steps.push('synthesize-answer');

      const contextText = sources.length > 0
        ? `\n\nRelevant Context:\n${sources.map((s, i) => `[${i + 1}] ${s.content || 'No content available'}`).join('\n\n')}`
        : '';

      const response = await this.env.AI.run(model as BaseAiTextGenerationModels, {
        messages: [
          {
            role: 'system',
            content: `You are a knowledgeable research assistant. Based on your analysis and the provided context, give a comprehensive and accurate answer.

Query Analysis:
${analysis}
${contextText}

Provide a clear, well-structured response. If using information from the context, reference the source numbers.`,
          },
          { role: 'user', content: query },
        ],
      });

      return typeof response === 'object' && 'response' in response
        ? (response as { response: string }).response
        : '';
    });

    // Step 4: Log the result to database
    await step.do('log-result', async () => {
      steps.push('log-result');

      try {
        await this.env.DB.prepare(`
          INSERT INTO agent_logs (user_id, agent_id, prompt, result, tool_calls, iterations, status)
          VALUES (?, 'research-workflow', ?, ?, ?, ?, 'completed')
        `).bind(
          userId,
          query,
          answer,
          JSON.stringify({ analysis, sources: sources.length }),
          steps.length
        ).run();
      } catch (error) {
        console.error('Failed to log result:', error);
      }
    });

    return {
      query,
      analysis,
      sources,
      answer,
      steps,
      duration: Date.now() - startTime,
    };
  }
}

// ============ RAG Workflow ============
// Workflow for document ingestion with chunking and embedding

interface RAGPayload {
  content: string;
  documentId: string;
  userId: string;
  metadata?: Record<string, string | number | boolean>;
  chunkSize?: number;
  chunkOverlap?: number;
}

interface RAGResult {
  documentId: string;
  chunks: number;
  embedded: number;
  duration: number;
  steps: string[];
}

export class RAGWorkflow extends WorkflowEntrypoint<WorkflowEnv, RAGPayload> {
  async run(event: WorkflowEvent<RAGPayload>, step: WorkflowStep): Promise<RAGResult> {
    const startTime = Date.now();
    const { 
      content, 
      documentId, 
      userId, 
      metadata = {},
      chunkSize = 500,
      chunkOverlap = 50,
    } = event.payload;
    const steps: string[] = [];

    // Step 1: Split content into chunks
    const chunks = await step.do('split-document', async () => {
      steps.push('split-document');

      const sections = content.split(/\n\n+/);
      const result: string[] = [];
      let currentChunk = '';

      for (const section of sections) {
        if (currentChunk.length + section.length + 2 <= chunkSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + section;
        } else {
          if (currentChunk) {
            result.push(currentChunk);
          }

          if (section.length > chunkSize) {
            // Split large sections by words
            const words = section.split(' ');
            currentChunk = '';
            
            for (const word of words) {
              if (currentChunk.length + word.length + 1 <= chunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + word;
              } else {
                if (currentChunk) {
                  result.push(currentChunk);
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

      if (currentChunk) {
        result.push(currentChunk);
      }

      return result;
    });

    // Step 2: Generate embeddings for each chunk (in batches)
    const batchSize = 10;
    let embeddedCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize);
      const batch = chunks.slice(i, i + batchSize);

      await step.do(`embed-batch-${batchIndex}`, async () => {
        steps.push(`embed-batch-${batchIndex}`);

        // Generate embeddings for this batch
        const embeddingResult = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: batch,
        });

        if (!embeddingResult.data || embeddingResult.data.length !== batch.length) {
          throw new Error(`Embedding failed for batch ${batchIndex}`);
        }

        // Prepare vectors for upsert
        const vectors = batch.map((chunk, j) => ({
          id: `${documentId}_chunk_${i + j}`,
          values: embeddingResult.data[j],
          metadata: {
            content: chunk.substring(0, 1000),
            documentId,
            chunkIndex: i + j,
            totalChunks: chunks.length,
            ...metadata,
          },
          namespace: userId,
        }));

        // Upsert to Vectorize
        await this.env.VECTORIZE_INDEX.upsert(vectors);
        embeddedCount += batch.length;
      });
    }

    // Step 3: Update database with document info
    await step.do('update-database', async () => {
      steps.push('update-database');

      try {
        // Store document metadata in KV for quick lookup
        await this.env.KV.put(
          `doc:${userId}:${documentId}`,
          JSON.stringify({
            documentId,
            chunks: chunks.length,
            metadata,
            createdAt: new Date().toISOString(),
          }),
          { expirationTtl: 60 * 60 * 24 * 365 } // 1 year
        );
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    });

    return {
      documentId,
      chunks: chunks.length,
      embedded: embeddedCount,
      duration: Date.now() - startTime,
      steps,
    };
  }
}
