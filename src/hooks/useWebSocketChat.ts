import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/contexts/AuthContext';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface UseWebSocketChatOptions {
  getApiKey: () => string;
  selectedModel: string;
  systemPrompt: string;
  onMessages: (updater: (prev: Message[]) => Message[]) => void;
  onStreamingContent: (content: string) => void;
  onThinking: (thinking: boolean) => void;
  onTokensPerSecond: (tps: number | null) => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;

export function useWebSocketChat({
  getApiKey,
  selectedModel,
  systemPrompt,
  onMessages,
  onStreamingContent,
  onThinking,
  onTokensPerSecond,
}: UseWebSocketChatOptions) {
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('disconnected');
  const [conversationId] = useState(() => crypto.randomUUID());
  const wsRef = useRef<WebSocket | null>(null);
  const streamingContentRef = useRef('');
  const tokenCountRef = useRef(0);
  const streamStartTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connectWebSocket = useCallback(() => {
    const apiKey = getApiKey();
    if (!apiKey || wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/v1/agent/ws/${conversationId}?apiKey=${apiKey}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      reconnectAttemptsRef.current = 0;
      toast.success('WebSocket connected!');
      ws.send(JSON.stringify({ type: 'set_system_prompt', systemPrompt }));
      ws.send(JSON.stringify({ type: 'set_model', model: selectedModel }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'history':
            if (data.messages) onMessages(() => data.messages);
            break;
          case 'token':
            if (data.content) {
              onThinking(false);
              if (!streamStartTimeRef.current) streamStartTimeRef.current = Date.now();
              streamingContentRef.current += data.content;
              tokenCountRef.current += 1;
              onStreamingContent(streamingContentRef.current);
              const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
              if (elapsed > 0.5) onTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
            }
            break;
          case 'complete':
            onThinking(false);
            if (streamingContentRef.current) {
              onMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current, timestamp: Date.now() }]);
              streamingContentRef.current = '';
              onStreamingContent('');
            }
            onTokensPerSecond(null);
            streamStartTimeRef.current = null;
            tokenCountRef.current = 0;
            break;
          case 'error':
            toast.error(data.error || 'Agent error');
            onThinking(false);
            break;
          case 'pong':
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        toast.warning('WebSocket unavailable, switching to HTTP mode');
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        setTimeout(() => connectWebSocket(), delay);
      }
    };
  }, [conversationId, getApiKey, selectedModel, systemPrompt, onMessages, onStreamingContent, onThinking, onTokensPerSecond]);

  const disconnectWebSocket = useCallback(() => {
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
  }, []);

  const sendWebSocket = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('WebSocket not connected');
      return;
    }
    onMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
    onThinking(true);
    streamingContentRef.current = '';
    onStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;
    wsRef.current.send(JSON.stringify({ type: 'chat', content }));
  }, [onMessages, onThinking, onStreamingContent]);

  const manualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnectWebSocket();
    setTimeout(() => connectWebSocket(), 500);
  }, [disconnectWebSocket, connectWebSocket]);

  const clearWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  }, []);

  const stopWs = useCallback(() => {
    onThinking(false);
    if (streamingContentRef.current) {
      onMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current }]);
      streamingContentRef.current = '';
      onStreamingContent('');
    }
  }, [onMessages, onThinking, onStreamingContent]);

  return {
    wsStatus,
    wsRef,
    reconnectAttemptsRef,
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocket,
    manualReconnect,
    clearWs,
    stopWs,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
}
