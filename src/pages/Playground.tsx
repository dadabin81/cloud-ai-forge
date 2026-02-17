import { useState, useRef, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';
import { useProviders } from '@/hooks/useProviders';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Send, 
  Bot, 
  User, 
  Zap, 
  Loader2,
  Sparkles,
  Code,
  Copy,
  Check,
  Settings,
  MessageSquare,
  Layers,
  Key,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Storage keys for preferences
const STORAGE_KEYS = {
  provider: 'binario_provider',
  model: 'binario_model',
  useWebSocket: 'binario_websocket',
  systemPrompt: 'binario_system_prompt',
};

export default function Playground() {
  const { apiKey: storedApiKey, isAuthenticated, regenerateApiKey } = useAuth();
  const { providers, models, isLoading: isLoadingProviders, isProviderConfigured, refetch: refetchProviders } = useProviders();
  
  // Load persisted preferences
  const [selectedProvider, setSelectedProvider] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.provider) || 'cloudflare'
  );
  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.model) || '@cf/meta/llama-3.1-8b-instruct'
  );
  const [useWebSocket, setUseWebSocket] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.useWebSocket) === 'true'
  );
  const [systemPrompt, setSystemPrompt] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.systemPrompt) || 'You are a helpful AI assistant.'
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [tokensPerSecond, setTokensPerSecond] = useState<number | null>(null);
  
  // WebSocket mode
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('disconnected');
  const [conversationId] = useState(() => crypto.randomUUID());
  const wsRef = useRef<WebSocket | null>(null);
  const streamingContentRef = useRef('');
  const tokenCountRef = useRef(0);
  const streamStartTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  
  // API Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // HTTP mode state
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.provider, selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.model, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.useWebSocket, String(useWebSocket));
  }, [useWebSocket]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt);
  }, [systemPrompt]);

  // Get the effective API key for requests
  const getEffectiveApiKey = useCallback(() => {
    return apiKeyInput || storedApiKey || '';
  }, [apiKeyInput, storedApiKey]);

  // Auto-fill API key when user is authenticated and has a stored key
  useEffect(() => {
    if (isAuthenticated && storedApiKey && !apiKeyInput) {
      setApiKeyInput(storedApiKey);
      setIsApiKeyValid(true);
    }
  }, [isAuthenticated, storedApiKey, apiKeyInput]);

  // Validate API key when it changes
  useEffect(() => {
    const keyToValidate = apiKeyInput || storedApiKey;
    if (!keyToValidate?.trim()) {
      setIsApiKeyValid(null);
      return;
    }

    const validateKey = async () => {
      setIsValidating(true);
      try {
        // Use /v1/account/usage which actually requires valid auth (not /v1/models which is public)
        const response = await fetch(`${API_BASE_URL}/v1/account/usage`, {
          headers: {
            'Authorization': `Bearer ${keyToValidate}`,
          },
        });
        setIsApiKeyValid(response.ok);
        if (!response.ok) {
          console.warn('API key validation failed:', response.status);
        }
      } catch {
        setIsApiKeyValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    const debounce = setTimeout(validateKey, 500);
    return () => clearTimeout(debounce);
  }, [apiKeyInput, storedApiKey]);

  // WebSocket connection with auto-reconnect
  const connectWebSocket = useCallback(() => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey || wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('connecting');

    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/v1/agent/ws/${conversationId}?apiKey=${effectiveApiKey}`;
    console.log('🔵 Attempting WebSocket connection to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🟢 WebSocket connected successfully!');
      setWsStatus('connected');
      reconnectAttemptsRef.current = 0;
      toast.success('WebSocket connected!');
      
      // Send system prompt configuration
      ws.send(JSON.stringify({ 
        type: 'set_system_prompt', 
        systemPrompt 
      }));
      
      // Set model
      ws.send(JSON.stringify({ 
        type: 'set_model', 
        model: selectedModel 
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'history':
            if (data.messages) {
              setMessages(data.messages);
            }
            break;
            
          case 'token':
            if (data.content) {
              setIsThinking(false);
              if (!streamStartTimeRef.current) {
                streamStartTimeRef.current = Date.now();
              }
              streamingContentRef.current += data.content;
              tokenCountRef.current += 1;
              setStreamingContent(streamingContentRef.current);
              
              const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
              if (elapsed > 0.5) {
                setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
              }
            }
            break;
            
          case 'complete':
            setIsThinking(false);
            if (streamingContentRef.current) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: streamingContentRef.current,
                timestamp: Date.now(),
              }]);
              streamingContentRef.current = '';
              setStreamingContent('');
            }
            setTokensPerSecond(null);
            streamStartTimeRef.current = null;
            tokenCountRef.current = 0;
            break;
            
          case 'error':
            toast.error(data.error || 'Agent error');
            setIsThinking(false);
            break;
            
          case 'pong':
            // Heartbeat acknowledged
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('🔴 WebSocket error event:', error);
      setWsStatus('error');
      
      // Auto-fallback to HTTP if WebSocket fails
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        toast.warning('WebSocket unavailable, switching to HTTP mode');
        setUseWebSocket(false);
      }
    };

    ws.onclose = (event) => {
      console.log('🟡 WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setWsStatus('disconnected');
      wsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (useWebSocket && isApiKeyValid && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        setTimeout(() => connectWebSocket(), delay);
      }
    };
  }, [conversationId, getEffectiveApiKey, selectedModel, systemPrompt, useWebSocket, isApiKeyValid]);

  const disconnectWebSocket = useCallback(() => {
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
  }, []);

  // Auto-connect when WebSocket mode is enabled and API key is valid
  // NOTE: wsStatus is intentionally NOT a dependency to avoid reconnect loops
  useEffect(() => {
    if (useWebSocket && isApiKeyValid) {
      // Only connect if not already connected/connecting
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        reconnectAttemptsRef.current = 0;
        connectWebSocket();
      }
    } else if (!useWebSocket) {
      disconnectWebSocket();
    }
    
    return () => {
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebSocket, isApiKeyValid]);

  // Update model when provider changes
  useEffect(() => {
    const providerModels = models[selectedProvider];
    if (providerModels?.length) {
      // Only update if current model doesn't belong to selected provider
      const currentModelInProvider = providerModels.some(m => m.id === selectedModel);
      if (!currentModelInProvider) {
        setSelectedModel(providerModels[0].id);
      }
    }
  }, [selectedProvider, models, selectedModel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Handle regenerating API key
  const handleRegenerateApiKey = async () => {
    setIsRegenerating(true);
    const result = await regenerateApiKey();
    if (result.success && result.apiKey) {
      setApiKeyInput(result.apiKey);
      setIsApiKeyValid(true);
      toast.success('New API key generated!');
    } else {
      toast.error(result.error || 'Failed to regenerate API key');
    }
    setIsRegenerating(false);
  };

  // Test API key with detailed logging
  const testApiKey = async () => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey) {
      toast.error('No API key to test');
      return;
    }

    console.log('🧪 Testing API key...');
    console.log('🧪 API_BASE_URL:', API_BASE_URL);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
        },
      });
      
      const data = await response.json();
      console.log('🧪 Response:', response.status, data);
      
      if (response.ok) {
        toast.success(`API key valid! Found ${data.models?.length || 0} models`);
        // Refresh providers to get latest data
        refetchProviders();
      } else {
        toast.error(`API error: ${response.status} - ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('🧪 API test error:', error);
      toast.error(`Network error: ${(error as Error).message}`);
    }
  };

  // Manual WebSocket reconnect
  const manualReconnect = () => {
    console.log('🔄 Manual reconnect triggered');
    reconnectAttemptsRef.current = 0;
    disconnectWebSocket();
    setTimeout(() => {
      connectWebSocket();
    }, 500);
  };

  // Send message via WebSocket
  const sendWebSocket = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('WebSocket not connected');
      return;
    }

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
    setIsThinking(true);
    streamingContentRef.current = '';
    setStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;

    wsRef.current.send(JSON.stringify({ type: 'chat', content }));
  }, []);

  // Send message via HTTP (SSE)
  const sendHttp = async (content: string) => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    const userMessage: Message = { role: 'user', content };
    const allMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages,
      userMessage,
    ];

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsThinking(true);
    streamingContentRef.current = '';
    setStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          model: selectedModel,
          provider: selectedProvider,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('API key inválida. Regenera tu API key desde el Dashboard.');
          setIsApiKeyValid(false);
          // Remove the failed user message so UI stays clean
          setMessages(prev => prev.slice(0, -1));
          return;
        }
        if (response.status === 429) {
          toast.error('Límite de peticiones excedido. Espera un momento.');
          return;
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
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
                  const token = parsed.choices?.[0]?.delta?.content;
                  if (token) {
                    if (!streamStartTimeRef.current) {
                      setIsThinking(false);
                      streamStartTimeRef.current = Date.now();
                    }
                    streamingContentRef.current += token;
                    tokenCountRef.current += 1;
                    setStreamingContent(streamingContentRef.current);
                    
                    const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
                    if (elapsed > 0.5) {
                      setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
                    }
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      } else {
        setIsThinking(false);
        const data = await response.json();
        streamingContentRef.current = data.choices?.[0]?.message?.content || '';
        setStreamingContent(streamingContentRef.current);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current }]);
      setStreamingContent('');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Chat error:', error);
        toast.error('Failed to get response');
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      streamingContentRef.current = '';
      setStreamingContent('');
      setTokensPerSecond(null);
      abortControllerRef.current = null;
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');

    // If WebSocket is enabled AND connected, use it; otherwise fall back to HTTP
    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
      sendWebSocket(content);
    } else {
      sendHttp(content);
    }
  };

  const handleStop = () => {
    if (useWebSocket) {
      // WebSocket doesn't support abort, but we can clear state
      setIsThinking(false);
      if (streamingContentRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current }]);
        streamingContentRef.current = '';
        setStreamingContent('');
      }
    } else {
      abortControllerRef.current?.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyConversation = () => {
    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Conversation copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent('');
    streamingContentRef.current = '';
    
    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);
  const currentModels = models[selectedProvider] || [];
  const isStreamingOrLoading = isThinking || isLoading || !!streamingContent;

  const codeSnippet = useWebSocket 
    ? `import { useAgent } from 'binario';

// WebSocket-based real-time chat
const { messages, send, status, isStreaming } = useAgent({
  baseUrl: '${API_BASE_URL}',
  apiKey: 'your-api-key',
  conversationId: '${conversationId}',
  onToken: (token) => console.log('Token:', token),
});

// Send a message
send('Hello!');

// Messages are persisted and sync across devices`
    : `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: 'your-api-key',
});

// HTTP streaming chat
const response = await ai.chat([
  { role: 'user', content: 'Hello!' }
], { 
  model: '${selectedModel}',
  stream: true,
});`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span>Interactive Demo</span>
                {useWebSocket && (
                  <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                    <Wifi className="w-3 h-3 mr-1" />
                    WebSocket
                  </Badge>
                )}
              </div>
              <ConnectionStatus 
                wsStatus={wsStatus}
                useWebSocket={useWebSocket}
                isApiKeyValid={isApiKeyValid}
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              Binario <span className="gradient-text">Playground</span>
            </h1>
            <p className="text-muted-foreground">
              Test the Binario API with real AI responses. {useWebSocket ? 'Using real-time WebSocket connection with persistent state.' : 'Using HTTP streaming.'}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chat Panel */}
            <div className="lg:col-span-2 flex flex-col">
              <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                <TabsList className="mb-4">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <Code className="w-4 h-4" />
                    Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
                  {/* Messages */}
                  <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto rounded-xl border border-border bg-secondary/20 p-4 space-y-4">
                    {messages.length === 0 && !streamingContent && !isThinking && (
                      <div className="h-full flex items-center justify-center text-center">
                        <div className="space-y-2">
                          <Bot className="w-12 h-12 mx-auto text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            Start a conversation with Binario AI
                          </p>
                          <p className="text-sm text-muted-foreground/70">
                            {useWebSocket 
                              ? 'WebSocket mode: Real-time streaming with persistent history'
                              : 'HTTP mode: Standard streaming response'}
                          </p>
                        </div>
                      </div>
                    )}

                    {isThinking && !streamingContent && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="max-w-[80%] rounded-xl px-4 py-3 bg-secondary">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {messages.map((message, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary'
                          )}
                        >
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {message.content}
                          </pre>
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}

                    {streamingContent && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="max-w-[80%] rounded-xl px-4 py-3 bg-secondary">
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {streamingContent}
                            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                          </pre>
                          {tokensPerSecond && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {tokensPerSecond} tokens/sec
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                        className="min-h-[60px] resize-none"
                        disabled={isStreamingOrLoading}
                      />
                      {isStreamingOrLoading ? (
                        <Button onClick={handleStop} variant="destructive" className="h-auto">
                          Stop
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSend}
                          disabled={!input.trim() || !getEffectiveApiKey().trim() || (useWebSocket && wsStatus !== 'connected')}
                          className="h-auto"
                        >
                          <Send className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearChat}
                          disabled={messages.length === 0}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyConversation}
                          disabled={messages.length === 0}
                          className="gap-1"
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                        className="gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        Settings
                      </Button>
                    </div>

                    {showSettings && (
                      <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">System Prompt</label>
                          <Textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="System prompt..."
                            className="min-h-[80px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="code" className="flex-1 mt-0">
                  <div className="rounded-xl border border-border bg-[#1a1a2e] p-4 font-mono text-sm overflow-x-auto">
                    <pre className="text-gray-300">
                      <code>{codeSnippet}</code>
                    </pre>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    {useWebSocket 
                      ? 'WebSocket mode provides real-time streaming and persistent conversation history.'
                      : 'HTTP mode uses standard streaming for responses.'}
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Config Panel */}
            <div className="space-y-6">
              {/* Connection Mode */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  {useWebSocket ? <Wifi className="w-4 h-4 text-cyan-400" /> : <WifiOff className="w-4 h-4" />}
                  Connection Mode
                </h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{useWebSocket ? 'WebSocket (Real-time)' : 'HTTP (Streaming)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {useWebSocket ? 'Persistent state, low latency' : 'Standard streaming'}
                    </p>
                  </div>
                  <Switch
                    checked={useWebSocket}
                    onCheckedChange={setUseWebSocket}
                  />
                </div>
                
                {useWebSocket && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          wsStatus === 'connected' ? 'bg-emerald-500' :
                          wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                          wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        )} />
                        <span className="text-sm capitalize">{wsStatus}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={wsStatus === 'connected' ? disconnectWebSocket : manualReconnect}
                        disabled={wsStatus === 'connecting' || !isApiKeyValid}
                      >
                        <RefreshCw className={cn("w-3 h-3", wsStatus === 'connecting' && 'animate-spin')} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* API Key Input */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Key
                  {isAuthenticated && (
                    <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                      Logged in
                    </Badge>
                  )}
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={storedApiKey ? 'Using stored key...' : 'bsk_live_...'}
                      className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {!isValidating && isApiKeyValid === true && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {!isValidating && isApiKeyValid === false && <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                  
                  {isAuthenticated && storedApiKey && (
                    <p className="text-xs text-emerald-400">✓ API key stored and ready</p>
                  )}
                  
                  {isAuthenticated && !storedApiKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerateApiKey}
                      disabled={isRegenerating}
                      className="w-full"
                    >
                      {isRegenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                      {isRegenerating ? 'Generating...' : 'Generate API Key'}
                    </Button>
                  )}
                  
                  {isAuthenticated && storedApiKey && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRegenerateApiKey}
                        disabled={isRegenerating}
                        className="flex-1 text-xs"
                      >
                        {isRegenerating ? 'Regenerating...' : 'Regenerate Key'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={testApiKey}
                        className="flex-1 text-xs"
                      >
                        Test API
                      </Button>
                    </div>
                  )}
                  
                  {/* Debug buttons for WebSocket issues */}
                  {useWebSocket && wsStatus !== 'connected' && (
                    <div className="pt-2 border-t border-border mt-2 space-y-2">
                      <p className="text-xs text-amber-400">⚠️ WebSocket not connected</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={testApiKey}
                          className="flex-1 text-xs"
                        >
                          Test HTTP
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={manualReconnect}
                          className="flex-1 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reconnect
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Check browser console (F12) for detailed errors
                      </p>
                    </div>
                  )}
                  
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">
                      <Link to="/auth" className="text-primary hover:underline">Login</Link> to auto-fill your API key
                    </p>
                  )}
                </div>
              </div>

              {/* Provider Selection */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Configuration
                  {isLoadingProviders && <Loader2 className="w-3 h-3 animate-spin" />}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Provider</label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center gap-2">
                              {provider.name}
                              {provider.free && (
                                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400">
                                  Free
                                </Badge>
                              )}
                              {!provider.configured && (
                                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Not configured
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProviderData && !selectedProviderData.configured && (
                      <p className="text-xs text-amber-400 mt-1">
                        ⚠️ This provider requires API key configuration on the server
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Model</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              {model.name}
                              {model.tier === 'free' && (
                                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400">
                                  Free
                                </Badge>
                              )}
                              {model.tier === 'pro' && (
                                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                  Pro
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4">Status</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      isApiKeyValid ? "border-emerald-500/50 text-emerald-400" : "border-amber-500/50 text-amber-400"
                    )}>
                      {isApiKeyValid ? 'Connected' : 'Not connected'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{selectedProviderData?.name || selectedProvider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-mono text-xs truncate max-w-[150px]" title={selectedModel}>
                      {selectedModel.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages</span>
                    <span>{messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      useWebSocket ? "border-cyan-500/50 text-cyan-400" : ""
                    )}>
                      {useWebSocket ? <Wifi className="w-3 h-3 mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                      {useWebSocket ? 'WebSocket' : 'HTTP'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                <p className="text-sm text-primary/90">
                  <strong>Live API:</strong> Connected to Binario at {API_BASE_URL.replace('https://', '')}
                </p>
                {useWebSocket && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Conversation ID: {conversationId.slice(0, 8)}...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
