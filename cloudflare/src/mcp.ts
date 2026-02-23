/**
 * BinarioMCP - MCP Server as a Cloudflare Durable Object
 * Exposes Binario's AI capabilities as standard MCP tools and resources
 * 
 * External agents (Claude Desktop, Cursor, Windsurf, etc.) can connect
 * via SSE at /mcp/sse to access all Binario tools.
 * 
 * @requires agents ^0.5.0
 * @requires @modelcontextprotocol/sdk ^1.12.1
 */

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export interface MCPEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  VECTORIZE_INDEX?: VectorizeIndex;
}

/**
 * BinarioMCP extends McpAgent from the Cloudflare Agents SDK.
 * 
 * Capabilities exposed via MCP:
 * - Tools: chat, generate_image, transcribe_audio, translate, embed, rag_search, rag_query
 * - Resources: models list, usage stats, platform info
 */
export class BinarioMCP extends McpAgent<MCPEnv> {
  server = new McpServer({
    name: 'Binario AI',
    version: '1.0.0',
  });

  async init() {
    // ============ TOOLS ============

    // Chat completion
    this.server.tool(
      'chat',
      'Send a message to an AI model and get a response. Supports all Cloudflare Workers AI models.',
      {
        message: z.string().describe('The message to send to the AI'),
        model: z.string().optional().describe('Model ID (defaults to granite-4.0-h-micro)'),
        temperature: z.number().min(0).max(2).optional().describe('Sampling temperature'),
        maxTokens: z.number().optional().describe('Maximum tokens in response'),
        systemPrompt: z.string().optional().describe('System prompt for the conversation'),
      },
      async ({ message, model, temperature, maxTokens, systemPrompt }) => {
        const cfModel = model || '@cf/ibm-granite/granite-4.0-h-micro';
        
        const messages = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: message },
        ];

        const response = await this.env.AI.run(cfModel as any, {
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 1024,
        });

        const content = (response as any).response || '';
        
        return {
          content: [{ type: 'text' as const, text: content }],
        };
      }
    );

    // Image generation
    this.server.tool(
      'generate_image',
      'Generate an image from a text description using Flux Schnell (free, ~2000 images/day).',
      {
        prompt: z.string().describe('Text description of the image to generate'),
        width: z.number().min(256).max(1024).optional().describe('Image width'),
        height: z.number().min(256).max(1024).optional().describe('Image height'),
      },
      async ({ prompt, width, height }) => {
        const response = await this.env.AI.run('@cf/black-forest-labs/FLUX.1-schnell' as any, {
          prompt,
          width: width || 512,
          height: height || 512,
        });

        // Response contains image data
        const imageData = response as any;
        
        return {
          content: [{
            type: 'text' as const,
            text: `Image generated successfully for prompt: "${prompt}" (${width || 512}x${height || 512})`,
          }],
        };
      }
    );

    // Audio transcription
    this.server.tool(
      'transcribe_audio',
      'Transcribe audio from a URL using Whisper (free, ~243 minutes/day).',
      {
        audioUrl: z.string().url().describe('URL of the audio file to transcribe'),
      },
      async ({ audioUrl }) => {
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          return {
            content: [{ type: 'text' as const, text: `Failed to fetch audio: ${audioResponse.statusText}` }],
            isError: true,
          };
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const result = await this.env.AI.run('@cf/openai/whisper' as any, {
          audio: [...new Uint8Array(audioBuffer)],
        });

        return {
          content: [{ type: 'text' as const, text: (result as any).text || '' }],
        };
      }
    );

    // Translation
    this.server.tool(
      'translate',
      'Translate text between languages using M2M100 (free, supports 100+ languages).',
      {
        text: z.string().describe('Text to translate'),
        sourceLang: z.string().describe('Source language code (e.g., en, es, fr, de, zh, ja)'),
        targetLang: z.string().describe('Target language code'),
      },
      async ({ text, sourceLang, targetLang }) => {
        const result = await this.env.AI.run('@cf/meta/m2m100-1.2b' as any, {
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
        });

        return {
          content: [{ type: 'text' as const, text: (result as any).translated_text || '' }],
        };
      }
    );

    // Embeddings
    this.server.tool(
      'embed',
      'Generate text embeddings using BGE-Base (768 dimensions). Useful for semantic search and similarity.',
      {
        text: z.string().describe('Text to generate embeddings for'),
      },
      async ({ text }) => {
        const result = await this.env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
          text: [text],
        });

        const embedding = (result as any).data?.[0] || [];
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dimensions: embedding.length,
              embedding: embedding.slice(0, 10).map((v: number) => v.toFixed(4)),
              note: `Full ${embedding.length}-dimensional embedding generated. Showing first 10 values.`,
            }),
          }],
        };
      }
    );

    // RAG Search (if Vectorize available)
    this.server.tool(
      'rag_search',
      'Search through ingested documents using semantic similarity (requires Vectorize index).',
      {
        query: z.string().describe('Search query'),
        topK: z.number().min(1).max(50).optional().describe('Number of results'),
      },
      async ({ query, topK }) => {
        if (!this.env.VECTORIZE_INDEX) {
          return {
            content: [{ type: 'text' as const, text: 'RAG not configured. Vectorize index is not bound.' }],
            isError: true,
          };
        }

        // Generate query embedding
        const embedResponse = await this.env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
          text: [query],
        });
        const queryVector = (embedResponse as any).data?.[0];
        if (!queryVector) {
          return {
            content: [{ type: 'text' as const, text: 'Failed to generate query embedding' }],
            isError: true,
          };
        }

        const results = await this.env.VECTORIZE_INDEX.query(queryVector, {
          topK: topK || 5,
          returnMetadata: 'all',
        });

        const formatted = results.matches.map((m, i) => 
          `[${i + 1}] Score: ${m.score.toFixed(3)} | ${JSON.stringify(m.metadata || {})}`
        ).join('\n');

        return {
          content: [{ type: 'text' as const, text: formatted || 'No results found.' }],
        };
      }
    );

    // RAG Query (search + answer)
    this.server.tool(
      'rag_query',
      'Search documents and generate an AI answer using the found context (RAG pipeline).',
      {
        query: z.string().describe('Question to answer using document context'),
        model: z.string().optional().describe('Model for answer generation'),
        topK: z.number().optional().describe('Number of context documents'),
      },
      async ({ query, model, topK }) => {
        if (!this.env.VECTORIZE_INDEX) {
          return {
            content: [{ type: 'text' as const, text: 'RAG not configured.' }],
            isError: true,
          };
        }

        // Search for context
        const embedResponse = await this.env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
          text: [query],
        });
        const queryVector = (embedResponse as any).data?.[0];
        if (!queryVector) {
          return { content: [{ type: 'text' as const, text: 'Failed to embed query' }], isError: true };
        }

        const results = await this.env.VECTORIZE_INDEX.query(queryVector, {
          topK: topK || 5,
          returnMetadata: 'all',
        });

        const context = results.matches
          .map(m => (m.metadata as any)?.text || '')
          .filter(Boolean)
          .join('\n\n---\n\n');

        if (!context) {
          return { content: [{ type: 'text' as const, text: 'No relevant documents found.' }] };
        }

        // Generate answer
        const answerModel = model || '@cf/meta/llama-3.1-8b-instruct';
        const response = await this.env.AI.run(answerModel as any, {
          messages: [
            { role: 'system', content: `Answer the question using ONLY the provided context. If the context doesn't contain the answer, say so.\n\nContext:\n${context}` },
            { role: 'user', content: query },
          ],
        });

        return {
          content: [{
            type: 'text' as const,
            text: (response as any).response || 'No answer generated.',
          }],
        };
      }
    );

    // ============ RESOURCES ============

    // Available models
    this.server.resource(
      'models',
      'binario://models',
      async (uri) => ({
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            models: [
              { id: '@cf/ibm-granite/granite-4.0-h-micro', name: 'Granite Micro', tier: 'free', category: 'efficient' },
              { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', tier: 'free', category: 'efficient' },
              { id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', name: 'Llama 3.1 8B', tier: 'free', category: 'code' },
              { id: '@cf/qwen/qwen3-30b-a3b-fp8', name: 'Qwen3 30B', tier: 'pro', category: 'quality' },
              { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', category: 'quality' },
              { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', tier: 'pro', category: 'reasoning' },
            ],
            services: [
              { model: '@cf/black-forest-labs/FLUX.1-schnell', type: 'image-generation', free: true },
              { model: '@cf/openai/whisper', type: 'audio-transcription', free: true },
              { model: '@cf/meta/m2m100-1.2b', type: 'translation', free: true },
              { model: '@cf/baai/bge-base-en-v1.5', type: 'embeddings', free: true },
            ],
          }, null, 2),
        }],
      })
    );

    // Platform info
    this.server.resource(
      'platform',
      'binario://platform',
      async (uri) => ({
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            name: 'Binario AI',
            version: '1.0.0',
            runtime: 'Cloudflare Workers',
            features: [
              'Chat completion (16+ models)',
              'Image generation (Flux Schnell)',
              'Audio transcription (Whisper)',
              'Translation (M2M100, 100+ languages)',
              'Embeddings (BGE-Base)',
              'RAG (Vectorize)',
              'Structured output (JSON schema)',
              'Agent framework (tool calling)',
              'Real-time WebSocket chat',
              'MCP server (this!)',
            ],
          }, null, 2),
        }],
      })
    );
  }
}
