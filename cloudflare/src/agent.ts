/**
 * BinarioAgent - Cloudflare Durable Object Agent
 * Provides persistent state, WebSocket support, and real-time AI chat
 */

import { DurableObject } from 'cloudflare:workers';

export interface AgentEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
}

interface AgentState {
  conversationId: string;
  userId: string;
  messages: ChatMessage[];
  model: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

interface WebSocketSession {
  id: string;
  userId: string;
  socket: WebSocket;
  isAuthenticated: boolean;
}

interface IncomingMessage {
  type: 'chat' | 'ping' | 'clear' | 'set_model' | 'set_system_prompt';
  content?: string;
  model?: string;
  systemPrompt?: string;
}

interface OutgoingMessage {
  type: 'token' | 'complete' | 'error' | 'pong' | 'history' | 'state_update';
  content?: string;
  messages?: ChatMessage[];
  model?: string;
  error?: string;
  timestamp?: number;
}

// Default model for free tier
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export class BinarioAgent extends DurableObject<AgentEnv> {
  private sessions: Map<WebSocket, WebSocketSession> = new Map();
  private state: AgentState;

  constructor(ctx: DurableObjectState, env: AgentEnv) {
    super(ctx, env);
    
    // Initialize state with defaults
    this.state = {
      conversationId: ctx.id.toString(),
      userId: '',
      messages: [],
      model: DEFAULT_MODEL,
      systemPrompt: 'You are a helpful AI assistant powered by Binario.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Load state from SQLite storage
  private async loadState(): Promise<void> {
    try {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (stored) {
        this.state = stored;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  // Save state to SQLite storage
  private async saveState(): Promise<void> {
    try {
      this.state.updatedAt = Date.now();
      await this.ctx.storage.put('state', this.state);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  // Handle HTTP requests (upgrade to WebSocket or API calls)
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle REST API calls
    switch (url.pathname) {
      case '/state':
        return this.handleGetState();
      case '/history':
        return this.handleGetHistory();
      case '/clear':
        if (request.method === 'POST') {
          return this.handleClearHistory();
        }
        break;
      case '/chat':
        if (request.method === 'POST') {
          return this.handleChatRequest(request);
        }
        break;
    }

    return new Response('Not found', { status: 404 });
  }

  // Upgrade HTTP connection to WebSocket
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    await this.loadState();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Extract user info from query params or headers
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anonymous';
    const sessionId = crypto.randomUUID();

    const session: WebSocketSession = {
      id: sessionId,
      userId,
      socket: server,
      isAuthenticated: userId !== 'anonymous',
    };

    this.sessions.set(server, session);

    // Update state with user ID if authenticated
    if (userId !== 'anonymous') {
      this.state.userId = userId;
      await this.saveState();
    }

    // Send current state to the new connection
    this.sendToSocket(server, {
      type: 'history',
      messages: this.state.messages,
      model: this.state.model,
      timestamp: Date.now(),
    });

    // Set up event listeners
    server.addEventListener('message', async (event) => {
      await this.handleWebSocketMessage(server, event.data);
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      console.log(`Session ${sessionId} disconnected`);
    });

    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Handle incoming WebSocket messages
  private async handleWebSocketMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    try {
      const message: IncomingMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendToSocket(socket, { type: 'pong', timestamp: Date.now() });
          break;

        case 'chat':
          if (message.content) {
            await this.handleStreamingChat(socket, message.content);
          }
          break;

        case 'clear':
          this.state.messages = [];
          await this.saveState();
          this.broadcast({ type: 'history', messages: [], timestamp: Date.now() });
          break;

        case 'set_model':
          if (message.model) {
            this.state.model = message.model;
            await this.saveState();
            this.broadcast({ type: 'state_update', model: this.state.model, timestamp: Date.now() });
          }
          break;

        case 'set_system_prompt':
          if (message.systemPrompt !== undefined) {
            this.state.systemPrompt = message.systemPrompt;
            await this.saveState();
          }
          break;

        default:
          this.sendToSocket(socket, { type: 'error', error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToSocket(socket, { 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Handle streaming chat with AI
  private async handleStreamingChat(socket: WebSocket, userContent: string): Promise<void> {
    // Add user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    this.state.messages.push(userMessage);
    await this.saveState();

    // Broadcast user message to all connected clients
    this.broadcast({
      type: 'complete',
      content: JSON.stringify(userMessage),
      timestamp: Date.now(),
    });

    try {
      // Build messages for AI
      const aiMessages = [
        ...(this.state.systemPrompt ? [{ role: 'system' as const, content: this.state.systemPrompt }] : []),
        ...this.state.messages.map(m => ({ role: m.role, content: m.content })),
      ];

      // Call Workers AI
      const response = await this.env.AI.run(this.state.model as any, {
        messages: aiMessages,
        stream: true,
      });

      let fullContent = '';

      // Handle streaming response
      if (response instanceof ReadableStream) {
        const reader = response.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Parse SSE format
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const token = parsed.response || parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                  fullContent += token;
                  // Send token to all connected clients
                  this.broadcast({ type: 'token', content: token, timestamp: Date.now() });
                }
              } catch {
                // Handle non-JSON chunks (raw text from some models)
                if (data && data !== '[DONE]') {
                  fullContent += data;
                  this.broadcast({ type: 'token', content: data, timestamp: Date.now() });
                }
              }
            }
          }
        }
      } else if (typeof response === 'object' && 'response' in response) {
        // Non-streaming response
        fullContent = (response as { response: string }).response;
        this.broadcast({ type: 'token', content: fullContent, timestamp: Date.now() });
      }

      // Add assistant message to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };
      this.state.messages.push(assistantMessage);
      await this.saveState();

      // Send completion signal
      this.broadcast({ type: 'complete', timestamp: Date.now() });

    } catch (error) {
      console.error('AI chat error:', error);
      this.sendToSocket(socket, {
        type: 'error',
        error: error instanceof Error ? error.message : 'AI request failed',
      });
    }
  }

  // Send message to a specific socket
  private sendToSocket(socket: WebSocket, message: OutgoingMessage): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send to socket:', error);
    }
  }

  // Broadcast message to all connected clients
  private broadcast(message: OutgoingMessage): void {
    for (const [socket] of this.sessions) {
      this.sendToSocket(socket, message);
    }
  }

  // REST API: Get current state
  private async handleGetState(): Promise<Response> {
    await this.loadState();
    return new Response(JSON.stringify({
      conversationId: this.state.conversationId,
      model: this.state.model,
      messageCount: this.state.messages.length,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // REST API: Get message history
  private async handleGetHistory(): Promise<Response> {
    await this.loadState();
    return new Response(JSON.stringify({
      messages: this.state.messages,
      model: this.state.model,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // REST API: Clear history
  private async handleClearHistory(): Promise<Response> {
    this.state.messages = [];
    await this.saveState();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // REST API: Handle chat request (non-WebSocket)
  private async handleChatRequest(request: Request): Promise<Response> {
    await this.loadState();

    const body = await request.json() as { content: string; model?: string };
    
    if (body.model) {
      this.state.model = body.model;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: body.content,
      timestamp: Date.now(),
    };
    this.state.messages.push(userMessage);

    // Build messages for AI
    const aiMessages = [
      ...(this.state.systemPrompt ? [{ role: 'system' as const, content: this.state.systemPrompt }] : []),
      ...this.state.messages.map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const response = await this.env.AI.run(this.state.model as any, {
        messages: aiMessages,
      });

      const content = typeof response === 'object' && 'response' in response 
        ? (response as { response: string }).response 
        : '';

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: Date.now(),
      };
      this.state.messages.push(assistantMessage);
      await this.saveState();

      return new Response(JSON.stringify({
        message: assistantMessage,
        messages: this.state.messages,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'AI request failed',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Scheduled tasks (called by alarm)
  async alarm(): Promise<void> {
    // Clean up old messages (keep last 100)
    if (this.state.messages.length > 100) {
      this.state.messages = this.state.messages.slice(-100);
      await this.saveState();
    }
  }
}
