/**
 * useAgent Hook - Real-time WebSocket connection to BinarioAgent
 * Provides persistent state and streaming AI chat
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
}

interface IncomingMessage {
  type: 'token' | 'complete' | 'error' | 'pong' | 'history' | 'state_update';
  content?: string;
  messages?: AgentMessage[];
  model?: string;
  error?: string;
  timestamp?: number;
}

interface OutgoingMessage {
  type: 'chat' | 'ping' | 'clear' | 'set_model' | 'set_system_prompt';
  content?: string;
  model?: string;
  systemPrompt?: string;
}

export interface UseAgentOptions {
  /** Base URL for the Binario API */
  baseUrl: string;
  /** Conversation ID (auto-generated if not provided) */
  conversationId?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Callback when connected */
  onConnect?: () => void;
  /** Callback when disconnected */
  onDisconnect?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback for each streaming token */
  onToken?: (token: string) => void;
  /** Callback when response is complete */
  onComplete?: () => void;
}

export interface UseAgentReturn {
  /** Current connection status */
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** All messages in the conversation */
  messages: AgentMessage[];
  /** Current streaming content */
  streamingContent: string;
  /** Whether the agent is currently streaming a response */
  isStreaming: boolean;
  /** Current model being used */
  model: string;
  /** The conversation ID */
  conversationId: string;
  /** Connect to the agent */
  connect: () => void;
  /** Disconnect from the agent */
  disconnect: () => void;
  /** Send a message to the agent */
  send: (content: string) => void;
  /** Clear conversation history */
  clear: () => void;
  /** Set the AI model */
  setModel: (model: string) => void;
  /** Set the system prompt */
  setSystemPrompt: (prompt: string) => void;
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const {
    baseUrl,
    conversationId: providedConversationId,
    apiKey,
    autoConnect = true,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    onConnect,
    onDisconnect,
    onError,
    onToken,
    onComplete,
  } = options;

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModelState] = useState('@cf/meta/llama-3.1-8b-instruct');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationIdRef = useRef(providedConversationId || crypto.randomUUID());
  const streamingContentRef = useRef('');

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  // Connect function
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    // Build WebSocket URL
    const wsUrl = new URL(`${baseUrl.replace(/^http/, 'ws')}/v1/agent/ws/${conversationIdRef.current}`);
    if (apiKey) {
      wsUrl.searchParams.set('apiKey', apiKey);
    }

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      onConnect?.();

      // Start ping interval
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      ws.onclose = () => {
        clearInterval(pingInterval);
      };
    };

    ws.onmessage = (event) => {
      try {
        const message: IncomingMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'history':
            if (message.messages) {
              setMessages(message.messages);
            }
            if (message.model) {
              setModelState(message.model);
            }
            break;

          case 'token':
            if (message.content) {
              setIsStreaming(true);
              streamingContentRef.current += message.content;
              setStreamingContent(streamingContentRef.current);
              onToken?.(message.content);
            }
            break;

          case 'complete':
            setIsStreaming(false);
            // If there was streaming content, add it as a message
            if (streamingContentRef.current) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: streamingContentRef.current,
                timestamp: Date.now(),
              }]);
              streamingContentRef.current = '';
              setStreamingContent('');
            }
            onComplete?.();
            break;

          case 'error':
            onError?.(new Error(message.error || 'Unknown error'));
            setIsStreaming(false);
            break;

          case 'state_update':
            if (message.model) {
              setModelState(message.model);
            }
            break;

          case 'pong':
            // Heartbeat acknowledged
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setStatus('error');
      onError?.(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      onDisconnect?.();

      // Auto-reconnect
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay * reconnectAttemptsRef.current);
      }
    };
  }, [baseUrl, apiKey, autoReconnect, reconnectDelay, maxReconnectAttempts, onConnect, onDisconnect, onError, onToken, onComplete]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, [maxReconnectAttempts]);

  // Send message function
  const send = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.(new Error('WebSocket not connected'));
      return;
    }

    // Add user message immediately
    const userMessage: AgentMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Reset streaming state
    streamingContentRef.current = '';
    setStreamingContent('');
    setIsStreaming(true);

    // Send to agent
    const message: OutgoingMessage = {
      type: 'chat',
      content,
    };
    wsRef.current.send(JSON.stringify(message));
  }, [onError]);

  // Clear history function
  const clear = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
    setMessages([]);
    setStreamingContent('');
    streamingContentRef.current = '';
  }, []);

  // Set model function
  const setModel = useCallback((newModel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_model', model: newModel }));
    }
    setModelState(newModel);
  }, []);

  // Set system prompt function
  const setSystemPrompt = useCallback((prompt: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_system_prompt', systemPrompt: prompt }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  return {
    status,
    messages,
    streamingContent,
    isStreaming,
    model,
    conversationId: conversationIdRef.current,
    connect,
    disconnect,
    send,
    clear,
    setModel,
    setSystemPrompt,
  };
}

export default useAgent;
