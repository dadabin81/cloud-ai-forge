// Cloudflare Worker Template for Binario
// Professional, type-safe template for deploying AI applications on Workers

import type { Message } from '../types';

// Cloudflare Workers types (available when deployed to Workers)
declare global {
  interface Ai {
    run(model: string, options: unknown): Promise<unknown>;
  }
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<D1ExecResult>;
  }
  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    run(): Promise<D1Result>;
    first<T = unknown>(column?: string): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
  }
  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
  }
  interface D1ExecResult {
    count: number;
    duration: number;
  }
  interface KVNamespace {
    get(key: string, type?: 'text' | 'json'): Promise<unknown>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  }
  interface R2Bucket {
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: ArrayBuffer | string, options?: { customMetadata?: Record<string, string> }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string }): Promise<{ objects: Array<{ key: string }> }>;
  }
  interface R2Object {
    arrayBuffer(): Promise<ArrayBuffer>;
  }
}

/**
 * Cloudflare Worker environment bindings
 */
export interface WorkerEnv {
  // AI binding for Workers AI
  AI: Ai;
  // D1 database for persistent storage
  DB?: D1Database;
  // KV namespace for caching and sessions
  CACHE?: KVNamespace;
  // R2 bucket for file storage
  BUCKET?: R2Bucket;
  // Secrets
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  LOVABLE_API_KEY?: string;
}

/**
 * Request context passed to handlers
 */
export interface RequestContext {
  env: WorkerEnv;
  request: Request;
  url: URL;
  headers: Headers;
}

/**
 * Chat request body
 */
export interface ChatRequestBody {
  messages: Message[];
  options?: Partial<ChatOptions>;
  stream?: boolean;
  sessionId?: string;
}

/**
 * Session data stored in KV
 */
export interface SessionData {
  id: string;
  createdAt: number;
  lastActivity: number;
  messages: Message[];
  metadata: Record<string, unknown>;
}

/**
 * Conversation stored in D1
 */
export interface ConversationRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
}

/**
 * CORS headers for API responses
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a streaming response with CORS headers
 */
export function streamResponse(body: ReadableStream): Response {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Session management utilities
 */
export const SessionManager = {
  /**
   * Get or create a session
   */
  async getOrCreate(kv: KVNamespace, sessionId?: string): Promise<SessionData> {
    if (sessionId) {
      const existing = await kv.get(`session:${sessionId}`, 'json');
      if (existing) {
        return existing as SessionData;
      }
    }

    const newSession: SessionData = {
      id: sessionId || crypto.randomUUID(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      metadata: {},
    };

    await kv.put(`session:${newSession.id}`, JSON.stringify(newSession), {
      expirationTtl: 86400 * 7, // 7 days
    });

    return newSession;
  },

  /**
   * Update session with new messages
   */
  async update(kv: KVNamespace, session: SessionData, newMessages: Message[]): Promise<void> {
    session.messages.push(...newMessages);
    session.lastActivity = Date.now();
    await kv.put(`session:${session.id}`, JSON.stringify(session), {
      expirationTtl: 86400 * 7,
    });
  },

  /**
   * Delete a session
   */
  async delete(kv: KVNamespace, sessionId: string): Promise<void> {
    await kv.delete(`session:${sessionId}`);
  },
};

/**
 * D1 database utilities
 */
export const DatabaseManager = {
  /**
   * Initialize database tables
   */
  async init(db: D1Database): Promise<void> {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        model TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_session_id ON conversations(session_id);
    `);
  },

  /**
   * Save a message
   */
  async saveMessage(
    db: D1Database,
    sessionId: string,
    message: Message,
    tokens: { in: number; out: number },
    model: string
  ): Promise<void> {
    await db
      .prepare(
        `INSERT INTO conversations (id, session_id, role, content, tokens_in, tokens_out, model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), sessionId, message.role, message.content, tokens.in, tokens.out, model)
      .run();
  },

  /**
   * Get conversation history
   */
  async getHistory(db: D1Database, sessionId: string, limit: number = 50): Promise<Message[]> {
    const result = await db
      .prepare(
        `SELECT role, content FROM conversations 
       WHERE session_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`
      )
      .bind(sessionId, limit)
      .all<{ role: string; content: string }>();

    return (result.results || []).reverse().map((r) => ({
      role: r.role as Message['role'],
      content: r.content,
    }));
  },

  /**
   * Get usage stats
   */
  async getUsageStats(
    db: D1Database,
    sessionId?: string
  ): Promise<{
    totalMessages: number;
    totalTokensIn: number;
    totalTokensOut: number;
  }> {
    const query = sessionId
      ? `SELECT COUNT(*) as count, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out 
         FROM conversations WHERE session_id = ?`
      : `SELECT COUNT(*) as count, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out 
         FROM conversations`;

    const result = sessionId
      ? await db.prepare(query).bind(sessionId).first<{ count: number; tokens_in: number; tokens_out: number }>()
      : await db.prepare(query).first<{ count: number; tokens_in: number; tokens_out: number }>();

    return {
      totalMessages: result?.count || 0,
      totalTokensIn: result?.tokens_in || 0,
      totalTokensOut: result?.tokens_out || 0,
    };
  },
};

/**
 * R2 file storage utilities
 */
export const StorageManager = {
  /**
   * Upload a file
   */
  async upload(bucket: R2Bucket, key: string, data: ArrayBuffer | string, metadata?: Record<string, string>): Promise<void> {
    await bucket.put(key, data, {
      customMetadata: metadata,
    });
  },

  /**
   * Download a file
   */
  async download(bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
    const object = await bucket.get(key);
    if (!object) return null;
    return object.arrayBuffer();
  },

  /**
   * Delete a file
   */
  async delete(bucket: R2Bucket, key: string): Promise<void> {
    await bucket.delete(key);
  },

  /**
   * List files with prefix
   */
  async list(bucket: R2Bucket, prefix?: string): Promise<string[]> {
    const list = await bucket.list({ prefix });
    return list.objects.map((o) => o.key);
  },
};

/**
 * Create a complete Worker handler
 */
export function createWorkerHandler(options: {
  systemPrompt?: string;
  model?: string;
  enableD1?: boolean;
  enableKV?: boolean;
  enableR2?: boolean;
  beforeChat?: (ctx: RequestContext, body: ChatRequestBody) => Promise<void>;
  afterChat?: (ctx: RequestContext, response: unknown) => Promise<void>;
}) {
  return {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
      // Handle CORS
      const corsResponse = handleCors(request);
      if (corsResponse) return corsResponse;

      const url = new URL(request.url);
      const ctx: RequestContext = {
        env,
        request,
        url,
        headers: request.headers,
      };

      try {
        // Route handling
        if (url.pathname === '/chat' && request.method === 'POST') {
          const body = (await request.json()) as ChatRequestBody;

          // Before chat hook
          if (options.beforeChat) {
            await options.beforeChat(ctx, body);
          }

          // Get messages
          const messages: Message[] = options.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }, ...body.messages]
            : body.messages;

          // Run AI
          const result = await env.AI.run(options.model || '@cf/meta/llama-3.2-1b-instruct', {
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: body.stream,
          });

          // Handle streaming
          if (body.stream && result instanceof ReadableStream) {
            return streamResponse(result);
          }

          // After chat hook
          if (options.afterChat) {
            await options.afterChat(ctx, result);
          }

          return jsonResponse(result);
        }

        if (url.pathname === '/health') {
          return jsonResponse({ status: 'ok', timestamp: Date.now() });
        }

        return errorResponse('Not found', 404);
      } catch (error) {
        console.error('Worker error:', error);
        return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
      }
    },
  };
}

/**
 * Example usage:
 * 
 * export default createWorkerHandler({
 *   systemPrompt: 'You are a helpful assistant.',
 *   model: '@cf/meta/llama-3.2-1b-instruct',
 *   enableD1: true,
 *   enableKV: true,
 * });
 */
