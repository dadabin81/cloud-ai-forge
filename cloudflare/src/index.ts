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
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// Rate limits aligned with pricing page (monthly)
const RATE_LIMITS = {
  free: { requestsPerMinute: 10, requestsPerMonth: 1000, tokensPerMonth: 50000 },
  pro: { requestsPerMinute: 100, requestsPerMonth: 50000, tokensPerMonth: 500000 },
  enterprise: { requestsPerMinute: 300, requestsPerMonth: -1, tokensPerMonth: -1 }, // unlimited
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

interface SessionInfo {
  userId: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
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
      // ============ Public Endpoints ============
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      if (path === '/v1/models') {
        return jsonResponse({ models: getAvailableModels() });
      }

      // ============ Auth Endpoints (Public) ============
      if (path === '/v1/auth/signup' && request.method === 'POST') {
        return await handleSignup(request, env);
      }

      if (path === '/v1/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }

      // ============ Session-Protected Endpoints ============
      if (path === '/v1/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      }

      if (path === '/v1/auth/me' && request.method === 'GET') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }
        return jsonResponse({
          id: sessionInfo.userId,
          email: sessionInfo.email,
          plan: sessionInfo.plan,
        });
      }

      // ============ API Keys Management (Session-Protected) ============
      if (path === '/v1/keys') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }

        if (request.method === 'GET') {
          return await handleListKeys(env, sessionInfo);
        }
        if (request.method === 'POST') {
          return await handleCreateKey(request, env, sessionInfo);
        }
      }

      // Delete API key
      const keyDeleteMatch = path.match(/^\/v1\/keys\/(.+)$/);
      if (keyDeleteMatch && request.method === 'DELETE') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }
        return await handleDeleteKey(env, sessionInfo, keyDeleteMatch[1]);
      }

      // ============ Account Usage (Session-Protected) ============
      if (path === '/v1/account/usage' && request.method === 'GET') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }
        return await handleAccountUsage(env, sessionInfo);
      }

      // ============ Get First API Key (Session-Protected) ============
      if (path === '/v1/account/api-key' && request.method === 'GET') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }
        return await handleGetFirstApiKey(env, sessionInfo);
      }

      // ============ API Key Protected Endpoints ============
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
        
        case '/v1/embeddings':
          return await handleEmbeddings(request, env, keyInfo);
        
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

// ============ Auth Handlers ============

async function handleSignup(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email: string; password: string };
  
  // Validate input
  if (!body.email || !body.password) {
    return jsonError('Email and password are required', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return jsonError('Invalid email format', 400);
  }

  if (body.password.length < 8) {
    return jsonError('Password must be at least 8 characters', 400);
  }

  // Check if user already exists
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first();

  if (existingUser) {
    return jsonError('Email already registered', 409);
  }

  // Create user
  const userId = crypto.randomUUID();
  const passwordHash = await hashKey(body.password);

  await env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, plan)
    VALUES (?, ?, ?, 'free')
  `).bind(userId, body.email.toLowerCase(), passwordHash).run();

  // Create session
  const sessionToken = crypto.randomUUID();
  const sessionHash = await hashKey(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, sessionHash, expiresAt.toISOString()).run();

  // Create initial API key
  const apiKeyValue = `bsk_live_${generateRandomString(32)}`;
  const apiKeyHash = await hashKey(apiKeyValue);
  const keyPrefix = apiKeyValue.substring(0, 12) + '...';

  await env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, is_active)
    VALUES (?, ?, 'Default', ?, ?, 1)
  `).bind(crypto.randomUUID(), userId, keyPrefix, apiKeyHash).run();

  return jsonResponse({
    user: {
      id: userId,
      email: body.email.toLowerCase(),
      plan: 'free',
    },
    token: sessionToken,
    apiKey: apiKeyValue,
  }, 201);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email: string; password: string };

  if (!body.email || !body.password) {
    return jsonError('Email and password are required', 400);
  }

  // Find user
  const user = await env.DB.prepare(`
    SELECT id, email, password_hash, plan FROM users WHERE email = ?
  `).bind(body.email.toLowerCase()).first();

  if (!user) {
    return jsonError('Invalid email or password', 401);
  }

  // Verify password
  const passwordHash = await hashKey(body.password);
  if (passwordHash !== user.password_hash) {
    return jsonError('Invalid email or password', 401);
  }

  // Create session
  const sessionToken = crypto.randomUUID();
  const sessionHash = await hashKey(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), user.id, sessionHash, expiresAt.toISOString()).run();

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
    },
    token: sessionToken,
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return jsonError('No session token provided', 400);
  }

  const tokenHash = await hashKey(token);
  
  await env.DB.prepare(`
    DELETE FROM sessions WHERE token_hash = ?
  `).bind(tokenHash).run();

  return jsonResponse({ success: true });
}

async function validateSession(request: Request, env: Env): Promise<SessionInfo | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) return null;

  const tokenHash = await hashKey(token);

  const result = await env.DB.prepare(`
    SELECT s.user_id, u.email, u.plan
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).bind(tokenHash).first();

  if (!result) return null;

  return {
    userId: result.user_id as string,
    email: result.email as string,
    plan: result.plan as 'free' | 'pro' | 'enterprise',
  };
}

// ============ API Keys Handlers ============

async function handleListKeys(env: Env, sessionInfo: SessionInfo): Promise<Response> {
  const keys = await env.DB.prepare(`
    SELECT id, name, key_prefix, created_at, last_used_at, is_active
    FROM api_keys
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
  `).bind(sessionInfo.userId).all();

  return jsonResponse({
    keys: keys.results.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.key_prefix,
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
    })),
  });
}

async function handleCreateKey(request: Request, env: Env, sessionInfo: SessionInfo): Promise<Response> {
  const body = await request.json() as { name?: string };
  const keyName = body.name || 'API Key';

  const apiKeyValue = `bsk_live_${generateRandomString(32)}`;
  const apiKeyHash = await hashKey(apiKeyValue);
  const keyPrefix = apiKeyValue.substring(0, 12) + '...';
  const keyId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).bind(keyId, sessionInfo.userId, keyName, keyPrefix, apiKeyHash).run();

  return jsonResponse({
    id: keyId,
    name: keyName,
    key: apiKeyValue,
    prefix: keyPrefix,
    createdAt: new Date().toISOString(),
  }, 201);
}

async function handleDeleteKey(env: Env, sessionInfo: SessionInfo, keyId: string): Promise<Response> {
  // Verify key belongs to user
  const key = await env.DB.prepare(`
    SELECT id FROM api_keys WHERE id = ? AND user_id = ?
  `).bind(keyId, sessionInfo.userId).first();

  if (!key) {
    return jsonError('API key not found', 404);
  }

  await env.DB.prepare(`
    UPDATE api_keys SET is_active = 0 WHERE id = ?
  `).bind(keyId).run();

  return jsonResponse({ success: true });
}

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

// ============ Embeddings Handler ============

interface EmbeddingsRequest {
  input: string | string[];
  model?: string;
}

async function handleEmbeddings(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as EmbeddingsRequest;
  
  if (!body.input) {
    return jsonError('Input is required', 400);
  }

  const inputs = Array.isArray(body.input) ? body.input : [body.input];
  const model = body.model || '@cf/baai/bge-base-en-v1.5';

  try {
    const response = await env.AI.run(model as any, {
      text: inputs,
    });

    const embeddings = (response as any).data || [];
    
    return jsonResponse({
      object: 'list',
      data: embeddings.map((embedding: number[], index: number) => ({
        object: 'embedding',
        embedding,
        index,
      })),
      model,
      usage: {
        prompt_tokens: inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        total_tokens: inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
      },
    });
  } catch (error) {
    console.error('Embeddings error:', error);
    return jsonError('Failed to generate embeddings', 500);
  }
}

async function handleUsage(env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's usage
  const todayUsage = await env.DB.prepare(`
    SELECT 
      SUM(tokens_used) as total_tokens,
      COUNT(*) as total_requests
    FROM usage 
    WHERE user_id = ? AND date = ?
  `).bind(keyInfo.userId, today).first();

  // Get daily usage for last 7 days
  const dailyUsage = await env.DB.prepare(`
    SELECT date, SUM(tokens_used) as tokens, COUNT(*) as requests
    FROM usage
    WHERE user_id = ? AND date >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date DESC
  `).bind(keyInfo.userId).all();

  const limits = RATE_LIMITS[keyInfo.plan];

  return jsonResponse({
    plan: keyInfo.plan,
    usage: {
      tokensUsed: todayUsage?.total_tokens || 0,
      requestsUsed: todayUsage?.total_requests || 0,
    },
    limits: {
      tokensPerDay: limits.tokensPerDay,
      requestsPerDay: limits.requestsPerDay,
    },
    dailyUsage: dailyUsage.results,
    resetAt: getNextResetDate(),
  });
}

// ============ Account Usage Handler (Session-Protected) ============

async function handleAccountUsage(env: Env, sessionInfo: SessionInfo): Promise<Response> {
  // Get current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  
  // Get this month's usage
  const monthUsage = await env.DB.prepare(`
    SELECT 
      COALESCE(SUM(tokens_used), 0) as total_tokens,
      COUNT(*) as total_requests
    FROM usage 
    WHERE user_id = ? AND date >= ?
  `).bind(sessionInfo.userId, monthStart).first();

  // Get daily usage for last 7 days
  const dailyUsage = await env.DB.prepare(`
    SELECT date, COALESCE(SUM(tokens_used), 0) as tokens, COUNT(*) as requests
    FROM usage
    WHERE user_id = ? AND date >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `).bind(sessionInfo.userId).all();

  // Get total usage (all time)
  const totalUsage = await env.DB.prepare(`
    SELECT 
      COALESCE(SUM(tokens_used), 0) as total_tokens,
      COUNT(*) as total_requests
    FROM usage 
    WHERE user_id = ?
  `).bind(sessionInfo.userId).first();

  const limits = RATE_LIMITS[sessionInfo.plan];

  return jsonResponse({
    plan: sessionInfo.plan,
    usage: {
      tokensUsed: Number(monthUsage?.total_tokens) || 0,
      requestsUsed: Number(monthUsage?.total_requests) || 0,
    },
    totalUsage: {
      tokensUsed: Number(totalUsage?.total_tokens) || 0,
      requestsUsed: Number(totalUsage?.total_requests) || 0,
    },
    limits: {
      tokensPerMonth: limits.tokensPerMonth,
      requestsPerMonth: limits.requestsPerMonth,
      requestsPerMinute: limits.requestsPerMinute,
    },
    dailyUsage: dailyUsage.results.map(d => ({
      date: d.date,
      tokens: Number(d.tokens) || 0,
      requests: Number(d.requests) || 0,
    })),
    resetAt: getNextMonthResetDate(),
  });
}

// ============ Get First API Key Handler ============

async function handleGetFirstApiKey(env: Env, sessionInfo: SessionInfo): Promise<Response> {
  const key = await env.DB.prepare(`
    SELECT id, name, key_prefix
    FROM api_keys
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at ASC
    LIMIT 1
  `).bind(sessionInfo.userId).first();

  if (!key) {
    return jsonError('No API key found', 404);
  }

  return jsonResponse({
    id: key.id,
    name: key.name,
    prefix: key.key_prefix,
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
  const monthKey = `rate:${keyInfo.keyId}:month:${new Date().toISOString().slice(0, 7)}`; // YYYY-MM

  const [minuteCount, monthCount] = await Promise.all([
    env.KV.get(minuteKey),
    env.KV.get(monthKey),
  ]);

  const currentMinute = parseInt(minuteCount || '0');
  const currentMonth = parseInt(monthCount || '0');

  // Check minute limit
  if (currentMinute >= limits.requestsPerMinute) {
    return { allowed: false, resetAt: Date.now() + 60000 };
  }

  // Check monthly limit (skip if unlimited = -1)
  if (limits.requestsPerMonth !== -1 && currentMonth >= limits.requestsPerMonth) {
    return { allowed: false, resetAt: getNextMonthResetTimestamp() };
  }

  // Calculate TTL for month key (until end of month)
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthTtl = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);

  await Promise.all([
    env.KV.put(minuteKey, String(currentMinute + 1), { expirationTtl: 60 }),
    env.KV.put(monthKey, String(currentMonth + 1), { expirationTtl: monthTtl }),
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

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
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

function getNextMonthResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

function getNextMonthResetTimestamp(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
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
