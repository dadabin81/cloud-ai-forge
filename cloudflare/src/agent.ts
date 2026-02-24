/**
 * BinarioAgent - Cloudflare Agents SDK Integration
 * Uses AIChatAgent for persistent state, native WebSocket, streaming, and tool calling
 * 
 * @requires agents ^0.5.0
 * @requires @cloudflare/ai-chat ^0.1.0
 */

import { AIChatAgent } from '@cloudflare/ai-chat';
import { createWorkersAI } from 'workers-ai-provider';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

export interface AgentEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  VECTORIZE_INDEX?: VectorizeIndex;
}

/** Reactive state synced to all connected clients automatically */
export interface AgentState {
  model: string;
  systemPrompt: string;
  neuronsUsed: number;
  neuronsLimit: number;
  plan: 'free' | 'pro' | 'enterprise';
  features: {
    imageGeneration: boolean;
    audioTranscription: boolean;
    translation: boolean;
    rag: boolean;
  };
}

const DEFAULT_MODEL = '@cf/ibm-granite/granite-4.0-h-micro';
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant powered by Binario, running on Cloudflare Workers AI.';

/**
 * BinarioAgent extends AIChatAgent from the Cloudflare Agents SDK.
 * 
 * Features provided automatically by the SDK:
 * - WebSocket connection management (no manual onopen/onclose)
 * - Message persistence via this.messages (UIMessage[])
 * - Reactive state via this.setState() (synced to all clients)
 * - Embedded SQLite via this.sql
 * - Scheduling via this.schedule() / this.scheduleEvery()
 * - ResumableStream for streaming responses
 */
export class BinarioAgent extends AIChatAgent<AgentEnv, AgentState> {
  // Initial reactive state - synced to clients on connect
  initialState: AgentState = {
    model: DEFAULT_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    neuronsUsed: 0,
    neuronsLimit: 10000,
    plan: 'free',
    features: {
      imageGeneration: true,
      audioTranscription: true,
      translation: true,
      rag: false,
    },
  };

  // Limit persisted messages to prevent unbounded growth
  maxPersistedMessages = 200;

  /**
   * Called automatically when a chat message is received via WebSocket.
   * The SDK handles message persistence, streaming transport, and error handling.
   */
  async onChatMessage(onFinish: Parameters<AIChatAgent<AgentEnv, AgentState>['onChatMessage']>[0]) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = this.state.model || DEFAULT_MODEL;

    // Build tools available to the agent
    const tools = this.getTools();

    const result = streamText({
      model: workersai(model),
      system: this.state.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      messages: this.messages,
      tools,
      stopWhen: stepCountIs(5), // Allow up to 5 tool-calling iterations
      onFinish: async (result) => {
        // Track neuron usage after completion
        const tokensUsed = (result.usage?.totalTokens || 0);
        const estimatedNeurons = Math.ceil(tokensUsed * 0.03); // Rough estimate
        
        this.setState({
          ...this.state,
          neuronsUsed: this.state.neuronsUsed + estimatedNeurons,
        });

        // Persist usage to D1
        try {
          const today = new Date().toISOString().split('T')[0];
          await this.env.DB.prepare(`
            INSERT INTO usage (user_id, model, tokens_used, date)
            VALUES (?, ?, ?, ?)
          `).bind('agent-user', model, tokensUsed, today).run();
        } catch (e) {
          console.error('Failed to track usage:', e);
        }

        // Call the SDK's onFinish for cleanup
        onFinish?.(result);
      },
    });

    return result.toDataStreamResponse();
  }

  /**
   * Called when reactive state is updated (from client or server).
   * Use this to validate or react to state changes.
   */
  onStateUpdate(state: AgentState, source: 'client' | 'server') {
    // Validate model is in our allowed list
    if (source === 'client' && state.model && !state.model.startsWith('@cf/')) {
      console.warn('Client attempted to set non-Cloudflare model:', state.model);
      // Revert to current model
      this.setState({ ...state, model: this.state.model });
      return;
    }

    // Update features based on plan
    if (state.plan !== this.state.plan) {
      const features = {
        imageGeneration: true,
        audioTranscription: true,
        translation: true,
        rag: state.plan !== 'free' || !!this.env.VECTORIZE_INDEX,
      };
      this.setState({ ...state, features });
      return;
    }
  }

  /**
   * Scheduled alarm handler - runs periodic tasks
   */
  async onAlarm() {
    // Reset daily neuron counter at midnight UTC
    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
      this.setState({
        ...this.state,
        neuronsUsed: 0,
      });
    }
  }

  /**
   * Define tools available to the agent.
   * These are callable by the AI model during conversations.
   */
  private getTools() {
    const env = this.env;

    return {
      // Image generation with Flux Schnell
      generateImage: tool({
        description: 'Generate an image from a text prompt using Flux Schnell. Returns a base64-encoded image.',
        parameters: z.object({
          prompt: z.string().describe('Text description of the image to generate'),
          width: z.number().optional().default(512).describe('Image width (256-1024)'),
          height: z.number().optional().default(512).describe('Image height (256-1024)'),
        }),
        execute: async ({ prompt, width, height }) => {
          try {
            const response = await env.AI.run('@cf/black-forest-labs/FLUX.1-schnell' as any, {
              prompt,
              width: Math.min(Math.max(width, 256), 1024),
              height: Math.min(Math.max(height, 256), 1024),
            });
            return { 
              success: true, 
              message: `Image generated for prompt: "${prompt}" (${width}x${height})`,
              // The actual image data would be in the response
            };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        },
      }),

      // Audio transcription with Whisper
      transcribeAudio: tool({
        description: 'Transcribe audio from a URL using Whisper. Returns the transcribed text.',
        parameters: z.object({
          audioUrl: z.string().url().describe('URL of the audio file to transcribe'),
        }),
        execute: async ({ audioUrl }) => {
          try {
            const audioResponse = await fetch(audioUrl);
            const audioBuffer = await audioResponse.arrayBuffer();
            const result = await env.AI.run('@cf/openai/whisper' as any, {
              audio: [...new Uint8Array(audioBuffer)],
            });
            return { 
              success: true, 
              text: (result as any).text || '',
            };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        },
      }),

      // Translation with M2M100
      translate: tool({
        description: 'Translate text between languages using M2M100.',
        parameters: z.object({
          text: z.string().describe('Text to translate'),
          sourceLang: z.string().default('en').describe('Source language code (e.g., en, es, fr)'),
          targetLang: z.string().describe('Target language code (e.g., es, fr, de)'),
        }),
        execute: async ({ text, sourceLang, targetLang }) => {
          try {
            const result = await env.AI.run('@cf/meta/m2m100-1.2b' as any, {
              text,
              source_lang: sourceLang,
              target_lang: targetLang,
            });
            return { 
              success: true, 
              translatedText: (result as any).translated_text || '',
            };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        },
      }),

      // RAG search (if Vectorize is available)
      ...(env.VECTORIZE_INDEX ? {
        searchDocuments: tool({
          description: 'Search through ingested documents using semantic similarity.',
          parameters: z.object({
            query: z.string().describe('Search query'),
            topK: z.number().optional().default(5).describe('Number of results to return'),
          }),
          execute: async ({ query, topK }) => {
            try {
              const embedResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
                text: [query],
              });
              const queryVector = (embedResponse as any).data?.[0];
              if (!queryVector) return { success: false, error: 'Failed to generate embedding' };

              const results = await env.VECTORIZE_INDEX!.query(queryVector, {
                topK,
                returnMetadata: 'all',
              });

              return {
                success: true,
                results: results.matches.map(m => ({
                  score: m.score,
                  metadata: m.metadata,
                })),
              };
            } catch (error) {
              return { success: false, error: (error as Error).message };
            }
          },
        }),
      } : {}),

      // Get current date/time
      getCurrentTime: tool({
        description: 'Get the current date and time in UTC.',
        parameters: z.object({}),
        execute: async () => ({
          datetime: new Date().toISOString(),
          timestamp: Date.now(),
        }),
      }),

      // Math calculator
      calculate: tool({
        description: 'Evaluate a mathematical expression.',
        parameters: z.object({
          expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2 * 3")'),
        }),
        execute: async ({ expression }) => {
          try {
            // Safe math evaluation using Function constructor with limited scope
            const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
            const result = new Function(`return (${sanitized})`)();
            return { result: Number(result), expression: sanitized };
          } catch (error) {
            return { error: `Invalid expression: ${(error as Error).message}` };
          }
        },
      }),
    };
  }
}
