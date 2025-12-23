/**
 * Binario API - Cloudflare Worker
 * Production-ready API gateway for AI chat and agents
 */

export interface Env {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
  ENVIRONMENT: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

const RATE_LIMITS = {
  free: { requestsPerMinute: 10, requestsPerDay: 100, tokensPerDay: 50000 },
  pro: { requestsPerMinute: 60, requestsPerDay: 1000, tokensPerDay: 500000 },
  enterprise: { requestsPerMinute: 300, requestsPerDay: 10000, tokensPerDay: 5000000 },
};

const MODEL_ROUTING = {
  free: '@cf/meta/llama-3.1-8b-instruct',
  pro: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  enterprise: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface ApiKeyInfo {
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  keyId: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public endpoints
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      if (path === '/v1/models') {
        return jsonResponse({ models: getAvailableModels() });
      }

      // Protected endpoints - require API key
      const apiKey = request.headers.get('X-API-Key') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');

      if (!apiKey) {
        return jsonError('API key required', 401);
      }

      const keyInfo = await validateApiKey(env, apiKey);
      if (!keyInfo) {
        return jsonError('Invalid API key', 401);
      }

      // Check rate limits
      const rateLimitResult = await checkRateLimit(env, keyInfo);
      if (!rateLimitResult.allowed) {
        return jsonError('Rate limit exceeded', 429, {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
        });
      }

      // Route to handlers
      switch (path) {
        case '/v1/chat/completions':
          return await handleChat(request, env, keyInfo);
        
        case '/v1/chat/stream':
          return await handleChatStream(request, env, keyInfo);
        
        case '/v1/agents/run':
          return await handleAgentRun(request, env, keyInfo);
        
        case '/v1/usage':
          return await handleUsage(env, keyInfo);
        
        default:
          return jsonError('Not found', 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return jsonError('Internal server error', 500);
    }
  },
};

// ============ Chat Handlers ============

async function handleChat(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as ChatRequest;
  const model = body.model || MODEL_ROUTING[keyInfo.plan];

  try {
    const response = await env.AI.run(model as any, {
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    });

    await trackUsage(env, keyInfo, model, body.messages, response);

    return jsonResponse({
      id: `chat-${Date.now()}`,
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: (response as any).response || '',
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: estimateTokens(body.messages),
        completion_tokens: estimateTokens((response as any).response || ''),
      },
    });
  } catch (error) {
    // Fallback to OpenRouter if available
    if (env.OPENROUTER_API_KEY) {
      return await handleChatWithOpenRouter(env, body);
    }
    throw error;
  }
}

async function handleChatStream(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as ChatRequest;
  const model = body.model || MODEL_ROUTING[keyInfo.plan];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await env.AI.run(model as any, {
          messages: body.messages,
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens ?? 1024,
          stream: true,
        });

        const reader = (response as ReadableStream).getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
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
      'Connection': 'keep-alive',
    },
  });
}

// ============ Agent Handler ============

async function handleAgentRun(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as {
    prompt: string;
    tools?: any[];
    maxIterations?: number;
  };

  const model = MODEL_ROUTING[keyInfo.plan];
  const messages: ChatMessage[] = [
    { role: 'user', content: body.prompt }
  ];

  let iterations = 0;
  const maxIterations = body.maxIterations || 5;
  const toolResults: any[] = [];

  while (iterations < maxIterations) {
    const response = await env.AI.run(model as any, {
      messages,
      tools: body.tools,
    }) as any;

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return jsonResponse({
        id: `agent-${Date.now()}`,
        result: response.response,
        toolResults,
        iterations,
      });
    }

    // Process tool calls
    for (const toolCall of response.tool_calls) {
      toolResults.push({
        tool: toolCall.name,
        args: toolCall.arguments,
        iteration: iterations,
      });
    }

    iterations++;
  }

  return jsonResponse({
    id: `agent-${Date.now()}`,
    result: 'Max iterations reached',
    toolResults,
    iterations,
  });
}

// ============ Usage Handler ============

async function handleUsage(env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];
  
  const usage = await env.DB.prepare(`
    SELECT 
      SUM(tokens_used) as total_tokens,
      COUNT(*) as total_requests
    FROM usage 
    WHERE user_id = ? AND date = ?
  `).bind(keyInfo.userId, today).first();

  const limits = RATE_LIMITS[keyInfo.plan];

  return jsonResponse({
    plan: keyInfo.plan,
    usage: {
      tokensUsed: usage?.total_tokens || 0,
      requestsUsed: usage?.total_requests || 0,
    },
    limits: {
      tokensPerDay: limits.tokensPerDay,
      requestsPerDay: limits.requestsPerDay,
    },
    resetAt: getNextResetDate(),
  });
}

// ============ OpenRouter Fallback ============

async function handleChatWithOpenRouter(env: Env, body: ChatRequest): Promise<Response> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    }),
  });

  const data = await response.json();
  return jsonResponse(data);
}

// ============ Helpers ============

async function validateApiKey(env: Env, key: string): Promise<ApiKeyInfo | null> {
  const keyHash = await hashKey(key);
  
  const result = await env.DB.prepare(`
    SELECT ak.id as key_id, ak.user_id, u.plan
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_hash = ? AND ak.is_active = 1
  `).bind(keyHash).first();

  if (!result) return null;

  // Update last used
  await env.DB.prepare(`
    UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?
  `).bind(result.key_id).run();

  return {
    userId: result.user_id as string,
    plan: result.plan as 'free' | 'pro' | 'enterprise',
    keyId: result.key_id as string,
  };
}

async function checkRateLimit(env: Env, keyInfo: ApiKeyInfo): Promise<{ allowed: boolean; resetAt: number }> {
  const limits = RATE_LIMITS[keyInfo.plan];
  const minuteKey = `rate:${keyInfo.keyId}:minute:${Math.floor(Date.now() / 60000)}`;
  const dayKey = `rate:${keyInfo.keyId}:day:${new Date().toISOString().split('T')[0]}`;

  const [minuteCount, dayCount] = await Promise.all([
    env.KV.get(minuteKey),
    env.KV.get(dayKey),
  ]);

  const currentMinute = parseInt(minuteCount || '0');
  const currentDay = parseInt(dayCount || '0');

  if (currentMinute >= limits.requestsPerMinute || currentDay >= limits.requestsPerDay) {
    return { allowed: false, resetAt: Date.now() + 60000 };
  }

  await Promise.all([
    env.KV.put(minuteKey, String(currentMinute + 1), { expirationTtl: 60 }),
    env.KV.put(dayKey, String(currentDay + 1), { expirationTtl: 86400 }),
  ]);

  return { allowed: true, resetAt: Date.now() + 60000 };
}

async function trackUsage(env: Env, keyInfo: ApiKeyInfo, model: string, messages: ChatMessage[], response: any): Promise<void> {
  const tokens = estimateTokens(messages) + estimateTokens(response.response || '');
  const today = new Date().toISOString().split('T')[0];

  await env.DB.prepare(`
    INSERT INTO usage (user_id, model, tokens_used, date)
    VALUES (?, ?, ?, ?)
  `).bind(keyInfo.userId, model, tokens, today).run();
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function estimateTokens(content: string | ChatMessage[]): number {
  if (typeof content === 'string') {
    return Math.ceil(content.length / 4);
  }
  return content.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0);
}

function getNextResetDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function getAvailableModels() {
  return [
    { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tier: 'free' },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro' },
    { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B', tier: 'free' },
    { id: '@cf/qwen/qwen1.5-14b-chat-awq', name: 'Qwen 1.5 14B', tier: 'pro' },
  ];
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}
