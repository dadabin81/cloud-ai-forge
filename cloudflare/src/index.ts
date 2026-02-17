/**
 * Binario API - Cloudflare Worker
 * Production-ready API gateway for AI chat and agents
 */

// Export Durable Objects
export { BinarioAgent } from './agent';
export { SandboxProject } from './sandbox';
import {
  createProject,
  listUserProjects,
  getProjectById,
  deleteProject,
  getAvailableTemplates,
} from './sandbox';
// export { ResearchWorkflow, RAGWorkflow } from './workflows'; // Workflows later

// Import RAG functions
import {
  type RagEnv,
  ingestDocument,
  searchDocuments,
  ragQuery,
  generateEmbedding,
  deleteDocuments,
  getEmbeddingInfo,
} from './rag';

export interface Env {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  // Optional advanced bindings (disabled for now)
  BINARIO_AGENT?: DurableObjectNamespace;
  SANDBOX_PROJECT?: DurableObjectNamespace;
  VECTORIZE_INDEX?: VectorizeIndex;
  RESEARCH_WORKFLOW?: Workflow;
  RAG_WORKFLOW?: Workflow;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
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

interface JsonSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: string[];
  description?: string;
  [key: string]: any;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'text' | 'json_object'; schema?: JsonSchema };
  cache?: boolean | { ttl?: number }; // Enable response caching
}

// Provider-specific model mappings
const PROVIDER_MODELS: Record<string, string[]> = {
  cloudflare: [
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.2-11b-vision-instruct',
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

interface StructuredRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  schema: JsonSchema;
  retries?: number;
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
      // ============ Durable Objects Endpoints ============
      
      // Agent endpoints (WebSocket + REST)
      if (path.startsWith('/v1/agent/')) {
        if (!env.BINARIO_AGENT) {
          return jsonResponse({ error: 'Agent not configured' }, 503);
        }
        const agentPath = path.replace('/v1/agent/', '');
        const agentId = url.searchParams.get('id') || 'default';
        const id = env.BINARIO_AGENT.idFromName(agentId);
        const stub = env.BINARIO_AGENT.get(id);
        const agentUrl = new URL(request.url);
        agentUrl.pathname = '/' + agentPath;
        return stub.fetch(new Request(agentUrl.toString(), request));
      }

      // Sandbox/Projects endpoints
      if (path.startsWith('/v1/sandbox/') || path.startsWith('/v1/projects/')) {
        if (!env.SANDBOX_PROJECT) {
          return jsonResponse({ error: 'Sandbox not configured' }, 503);
        }
        const projectPath = path.replace('/v1/sandbox/', '').replace('/v1/projects/', '');
        const projectId = url.searchParams.get('id') || projectPath.split('/')[0] || 'default';
        const id = env.SANDBOX_PROJECT!.idFromName(projectId);
        const stub = env.SANDBOX_PROJECT!.get(id);
        const projectUrl = new URL(request.url);
        projectUrl.pathname = '/' + projectPath;
        return stub.fetch(new Request(projectUrl.toString(), request));
      }

      // RAG endpoints (still disabled - requires Vectorize)
      if (path.startsWith('/v1/rag/')) {
        return jsonResponse({ 
          error: 'RAG endpoints temporarily disabled',
          message: 'Vectorize index not configured.',
        }, 503);
      }

      // Workflows (still disabled)
      if (path.startsWith('/v1/workflows/')) {
        return jsonResponse({ 
          error: 'Workflow endpoints temporarily disabled',
          message: 'Workflows not configured.',
        }, 503);
      }

      // ============ Public Endpoints ============
      if (path === '/health') {
        return jsonResponse({ 
          status: 'ok', 
          timestamp: new Date().toISOString(), 
          agents: !!env.BINARIO_AGENT,
          sandbox: !!env.SANDBOX_PROJECT,
          rag: false,
          workflows: false,
          chat: true,
        });
      }

      if (path === '/v1/models') {
        return jsonResponse({ models: getAvailableModels(env) });
      }

      // Providers status endpoint (public)
      if (path === '/v1/providers/status') {
        return jsonResponse({
          providers: {
            cloudflare: { available: true, configured: true, name: 'Cloudflare Workers AI' },
            openai: { available: true, configured: !!env.OPENAI_API_KEY, name: 'OpenAI' },
            anthropic: { available: true, configured: !!env.ANTHROPIC_API_KEY, name: 'Anthropic' },
            google: { available: true, configured: !!env.GOOGLE_API_KEY, name: 'Google' },
            openrouter: { available: true, configured: !!env.OPENROUTER_API_KEY, name: 'OpenRouter' },
          },
          defaultProvider: 'cloudflare',
          websocket: { enabled: !!env.BINARIO_AGENT, durableObjects: !!env.BINARIO_AGENT },
        });
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

      // Regenerate API key - creates new key and deactivates old ones
      if (path === '/v1/keys/regenerate' && request.method === 'POST') {
        const sessionInfo = await validateSession(request, env);
        if (!sessionInfo) {
          return jsonError('Unauthorized', 401);
        }
        return await handleRegenerateKey(env, sessionInfo);
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
        
        case '/v1/structured':
          return await handleStructured(request, env, keyInfo);
        
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

// Regenerate API key - deactivates all existing keys and creates a new one
async function handleRegenerateKey(env: Env, sessionInfo: SessionInfo): Promise<Response> {
  // Deactivate all existing keys for the user
  await env.DB.prepare(`
    UPDATE api_keys SET is_active = 0 WHERE user_id = ?
  `).bind(sessionInfo.userId).run();

  // Create a new API key
  const apiKeyValue = `bsk_live_${generateRandomString(32)}`;
  const apiKeyHash = await hashKey(apiKeyValue);
  const keyPrefix = apiKeyValue.substring(0, 12) + '...';
  const keyId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, is_active)
    VALUES (?, ?, 'Default', ?, ?, 1)
  `).bind(keyId, sessionInfo.userId, keyPrefix, apiKeyHash).run();

  return jsonResponse({
    id: keyId,
    name: 'Default',
    key: apiKeyValue,
    prefix: keyPrefix,
    createdAt: new Date().toISOString(),
  }, 201);
}

// ============ Chat Handlers ============

async function handleChat(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as ChatRequest;
  const model = body.model || MODEL_ROUTING[keyInfo.plan];
  const provider = body.provider || detectProvider(model);

  // Check cache if enabled
  const cacheEnabled = body.cache !== undefined && body.cache !== false;
  const cacheTTL = typeof body.cache === 'object' && body.cache.ttl ? body.cache.ttl : 3600; // Default 1 hour
  
  if (cacheEnabled) {
    const cacheKey = await generateCacheKey(body.messages, model, body.temperature, body.max_tokens);
    const cachedResponse = await env.KV.get(cacheKey, 'json');
    
    if (cachedResponse) {
      console.log('Cache hit for:', cacheKey.substring(0, 20));
      return jsonResponse({
        ...cachedResponse as object,
        cached: true,
      });
    }
  }

  // Validate provider/model compatibility
  if (provider !== 'cloudflare' && !isProviderConfigured(env, provider)) {
    // Try to use OpenRouter as a fallback for external models
    if (env.OPENROUTER_API_KEY) {
      return await handleChatWithOpenRouter(env, body, model);
    }
    return jsonError(`Provider '${provider}' is not configured. Add the required API key or use Cloudflare models.`, 400);
  }

  try {
    // Route to the appropriate provider
    if (provider !== 'cloudflare') {
      return await handleExternalProviderChat(env, body, provider, model, keyInfo);
    }

    // Cloudflare Workers AI path
    let messages = body.messages;
    if (body.response_format?.type === 'json_object') {
      const schemaInstructions = body.response_format.schema 
        ? `\n\nYou must respond with valid JSON that conforms to this schema:\n${JSON.stringify(body.response_format.schema, null, 2)}`
        : '\n\nYou must respond with valid JSON.';
      
      messages = messages.map((msg, i) => 
        i === 0 && msg.role === 'system' 
          ? { ...msg, content: msg.content + schemaInstructions }
          : msg
      );
      
      if (messages[0]?.role !== 'system') {
        messages = [{ role: 'system', content: `You are a helpful assistant.${schemaInstructions}` }, ...messages];
      }
    }

    const response = await env.AI.run(model as any, {
      messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    });

    let content = (response as any).response || '';
    
    if (body.response_format?.type === 'json_object') {
      const extracted = extractJsonFromResponse(content);
      if (!extracted.success) {
        return jsonError(`Failed to parse JSON response: ${extracted.error}`, 422);
      }
      
      if (body.response_format.schema) {
        const validation = validateJsonSchema(extracted.data, body.response_format.schema);
        if (!validation.valid) {
          return jsonError(`JSON validation failed: ${validation.errors.join(', ')}`, 422);
        }
      }
      
      content = JSON.stringify(extracted.data);
    }

    await trackUsage(env, keyInfo, model, body.messages, response);

    const responseData = {
      id: `chat-${Date.now()}`,
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: estimateTokens(body.messages),
        completion_tokens: estimateTokens(content),
      },
    };

    // Cache the response if caching is enabled
    if (cacheEnabled) {
      const cacheKey = await generateCacheKey(body.messages, model, body.temperature, body.max_tokens);
      await env.KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: cacheTTL });
      console.log('Cached response for:', cacheKey.substring(0, 20));
    }

    return jsonResponse(responseData);
  } catch (error) {
    console.error('Chat error:', error);
    // Fallback to OpenRouter if available
    if (env.OPENROUTER_API_KEY) {
      return await handleChatWithOpenRouter(env, body, model);
    }
    throw error;
  }
}

// Handle external provider chat (OpenAI, Anthropic, Google)
async function handleExternalProviderChat(
  env: Env, 
  body: ChatRequest, 
  provider: string, 
  model: string,
  keyInfo: ApiKeyInfo
): Promise<Response> {
  let apiUrl: string;
  let apiKey: string;
  let requestBody: any;

  switch (provider) {
    case 'openai':
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiKey = env.OPENAI_API_KEY!;
      requestBody = {
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
        stream: false,
      };
      break;

    case 'anthropic':
      apiUrl = 'https://api.anthropic.com/v1/messages';
      apiKey = env.ANTHROPIC_API_KEY!;
      // Convert messages format for Anthropic
      const systemMessage = body.messages.find(m => m.role === 'system');
      const nonSystemMessages = body.messages.filter(m => m.role !== 'system');
      requestBody = {
        model,
        system: systemMessage?.content,
        messages: nonSystemMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        max_tokens: body.max_tokens ?? 1024,
      };
      break;

    case 'google':
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;
      apiKey = ''; // Key is in URL for Google
      // Convert messages format for Google
      const contents = body.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      const googleSystemMessage = body.messages.find(m => m.role === 'system');
      requestBody = {
        contents,
        systemInstruction: googleSystemMessage ? { parts: [{ text: googleSystemMessage.content }] } : undefined,
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.max_tokens ?? 1024,
        },
      };
      break;

    default:
      return jsonError(`Unsupported provider: ${provider}`, 400);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }
  // Google uses key in URL

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider} API error:`, errorText);
      return jsonError(`${provider} API error: ${response.status}`, response.status);
    }

    const data = await response.json() as any;
    let content: string;

    // Parse response based on provider format
    switch (provider) {
      case 'openai':
        content = data.choices?.[0]?.message?.content || '';
        break;
      case 'anthropic':
        content = data.content?.[0]?.text || '';
        break;
      case 'google':
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        break;
      default:
        content = '';
    }

    await trackUsage(env, keyInfo, model, body.messages, { response: content });

    return jsonResponse({
      id: `chat-${Date.now()}`,
      model,
      provider,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: estimateTokens(body.messages),
        completion_tokens: estimateTokens(content),
      },
    });
  } catch (error) {
    console.error(`${provider} chat error:`, error);
    return jsonError(`Failed to call ${provider} API`, 500);
  }
}

// Detect provider from model name
function detectProvider(model: string): string {
  if (model.startsWith('@cf/')) return 'cloudflare';
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  return 'cloudflare'; // default
}

// Check if provider is configured
function isProviderConfigured(env: Env, provider: string): boolean {
  switch (provider) {
    case 'cloudflare': return true;
    case 'openai': return !!env.OPENAI_API_KEY;
    case 'anthropic': return !!env.ANTHROPIC_API_KEY;
    case 'google': return !!env.GOOGLE_API_KEY;
    default: return false;
  }
}

// ============ Structured Output Handler ============

async function handleStructured(request: Request, env: Env, keyInfo: ApiKeyInfo): Promise<Response> {
  const body = await request.json() as StructuredRequest;
  
  if (!body.schema) {
    return jsonError('Schema is required for structured output', 400);
  }
  
  const model = body.model || MODEL_ROUTING[keyInfo.plan];
  const maxRetries = body.retries ?? 2;
  
  const schemaInstructions = `You must respond with valid JSON that strictly conforms to this schema:
${JSON.stringify(body.schema, null, 2)}

IMPORTANT:
- Output ONLY valid JSON, no markdown code blocks
- Follow all type constraints exactly
- Include all required fields
- Do not add fields not in the schema`;

  let messages = body.messages.map((msg, i) => 
    i === 0 && msg.role === 'system' 
      ? { ...msg, content: msg.content + '\n\n' + schemaInstructions }
      : msg
  );
  
  if (messages[0]?.role !== 'system') {
    messages = [{ role: 'system', content: schemaInstructions }, ...messages];
  }

  let lastError = '';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await env.AI.run(model as any, {
        messages: attempt === 0 ? messages : [
          ...messages,
          { role: 'assistant', content: lastError },
          { role: 'user', content: `Your previous response was invalid: ${lastError}. Please try again with valid JSON.` }
        ],
        temperature: body.temperature ?? 0.3, // Lower temperature for structured output
        max_tokens: body.max_tokens ?? 2048,
      });

      const content = (response as any).response || '';
      const extracted = extractJsonFromResponse(content);
      
      if (!extracted.success) {
        lastError = `Failed to parse JSON: ${extracted.error}`;
        console.log(`Structured output attempt ${attempt + 1} failed:`, lastError);
        continue;
      }
      
      const validation = validateJsonSchema(extracted.data, body.schema);
      if (!validation.valid) {
        lastError = `Schema validation failed: ${validation.errors.join(', ')}`;
        console.log(`Structured output attempt ${attempt + 1} failed:`, lastError);
        continue;
      }
      
      await trackUsage(env, keyInfo, model, messages, response);
      
      return jsonResponse({
        id: `structured-${Date.now()}`,
        model,
        data: extracted.data,
        raw: content,
        attempts: attempt + 1,
        usage: {
          prompt_tokens: estimateTokens(messages),
          completion_tokens: estimateTokens(content),
        },
      });
    } catch (error) {
      lastError = (error as Error).message;
      console.error(`Structured output attempt ${attempt + 1} error:`, error);
    }
  }
  
  return jsonError(`Failed to generate valid structured output after ${maxRetries + 1} attempts: ${lastError}`, 422);
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
    outputSchema?: JsonSchema;
  };

  const model = MODEL_ROUTING[keyInfo.plan];
  
  // Build system prompt with schema if provided
  let systemPrompt = 'You are a helpful AI assistant that can use tools to help answer questions.';
  if (body.outputSchema) {
    systemPrompt += `\n\nWhen you provide your final answer (not tool calls), you must respond with valid JSON that conforms to this schema:
${JSON.stringify(body.outputSchema, null, 2)}

Output ONLY valid JSON for your final response, no markdown code blocks.`;
  }
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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
      let result = response.response;
      let structuredData = null;
      
      // Parse and validate output schema if provided
      if (body.outputSchema) {
        const extracted = extractJsonFromResponse(result);
        if (extracted.success) {
          const validation = validateJsonSchema(extracted.data, body.outputSchema);
          if (validation.valid) {
            structuredData = extracted.data;
            result = JSON.stringify(extracted.data);
          } else {
            console.warn('Agent output schema validation failed:', validation.errors);
          }
        }
      }
      
      return jsonResponse({
        id: `agent-${Date.now()}`,
        result,
        data: structuredData,
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
      tokensPerMonth: limits.tokensPerMonth,
      requestsPerMonth: limits.requestsPerMonth,
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

async function handleChatWithOpenRouter(env: Env, body: ChatRequest, model?: string): Promise<Response> {
  // Map model to OpenRouter format if needed
  const openRouterModel = model?.startsWith('@cf/') 
    ? 'meta-llama/llama-3.1-8b-instruct:free' 
    : model || 'meta-llama/llama-3.1-8b-instruct:free';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: openRouterModel,
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

// Generate a cache key for chat requests
async function generateCacheKey(
  messages: ChatMessage[], 
  model: string, 
  temperature?: number, 
  maxTokens?: number
): Promise<string> {
  const payload = JSON.stringify({ messages, model, temperature, maxTokens });
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `cache:chat:${hash}`;
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

function getAvailableModels(env?: Env) {
  const models: Array<{ id: string; name: string; tier: string; provider: string }> = [
    { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tier: 'free', provider: 'cloudflare' },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', provider: 'cloudflare' },
    { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B', tier: 'free', provider: 'cloudflare' },
    { id: '@cf/qwen/qwen1.5-14b-chat-awq', name: 'Qwen 1.5 14B', tier: 'pro', provider: 'cloudflare' },
    { id: '@cf/meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', tier: 'pro', provider: 'cloudflare' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', tier: 'pro', provider: 'cloudflare' },
  ];

  // Add external provider models only if configured
  if (env?.OPENAI_API_KEY) {
    models.push(
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'pro', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'free', provider: 'openai' },
    );
  }

  if (env?.ANTHROPIC_API_KEY) {
    models.push(
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tier: 'pro', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tier: 'enterprise', provider: 'anthropic' },
    );
  }

  if (env?.GOOGLE_API_KEY) {
    models.push(
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'free', provider: 'google' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tier: 'pro', provider: 'google' },
    );
  }

  return models;
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

// ============ JSON Schema Validation Utilities ============

function extractJsonFromResponse(content: string): { success: true; data: any } | { success: false; error: string } {
  try {
    // Try to extract JSON from markdown code blocks
    let jsonStr = content.trim();
    
    // Match ```json ... ``` or ``` ... ```
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    // Try to find JSON object or array
    const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function validateJsonSchema(data: any, schema: JsonSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  function validate(value: any, schemaNode: JsonSchema, path: string): void {
    if (schemaNode.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (schemaNode.type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          errors.push(`${path}: expected integer, got ${actualType}`);
        }
      } else if (schemaNode.type === 'number') {
        if (typeof value !== 'number') {
          errors.push(`${path}: expected number, got ${actualType}`);
        }
      } else if (schemaNode.type !== actualType) {
        errors.push(`${path}: expected ${schemaNode.type}, got ${actualType}`);
      }
    }
    
    // Validate enum
    if (schemaNode.enum && !schemaNode.enum.includes(value)) {
      errors.push(`${path}: value must be one of [${schemaNode.enum.join(', ')}]`);
    }
    
    // Validate object properties
    if (schemaNode.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check required fields
      if (schemaNode.required) {
        for (const field of schemaNode.required) {
          if (!(field in value)) {
            errors.push(`${path}.${field}: required field is missing`);
          }
        }
      }
      
      // Validate properties
      if (schemaNode.properties) {
        for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
          if (key in value) {
            validate(value[key], propSchema as JsonSchema, `${path}.${key}`);
          }
        }
      }
    }
    
    // Validate array items
    if (schemaNode.type === 'array' && Array.isArray(value)) {
      if (schemaNode.items) {
        value.forEach((item, index) => {
          validate(item, schemaNode.items as JsonSchema, `${path}[${index}]`);
        });
      }
      
      // Min/max items
      if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) {
        errors.push(`${path}: array must have at least ${schemaNode.minItems} items`);
      }
      if (schemaNode.maxItems !== undefined && value.length > schemaNode.maxItems) {
        errors.push(`${path}: array must have at most ${schemaNode.maxItems} items`);
      }
    }
    
    // Validate string constraints
    if (schemaNode.type === 'string' && typeof value === 'string') {
      if (schemaNode.minLength !== undefined && value.length < schemaNode.minLength) {
        errors.push(`${path}: string must be at least ${schemaNode.minLength} characters`);
      }
      if (schemaNode.maxLength !== undefined && value.length > schemaNode.maxLength) {
        errors.push(`${path}: string must be at most ${schemaNode.maxLength} characters`);
      }
      if (schemaNode.pattern) {
        const regex = new RegExp(schemaNode.pattern);
        if (!regex.test(value)) {
          errors.push(`${path}: string must match pattern ${schemaNode.pattern}`);
        }
      }
    }
    
    // Validate number constraints
    if ((schemaNode.type === 'number' || schemaNode.type === 'integer') && typeof value === 'number') {
      if (schemaNode.minimum !== undefined && value < schemaNode.minimum) {
        errors.push(`${path}: number must be >= ${schemaNode.minimum}`);
      }
      if (schemaNode.maximum !== undefined && value > schemaNode.maximum) {
        errors.push(`${path}: number must be <= ${schemaNode.maximum}`);
      }
    }
  }
  
  validate(data, schema, '$');
  
  return { valid: errors.length === 0, errors };
}

// ============ Agent WebSocket Handler ============

async function handleAgentWebSocket(request: Request, env: Env, url: URL): Promise<Response> {
  // Check for WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return jsonError('Expected WebSocket upgrade', 426);
  }

  // Extract conversation ID from path or query params
  // Format: /v1/agent/ws/:conversationId or /v1/agent/ws?conversationId=xxx
  const pathParts = url.pathname.split('/');
  let conversationId = pathParts[4] || url.searchParams.get('conversationId');
  
  // If no conversation ID, create a new one
  if (!conversationId) {
    conversationId = crypto.randomUUID();
  }

  // Get user ID from query params OR headers (browsers can't send headers with WebSocket)
  // Priority: query param > X-API-Key header > Authorization header
  const apiKey = url.searchParams.get('apiKey') ||
                 request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');
  
  let userId = 'anonymous';
  let userPlan: 'free' | 'pro' | 'enterprise' = 'free';
  
  if (apiKey) {
    const keyInfo = await validateApiKey(env, apiKey);
    if (keyInfo) {
      userId = keyInfo.userId;
      userPlan = keyInfo.plan;
    }
  }

  // Get or create Durable Object for this conversation
  const id = env.BINARIO_AGENT!.idFromName(conversationId);
  const agent = env.BINARIO_AGENT!.get(id);

  // Forward the WebSocket upgrade request to the Durable Object
  const agentUrl = new URL(request.url);
  agentUrl.pathname = '/';
  agentUrl.searchParams.set('userId', userId);
  agentUrl.searchParams.set('conversationId', conversationId);

  return agent.fetch(new Request(agentUrl, {
    headers: request.headers,
    method: request.method,
  }));
}

// ============ Agent REST Handler ============

async function handleAgentRest(request: Request, env: Env, url: URL): Promise<Response> {
  const pathParts = url.pathname.split('/');
  // Format: /v1/agent/:conversationId/:action
  const conversationId = pathParts[3];
  const action = pathParts[4] || '';

  if (!conversationId || conversationId === 'ws') {
    return jsonError('Conversation ID required', 400);
  }

  // Optional authentication
  const apiKey = request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');
  
  let userId = 'anonymous';
  if (apiKey) {
    const keyInfo = await validateApiKey(env, apiKey);
    if (keyInfo) {
      userId = keyInfo.userId;
    }
  }

  // Get Durable Object for this conversation
  const id = env.BINARIO_AGENT!.idFromName(conversationId);
  const agent = env.BINARIO_AGENT!.get(id);

  // Build the request URL for the Durable Object
  const agentUrl = new URL(request.url);
  
  switch (action) {
    case 'state':
      agentUrl.pathname = '/state';
      break;
    case 'history':
      agentUrl.pathname = '/history';
      break;
    case 'clear':
      agentUrl.pathname = '/clear';
      break;
    case 'chat':
      agentUrl.pathname = '/chat';
      break;
    default:
      return jsonError('Unknown agent action', 404);
  }

  agentUrl.searchParams.set('userId', userId);

  const response = await agent.fetch(new Request(agentUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  }));

  // Add CORS headers to the response
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

// ============ RAG Endpoints Handler ============

interface RagIngestRequest {
  content: string;
  documentId?: string;
  namespace?: string;
  metadata?: Record<string, string | number | boolean>;
  chunkSize?: number;
  chunkOverlap?: number;
}

interface RagSearchRequest {
  query: string;
  topK?: number;
  namespace?: string;
  filter?: Record<string, unknown>;
}

interface RagQueryRequest {
  query: string;
  topK?: number;
  namespace?: string;
  model?: string;
  systemPrompt?: string;
}

interface RagEmbedRequest {
  text: string | string[];
}

interface RagDeleteRequest {
  ids: string[];
  namespace?: string;
}

async function handleRagEndpoint(request: Request, env: Env, path: string): Promise<Response> {
  // RAG endpoints require API key authentication
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
    return jsonError('Rate limit exceeded', 429);
  }

  const ragEnv: RagEnv = {
    AI: env.AI,
    DB: env.DB,
    VECTORIZE_INDEX: env.VECTORIZE_INDEX!,
  };

  try {
    // POST /v1/rag/ingest - Ingest a document
    if (path === '/v1/rag/ingest' && request.method === 'POST') {
      const body = await request.json() as RagIngestRequest;
      
      if (!body.content) {
        return jsonError('Content is required', 400);
      }

      const result = await ingestDocument(ragEnv, body.content, {
        documentId: body.documentId,
        namespace: body.namespace || keyInfo.userId,
        metadata: body.metadata,
        chunkOptions: {
          chunkSize: body.chunkSize,
          chunkOverlap: body.chunkOverlap,
        },
      });

      // Track usage
      await trackUsage(env, keyInfo, '@cf/baai/bge-base-en-v1.5', [], { response: `${result.chunks} chunks` });

      return jsonResponse(result, 201);
    }

    // POST /v1/rag/search - Semantic search
    if (path === '/v1/rag/search' && request.method === 'POST') {
      const body = await request.json() as RagSearchRequest;
      
      if (!body.query) {
        return jsonError('Query is required', 400);
      }

      const results = await searchDocuments(ragEnv, body.query, {
        topK: body.topK || 5,
        namespace: body.namespace || keyInfo.userId,
        filter: body.filter,
      });

      // Track usage
      await trackUsage(env, keyInfo, '@cf/baai/bge-base-en-v1.5', [{ role: 'user', content: body.query }], { response: '' });

      return jsonResponse({ results });
    }

    // POST /v1/rag/query - RAG query with answer generation
    if (path === '/v1/rag/query' && request.method === 'POST') {
      const body = await request.json() as RagQueryRequest;
      
      if (!body.query) {
        return jsonError('Query is required', 400);
      }

      const result = await ragQuery(ragEnv, body.query, {
        topK: body.topK || 5,
        namespace: body.namespace || keyInfo.userId,
        model: body.model,
        systemPrompt: body.systemPrompt,
      });

      // Track usage (embedding + generation)
      await trackUsage(env, keyInfo, body.model || '@cf/meta/llama-3.1-8b-instruct', [{ role: 'user', content: body.query }], { response: result.answer });

      return jsonResponse(result);
    }

    // POST /v1/rag/embed - Generate embeddings
    if (path === '/v1/rag/embed' && request.method === 'POST') {
      const body = await request.json() as RagEmbedRequest;
      
      if (!body.text) {
        return jsonError('Text is required', 400);
      }

      const texts = Array.isArray(body.text) ? body.text : [body.text];
      const embeddings: number[][] = [];

      for (const text of texts) {
        const embedding = await generateEmbedding(ragEnv, text);
        embeddings.push(embedding);
      }

      // Track usage
      await trackUsage(env, keyInfo, '@cf/baai/bge-base-en-v1.5', [], { response: `${texts.length} embeddings` });

      return jsonResponse({
        embeddings,
        model: getEmbeddingInfo().model,
        dimensions: getEmbeddingInfo().dimensions,
      });
    }

    // DELETE /v1/rag/documents - Delete documents
    if (path === '/v1/rag/documents' && request.method === 'DELETE') {
      const body = await request.json() as RagDeleteRequest;
      
      if (!body.ids || !Array.isArray(body.ids)) {
        return jsonError('IDs array is required', 400);
      }

      const result = await deleteDocuments(ragEnv, body.ids, body.namespace || keyInfo.userId);

      return jsonResponse(result);
    }

    // GET /v1/rag/info - Get RAG configuration info
    if (path === '/v1/rag/info' && request.method === 'GET') {
      return jsonResponse({
        embedding: getEmbeddingInfo(),
        features: ['ingest', 'search', 'query', 'embed', 'delete'],
        limits: {
          maxChunkSize: 2000,
          maxDocumentSize: 100000,
          maxTopK: 100,
        },
      });
    }

    return jsonError('RAG endpoint not found', 404);

  } catch (error) {
    console.error('RAG error:', error);
    return jsonError(
      error instanceof Error ? error.message : 'RAG operation failed',
      500
    );
  }
}

// ============ Workflow Endpoints Handler ============

interface WorkflowRunRequest {
  type: 'research' | 'rag';
  payload: Record<string, unknown>;
}

async function handleWorkflowEndpoint(request: Request, env: Env, path: string): Promise<Response> {
  // Workflow endpoints require API key authentication
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
    return jsonError('Rate limit exceeded', 429);
  }

  try {
    // POST /v1/workflows/run - Start a new workflow
    if (path === '/v1/workflows/run' && request.method === 'POST') {
      const body = await request.json() as WorkflowRunRequest;
      
      if (!body.type) {
        return jsonError('Workflow type is required', 400);
      }

      let instance: WorkflowInstance;
      const instanceId = crypto.randomUUID();

      switch (body.type) {
        case 'research':
          instance = await env.RESEARCH_WORKFLOW!.create({
            id: instanceId,
            params: {
              ...body.payload,
              userId: keyInfo.userId,
            },
          });
          break;

        case 'rag':
          instance = await env.RAG_WORKFLOW!.create({
            id: instanceId,
            params: {
              ...body.payload,
              userId: keyInfo.userId,
            },
          });
          break;

        default:
          return jsonError(`Unknown workflow type: ${body.type}`, 400);
      }

      // Track usage
      await trackUsage(env, keyInfo, 'workflow', [], { response: 'workflow started' });

      return jsonResponse({
        instanceId: instance.id,
        type: body.type,
        status: 'running',
        createdAt: new Date().toISOString(),
      }, 201);
    }

    // GET /v1/workflows/:instanceId - Get workflow status
    const statusMatch = path.match(/^\/v1\/workflows\/([a-f0-9-]+)$/);
    if (statusMatch && request.method === 'GET') {
      const instanceId = statusMatch[1];

      // Try to get status from both workflow types
      let instance: WorkflowInstance | null = null;
      let workflowType = '';

      try {
        instance = await env.RESEARCH_WORKFLOW!.get(instanceId);
        workflowType = 'research';
      } catch {
        try {
          instance = await env.RAG_WORKFLOW!.get(instanceId);
          workflowType = 'rag';
        } catch {
          return jsonError('Workflow instance not found', 404);
        }
      }

      if (!instance) {
        return jsonError('Workflow instance not found', 404);
      }

      const status = await instance.status();

      return jsonResponse({
        instanceId,
        type: workflowType,
        status: status.status,
        output: status.output,
        error: status.error,
      });
    }

    // POST /v1/workflows/:instanceId/pause - Pause a workflow
    const pauseMatch = path.match(/^\/v1\/workflows\/([a-f0-9-]+)\/pause$/);
    if (pauseMatch && request.method === 'POST') {
      const instanceId = pauseMatch[1];

      let instance: WorkflowInstance | null = null;
      try {
        instance = await env.RESEARCH_WORKFLOW!.get(instanceId);
      } catch {
        try {
          instance = await env.RAG_WORKFLOW!.get(instanceId);
        } catch {
          return jsonError('Workflow instance not found', 404);
        }
      }

      if (!instance) {
        return jsonError('Workflow instance not found', 404);
      }

      await instance.pause();
      return jsonResponse({ instanceId, status: 'paused' });
    }

    // POST /v1/workflows/:instanceId/resume - Resume a workflow
    const resumeMatch = path.match(/^\/v1\/workflows\/([a-f0-9-]+)\/resume$/);
    if (resumeMatch && request.method === 'POST') {
      const instanceId = resumeMatch[1];

      let instance: WorkflowInstance | null = null;
      try {
        instance = await env.RESEARCH_WORKFLOW!.get(instanceId);
      } catch {
        try {
          instance = await env.RAG_WORKFLOW!.get(instanceId);
        } catch {
          return jsonError('Workflow instance not found', 404);
        }
      }

      if (!instance) {
        return jsonError('Workflow instance not found', 404);
      }

      await instance.resume();
      return jsonResponse({ instanceId, status: 'running' });
    }

    // POST /v1/workflows/:instanceId/terminate - Terminate a workflow
    const terminateMatch = path.match(/^\/v1\/workflows\/([a-f0-9-]+)\/terminate$/);
    if (terminateMatch && request.method === 'POST') {
      const instanceId = terminateMatch[1];

      let instance: WorkflowInstance | null = null;
      try {
        instance = await env.RESEARCH_WORKFLOW!.get(instanceId);
      } catch {
        try {
          instance = await env.RAG_WORKFLOW!.get(instanceId);
        } catch {
          return jsonError('Workflow instance not found', 404);
        }
      }

      if (!instance) {
        return jsonError('Workflow instance not found', 404);
      }

      await instance.terminate();
      return jsonResponse({ instanceId, status: 'terminated' });
    }

    // GET /v1/workflows/info - Get available workflows
    if (path === '/v1/workflows/info' && request.method === 'GET') {
      return jsonResponse({
        workflows: [
          {
            type: 'research',
            description: 'Multi-step research workflow: analyze query, search context, synthesize answer',
            parameters: {
              query: { type: 'string', required: true, description: 'The research query' },
              model: { type: 'string', required: false, description: 'AI model to use' },
              topK: { type: 'number', required: false, description: 'Number of context results' },
              includeRag: { type: 'boolean', required: false, description: 'Include RAG search' },
            },
          },
          {
            type: 'rag',
            description: 'Document ingestion workflow: chunk, embed, and store in vector database',
            parameters: {
              content: { type: 'string', required: true, description: 'Document content' },
              documentId: { type: 'string', required: true, description: 'Unique document ID' },
              metadata: { type: 'object', required: false, description: 'Document metadata' },
              chunkSize: { type: 'number', required: false, description: 'Chunk size in chars' },
              chunkOverlap: { type: 'number', required: false, description: 'Overlap between chunks' },
            },
          },
        ],
        features: ['run', 'status', 'pause', 'resume', 'terminate'],
      });
    }

    return jsonError('Workflow endpoint not found', 404);

  } catch (error) {
    console.error('Workflow error:', error);
    return jsonError(
      error instanceof Error ? error.message : 'Workflow operation failed',
      500
    );
  }
}

// ============ Sandbox/Projects Handler ============

async function handleSandboxEndpoint(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  
  // Most sandbox endpoints require authentication
  const apiKey = url.searchParams.get('apiKey') ||
                 request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');

  // Templates endpoint is public
  if (path === '/v1/sandbox/templates' || path === '/v1/projects/templates') {
    return jsonResponse({ templates: getAvailableTemplates() });
  }

  if (!apiKey) {
    return jsonError('API key required', 401);
  }

  const keyInfo = await validateApiKey(env, apiKey);
  if (!keyInfo) {
    return jsonError('Invalid API key', 401);
  }

  try {
    // POST /v1/projects - Create new project
    if ((path === '/v1/sandbox/projects' || path === '/v1/projects') && request.method === 'POST') {
      const body = await request.json() as { name: string; template?: string };
      
      if (!body.name) {
        return jsonError('Project name is required', 400);
      }

      const result = await createProject(
        env as any,
        keyInfo.userId,
        body.name,
        body.template || 'react-vite'
      );

      return jsonResponse(result, 201);
    }

    // GET /v1/projects - List user's projects
    if ((path === '/v1/sandbox/projects' || path === '/v1/projects') && request.method === 'GET') {
      const projects = await listUserProjects(env as any, keyInfo.userId);
      return jsonResponse({ projects });
    }

    // Project-specific endpoints: /v1/projects/:projectId/...
    const projectMatch = path.match(/^\/v1\/(?:sandbox\/)?projects\/([^\/]+)(?:\/(.*))?$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const action = projectMatch[2] || '';

      // Verify project belongs to user
      const project = await getProjectById(env as any, projectId);
      if (!project) {
        return jsonError('Project not found', 404);
      }
      if (project.userId !== keyInfo.userId) {
        return jsonError('Access denied', 403);
      }

      // Get Durable Object for this project
      const id = env.SANDBOX_PROJECT!.idFromName(projectId);
      const sandbox = env.SANDBOX_PROJECT!.get(id);

      // Route to appropriate action
      switch (action) {
        case '':
          // GET /v1/projects/:id - Get project details
          if (request.method === 'GET') {
            return sandbox.fetch(new Request(`${url.origin}/status`));
          }
          // DELETE /v1/projects/:id - Delete project
          if (request.method === 'DELETE') {
            const deleted = await deleteProject(env as any, projectId, keyInfo.userId);
            if (deleted) {
              await sandbox.fetch(new Request(`${url.origin}/delete`, { method: 'POST' }));
              return jsonResponse({ success: true });
            }
            return jsonError('Failed to delete project', 500);
          }
          break;

        case 'files':
          // GET/POST /v1/projects/:id/files
          return sandbox.fetch(new Request(`${url.origin}/files${url.search}`, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }));

        case 'exec':
          // POST /v1/projects/:id/exec - Execute command
          if (request.method === 'POST') {
            return sandbox.fetch(new Request(`${url.origin}/exec`, {
              method: 'POST',
              headers: request.headers,
              body: request.body,
            }));
          }
          break;

        case 'start':
          // POST /v1/projects/:id/start - Start dev server
          if (request.method === 'POST') {
            return sandbox.fetch(new Request(`${url.origin}/start`, { method: 'POST' }));
          }
          break;

        case 'stop':
          // POST /v1/projects/:id/stop - Stop dev server
          if (request.method === 'POST') {
            return sandbox.fetch(new Request(`${url.origin}/stop`, { method: 'POST' }));
          }
          break;

        case 'preview':
          // GET /v1/projects/:id/preview - Get preview URL
          if (request.method === 'GET') {
            return sandbox.fetch(new Request(`${url.origin}/preview`));
          }
          break;
      }
    }

    return jsonError('Sandbox endpoint not found', 404);

  } catch (error) {
    console.error('Sandbox error:', error);
    return jsonError(
      error instanceof Error ? error.message : 'Sandbox operation failed',
      500
    );
  }
}
