// Binario Backend - Cloudflare Worker API Gateway
// This is the server that handles all SDK requests

import type { Message, Tool, ChatResponse } from '../types';

// Worker Environment Types
interface Env {
  AI: any;
  DB: D1Database;
  KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
}

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Binario-SDK',
};

// Rate limit tiers
const RATE_LIMITS = {
  free: { requestsPerMinute: 10, requestsPerDay: 1000 },
  pro: { requestsPerMinute: 100, requestsPerDay: 50000 },
  enterprise: { requestsPerMinute: 1000, requestsPerDay: Infinity },
};

// Model routing configuration
const MODEL_ROUTING = {
  // Default models by tier
  free: '@cf/meta/llama-3.2-1b-instruct',
  pro: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  enterprise: '@hf/nousresearch/hermes-2-pro-mistral-7b',
};

// Request/Response types
interface ChatRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: Tool[];
  stream?: boolean;
}

interface AgentRequest {
  message: string;
  name?: string;
  systemPrompt?: string;
  tools: Tool[];
  maxIterations?: number;
  model?: string;
}

interface ApiKeyInfo {
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  keyId: string;
}

// Main Worker Handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Authenticate request
      const authHeader = request.headers.get('Authorization');
      const apiKey = authHeader?.replace('Bearer ', '');
      
      // Skip auth for public endpoints
      const publicPaths = ['/health', '/v1/models'];
      if (!publicPaths.includes(path)) {
        if (!apiKey) {
          return jsonError('Missing API key', 401);
        }
        
        const keyInfo = await validateApiKey(env.DB, apiKey);
        if (!keyInfo) {
          return jsonError('Invalid API key', 401);
        }

        // Check rate limits
        const rateLimit = await checkRateLimit(env.KV, keyInfo);
        if (!rateLimit.allowed) {
          return jsonError('Rate limit exceeded', 429, {
            'Retry-After': String(rateLimit.retryAfter),
          });
        }

        // Attach key info to request context
        (request as any).keyInfo = keyInfo;
      }

      // Route requests
      switch (path) {
        case '/health':
          return jsonResponse({ status: 'ok', version: '1.0.0' });

        case '/v1/models':
          return jsonResponse(getAvailableModels());

        case '/v1/chat/completions':
          return await handleChat(request, env);

        case '/v1/chat/stream':
          return await handleChatStream(request, env);

        case '/v1/agents/run':
          return await handleAgentRun(request, env);

        case '/v1/agents/stream':
          return await handleAgentStream(request, env);

        case '/v1/usage':
          return await handleUsage(request, env);

        default:
          return jsonError('Not found', 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return jsonError(
        error instanceof Error ? error.message : 'Internal error',
        500
      );
    }
  },
};

// Chat completion handler
async function handleChat(request: Request, env: Env): Promise<Response> {
  const body: ChatRequest = await request.json();
  const keyInfo: ApiKeyInfo = (request as any).keyInfo;
  
  const model = body.model || MODEL_ROUTING[keyInfo.plan];
  
  try {
    // Use Cloudflare AI
    const response = await env.AI.run(model, {
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    });

    // Track usage
    await trackUsage(env.DB, keyInfo.userId, {
      model,
      inputTokens: estimateTokens(body.messages),
      outputTokens: estimateTokens([{ content: response.response }]),
    });

    return jsonResponse({
      content: response.response,
      model,
      usage: {
        inputTokens: estimateTokens(body.messages),
        outputTokens: estimateTokens([{ content: response.response }]),
      },
    });
  } catch (error) {
    // Fallback to OpenRouter if available
    if (env.OPENROUTER_API_KEY) {
      return await handleChatWithOpenRouter(body, env);
    }
    throw error;
  }
}

// Streaming chat handler
async function handleChatStream(request: Request, env: Env): Promise<Response> {
  const body: ChatRequest = await request.json();
  const keyInfo: ApiKeyInfo = (request as any).keyInfo;
  
  const model = body.model || MODEL_ROUTING[keyInfo.plan];
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      try {
        const response = await env.AI.run(model, {
          messages: body.messages,
          temperature: body.temperature,
          max_tokens: body.max_tokens,
          stream: true,
        });

        // Handle streaming response
        if (response[Symbol.asyncIterator]) {
          for await (const chunk of response) {
            const data = JSON.stringify({
              choices: [{
                delta: { content: chunk.response || chunk },
              }],
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } else {
          // Non-streaming fallback
          const data = JSON.stringify({
            choices: [{
              delta: { content: response.response },
            }],
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

        // Track usage async
        trackUsage(env.DB, keyInfo.userId, {
          model,
          inputTokens: estimateTokens(body.messages),
          outputTokens: 100, // Estimate for streaming
        });
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

// Agent run handler
async function handleAgentRun(request: Request, env: Env): Promise<Response> {
  const body: AgentRequest = await request.json();
  const keyInfo: ApiKeyInfo = (request as any).keyInfo;
  
  const model = body.model || '@hf/nousresearch/hermes-2-pro-mistral-7b';
  const maxIterations = body.maxIterations || 10;
  
  const messages: Message[] = [];
  if (body.systemPrompt) {
    messages.push({ role: 'system', content: body.systemPrompt });
  }
  messages.push({ role: 'user', content: body.message });

  const toolCalls: any[] = [];
  let iterations = 0;
  let finalOutput = '';

  while (iterations < maxIterations) {
    iterations++;

    const response = await env.AI.run(model, {
      messages,
      tools: body.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      })),
    });

    // Check if model wants to call a tool
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        toolCalls.push(toolCall);
        
        // Add assistant message with tool call
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        });

        // Execute tool (in real implementation, client would handle this)
        // For now, we simulate tool result
        messages.push({
          role: 'tool' as any,
          content: JSON.stringify({ result: 'Tool executed successfully' }),
          tool_call_id: toolCall.id,
        });
      }
    } else {
      // No more tool calls, we have final output
      finalOutput = response.response;
      break;
    }
  }

  // Track usage
  await trackUsage(env.DB, keyInfo.userId, {
    model,
    inputTokens: estimateTokens(messages),
    outputTokens: estimateTokens([{ content: finalOutput }]),
    agentIterations: iterations,
  });

  return jsonResponse({
    output: finalOutput,
    toolCalls,
    iterations,
    model,
  });
}

// Agent streaming handler
async function handleAgentStream(request: Request, env: Env): Promise<Response> {
  const body: AgentRequest = await request.json();
  const keyInfo: ApiKeyInfo = (request as any).keyInfo;
  
  const model = body.model || '@hf/nousresearch/hermes-2-pro-mistral-7b';
  
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const emit = (type: string, content: string, tool?: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type, content, tool })}\n\n`)
        );
      };

      try {
        emit('thinking', 'Processing your request...');
        
        const messages: Message[] = [];
        if (body.systemPrompt) {
          messages.push({ role: 'system', content: body.systemPrompt });
        }
        messages.push({ role: 'user', content: body.message });

        const response = await env.AI.run(model, {
          messages,
          tools: body.tools?.map(t => ({
            type: 'function',
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          })),
        });

        if (response.tool_calls) {
          for (const toolCall of response.tool_calls) {
            emit('tool_call', JSON.stringify(toolCall.function.arguments), toolCall.function.name);
            emit('tool_result', 'Tool executed', toolCall.function.name);
          }
        }

        emit('response', response.response || 'Done');
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        emit('error', error instanceof Error ? error.message : 'Unknown error');
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
    },
  });
}

// Usage handler
async function handleUsage(request: Request, env: Env): Promise<Response> {
  const keyInfo: ApiKeyInfo = (request as any).keyInfo;
  
  const usage = await env.DB.prepare(`
    SELECT 
      SUM(requests) as requests_used,
      SUM(tokens_input + tokens_output) as tokens_used
    FROM usage 
    WHERE user_id = ? 
    AND date >= date('now', '-30 days')
  `).bind(keyInfo.userId).first<{ requests_used: number | null; tokens_used: number | null }>();

  const limits = RATE_LIMITS[keyInfo.plan];

  return jsonResponse({
    requestsUsed: usage?.requests_used ?? 0,
    requestsLimit: limits.requestsPerDay * 30,
    tokensUsed: usage?.tokens_used ?? 0,
    plan: keyInfo.plan,
    resetAt: getNextResetDate(),
  });
}

// OpenRouter fallback
async function handleChatWithOpenRouter(body: ChatRequest, env: Env): Promise<Response> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.2-1b-instruct:free',
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    }),
  });

  const data = await response.json() as any;
  
  return jsonResponse({
    content: data.choices?.[0]?.message?.content || '',
    model: 'openrouter/llama-3.2-1b',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  });
}

// Helper functions
async function validateApiKey(db: D1Database, key: string): Promise<ApiKeyInfo | null> {
  const keyHash = await hashKey(key);
  
  const result = await db.prepare(`
    SELECT ak.id as key_id, ak.user_id, u.plan 
    FROM api_keys ak 
    JOIN users u ON ak.user_id = u.id 
    WHERE ak.key_hash = ?
  `).bind(keyHash).first<{ key_id: string; user_id: string; plan: string }>();

  if (!result) return null;

  return {
    keyId: result.key_id,
    userId: result.user_id,
    plan: result.plan as 'free' | 'pro' | 'enterprise',
  };
}

async function checkRateLimit(kv: KVNamespace, keyInfo: ApiKeyInfo): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limits = RATE_LIMITS[keyInfo.plan];
  const minuteKey = `ratelimit:${keyInfo.keyId}:${Math.floor(Date.now() / 60000)}`;
  
  const currentValue = await kv.get(minuteKey);
  const current = parseInt(currentValue || '0');
  
  if (current >= limits.requestsPerMinute) {
    return { allowed: false, retryAfter: 60 };
  }
  
  await kv.put(minuteKey, String(current + 1), { expirationTtl: 120 });
  return { allowed: true };
}

async function trackUsage(
  db: D1Database,
  userId: string,
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    agentIterations?: number;
  }
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  
  await db.prepare(`
    INSERT INTO usage (id, user_id, date, model, tokens_input, tokens_output, requests)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (user_id, date, model) DO UPDATE SET
      tokens_input = tokens_input + ?,
      tokens_output = tokens_output + ?,
      requests = requests + 1
  `).bind(
    crypto.randomUUID(),
    userId,
    date,
    usage.model,
    usage.inputTokens,
    usage.outputTokens,
    usage.inputTokens,
    usage.outputTokens
  ).run();
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function estimateTokens(messages: { content?: string }[]): number {
  return messages.reduce((acc, m) => acc + (m.content?.length || 0) / 4, 0);
}

function getNextResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

function getAvailableModels() {
  return [
    { id: '@cf/meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', free: true },
    { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', free: true },
    { id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', name: 'Llama 3.1 8B Fast', free: true },
    { id: '@hf/nousresearch/hermes-2-pro-mistral-7b', name: 'Hermes 2 Pro (Tools)', free: true },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', free: false },
  ];
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function jsonError(message: string, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
