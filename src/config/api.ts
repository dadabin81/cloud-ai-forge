// Binario API Configuration
// Connects frontend to Cloudflare Worker backend

export const API_CONFIG = {
  // REST API endpoints (always production - localhost not available in preview)
  baseUrl: import.meta.env.VITE_BINARIO_API_URL || 'https://binario-api.databin81.workers.dev',
  
  // WebSocket endpoints for real-time agents
  wsUrl: import.meta.env.VITE_BINARIO_WS_URL || 'wss://binario-api.databin81.workers.dev',
  
  // API version
  version: 'v1',
  
  // Endpoints
  endpoints: {
    // Auth
    signup: '/v1/auth/signup',
    login: '/v1/auth/login',
    logout: '/v1/auth/logout',
    
    // Chat & AI
    chat: '/v1/chat/completions',
    structured: '/v1/structured',
    embeddings: '/v1/embeddings',
    
    // Agents
    agentRun: '/v1/agents/run',
    agentStream: '/v1/agents/stream',
    agentWebSocket: '/v1/agent', // WebSocket endpoint
    
    // RAG (when enabled)
    ragIngest: '/v1/rag/ingest',
    ragSearch: '/v1/rag/search',
    ragQuery: '/v1/rag/query',
    
    // Account
    usage: '/v1/usage',
    apiKeys: '/v1/keys',
    
    // Health
    health: '/health',
    models: '/v1/models',
    providers: '/v1/providers',
  },
} as const;

// Helper to build full URL
export const buildUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
};

// Helper to build WebSocket URL
export const buildWsUrl = (path: string): string => {
  return `${API_CONFIG.wsUrl}${path}`;
};

export type ApiEndpoint = keyof typeof API_CONFIG.endpoints;
