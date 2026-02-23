/**
 * useBinarioAgent - Unified hook for connecting to BinarioAgent
 * 
 * Replaces useWebSocketChat + useHttpChat + useAgent with a single
 * hook that uses the Cloudflare Agents SDK React bindings.
 * 
 * For the Playground page, this provides:
 * - Real-time WebSocket chat with streaming
 * - Reactive state sync (model, neurons, features)
 * - Automatic reconnection
 * - Tool calling support
 * - Fallback to HTTP when WebSocket unavailable
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// Types matching the AIChatAgent protocol
export interface AgentMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  createdAt?: Date;
  toolInvocations?: ToolInvocation[];
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'call' | 'result' | 'partial-call';
  result?: unknown;
}

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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseBinarioAgentOptions {
  /** Base URL for the Binario API */
  baseUrl: string;
  /** Conversation/session ID */
  conversationId?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** System prompt override */
  systemPrompt?: string;
  /** Model override */
  model?: string;
  /** Callback for each token during streaming */
  onToken?: (token: string) => void;
  /** Callback when response completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback on connection status change */
  onStatusChange?: (status: ConnectionStatus) => void;
}

export interface UseBinarioAgentReturn {
  /** Connection status */
  status: ConnectionStatus;
  /** All messages in conversation */
  messages: AgentMessage[];
  /** Current streaming content (partial response) */
  streamingContent: string;
  /** Whether the agent is streaming */
  isStreaming: boolean;
  /** Whether a request is loading */
  isLoading: boolean;
  /** Reactive agent state (model, neurons, etc.) */
  agentState: AgentState;
  /** Tokens per second during streaming */
  tokensPerSecond: number | null;
  /** Send a message */
  send: (content: string) => void;
  /** Stop current generation */
  stop: () => void;
  /** Clear conversation history */
  clear: () => void;
  /** Update agent state (model, system prompt, etc.) */
  updateState: (partial: Partial<AgentState>) => void;
  /** Connect to the agent */
  connect: () => void;
  /** Disconnect from the agent */
  disconnect: () => void;
  /** Send a message via HTTP fallback */
  sendHttp: (content: string) => Promise<void>;
  /** Conversation ID */
  conversationId: string;
}

const DEFAULT_STATE: AgentState = {
  model: '@cf/ibm-granite/granite-4.0-h-micro',
  systemPrompt: 'You are a helpful AI assistant powered by Binario.',
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

const MAX_RECONNECT_ATTEMPTS = 3;

export function useBinarioAgent(options: UseBinarioAgentOptions): UseBinarioAgentReturn {
  const {
    baseUrl,
    conversationId: providedConversationId,
    apiKey,
    autoConnect = false,
    systemPrompt,
    model,
    onToken,
    onComplete,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({
    ...DEFAULT_STATE,
    ...(systemPrompt ? { systemPrompt } : {}),
    ...(model ? { model } : {}),
  });
  const [tokensPerSecond, setTokensPerSecond] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingContentRef = useRef('');
  const tokenCountRef = useRef(0);
  const streamStartTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(providedConversationId || crypto.randomUUID());

  // Update status with callback
  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Connect via WebSocket
  const connect = useCallback(() => {
    if (!apiKey || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    updateStatus('connecting');
    const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/v1/agent/ws/${conversationIdRef.current}?apiKey=${apiKey}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      // Send initial state
      if (systemPrompt) {
        ws.send(JSON.stringify({ type: 'set_system_prompt', systemPrompt }));
      }
      if (model) {
        ws.send(JSON.stringify({ type: 'set_model', model }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'history':
            if (data.messages) {
              setMessages(data.messages.map((m: any, i: number) => ({
                id: `msg-${i}`,
                role: m.role,
                content: m.content,
                createdAt: m.timestamp ? new Date(m.timestamp) : undefined,
              })));
            }
            if (data.model) {
              setAgentState(prev => ({ ...prev, model: data.model }));
            }
            break;

          case 'token':
            if (data.content) {
              setIsStreaming(true);
              setIsLoading(false);
              if (!streamStartTimeRef.current) streamStartTimeRef.current = Date.now();
              streamingContentRef.current += data.content;
              tokenCountRef.current += 1;
              setStreamingContent(streamingContentRef.current);
              onToken?.(data.content);

              const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
              if (elapsed > 0.5) {
                setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
              }
            }
            break;

          case 'complete':
            setIsStreaming(false);
            setIsLoading(false);
            if (streamingContentRef.current) {
              setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: streamingContentRef.current,
                createdAt: new Date(),
              }]);
              streamingContentRef.current = '';
              setStreamingContent('');
            }
            setTokensPerSecond(null);
            streamStartTimeRef.current = null;
            tokenCountRef.current = 0;
            onComplete?.();
            break;

          case 'state_update':
            if (data.model) {
              setAgentState(prev => ({ ...prev, model: data.model }));
            }
            if (data.state) {
              setAgentState(prev => ({ ...prev, ...data.state }));
            }
            break;

          case 'error':
            onError?.(new Error(data.error || 'Agent error'));
            setIsStreaming(false);
            setIsLoading(false);
            break;

          case 'pong':
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      updateStatus('error');
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        toast.warning('WebSocket unavailable, use HTTP mode');
      }
    };

    ws.onclose = () => {
      updateStatus('disconnected');
      wsRef.current = null;
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        setTimeout(() => connect(), delay);
      }
    };
  }, [apiKey, baseUrl, model, systemPrompt, onToken, onComplete, onError, updateStatus]);

  // Disconnect
  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
    wsRef.current?.close();
    wsRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  // Send via WebSocket
  const send = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to HTTP if WebSocket not connected
      sendHttpFallback(content);
      return;
    }

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    streamingContentRef.current = '';
    setStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;
    wsRef.current.send(JSON.stringify({ type: 'chat', content }));
  }, []);

  // HTTP fallback for when WebSocket is unavailable
  const sendHttpFallback = useCallback(async (content: string) => {
    if (!apiKey) {
      onError?.(new Error('API key required'));
      return;
    }

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages(prev => {
      // Capture current messages for the request body using the updater
      const allMessages = [...prev, userMessage];
      // Schedule the fetch after state update
      queueMicrotask(() => {
        performHttpRequest(allMessages, controller);
      });
      return allMessages;
    });
    setIsLoading(true);
    streamingContentRef.current = '';
    setStreamingContent('');

    const controller = new AbortController();
    abortControllerRef.current = controller;
  }, [apiKey, baseUrl, agentState.model, agentState.systemPrompt, onToken, onComplete, onError]);

  // Extracted HTTP request logic to avoid stale closure
  const performHttpRequest = useCallback(async (allMessages: AgentMessage[], controller: AbortController) => {
    try {
      const response = await fetch(`${baseUrl}/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey!,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          model: agentState.model,
          system_prompt: agentState.systemPrompt,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      streamStartTimeRef.current = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                setIsStreaming(true);
                setIsLoading(false);
                streamingContentRef.current += token;
                tokenCountRef.current += 1;
                setStreamingContent(streamingContentRef.current);
                onToken?.(token);

                const elapsed = (Date.now() - streamStartTimeRef.current!) / 1000;
                if (elapsed > 0.5) {
                  setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
                }
              }
            } catch { /* skip non-JSON */ }
          }
        }
      }

      // Finalize
      if (streamingContentRef.current) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: streamingContentRef.current,
          createdAt: new Date(),
        }]);
        streamingContentRef.current = '';
        setStreamingContent('');
      }
      onComplete?.();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        onError?.(error as Error);
        toast.error((error as Error).message);
      }
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      setTokensPerSecond(null);
      streamStartTimeRef.current = null;
      tokenCountRef.current = 0;
      abortControllerRef.current = null;
    }
  }, [apiKey, baseUrl, agentState.model, agentState.systemPrompt, onToken, onComplete, onError]);

  // Stop generation
  const stop = useCallback(() => {
    setIsStreaming(false);
    setIsLoading(false);
    abortControllerRef.current?.abort();
    if (streamingContentRef.current) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: streamingContentRef.current,
        createdAt: new Date(),
      }]);
      streamingContentRef.current = '';
      setStreamingContent('');
    }
    setTokensPerSecond(null);
  }, []);

  // Clear history
  const clear = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
    setMessages([]);
    setStreamingContent('');
    streamingContentRef.current = '';
  }, []);

  // Update reactive state
  const updateState = useCallback((partial: Partial<AgentState>) => {
    setAgentState(prev => {
      const next = { ...prev, ...partial };
      
      // Sync model change to WebSocket
      if (partial.model && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'set_model', model: partial.model }));
      }
      // Sync system prompt change
      if (partial.systemPrompt && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'set_system_prompt', systemPrompt: partial.systemPrompt }));
      }
      
      return next;
    });
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && apiKey) {
      connect();
    }
    return () => {
      wsRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, [autoConnect, apiKey]);

  return {
    status,
    messages,
    streamingContent,
    isStreaming,
    isLoading,
    agentState,
    tokensPerSecond,
    send,
    stop,
    clear,
    updateState,
    connect,
    disconnect,
    sendHttp: sendHttpFallback,
    conversationId: conversationIdRef.current,
  };
}

export default useBinarioAgent;
