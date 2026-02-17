import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Navigation } from '@/components/Navigation';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';
import { useProviders } from '@/hooks/useProviders';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Send, Bot, User, Zap, Loader2, Sparkles, Copy, Check, Settings, Key,
  CheckCircle, XCircle, Wifi, WifiOff, RefreshCw, AlertTriangle,
  ChevronUp, ChevronDown, MessageSquare, Layers, Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FileExplorer } from '@/components/FileExplorer';
import { CodeEditor } from '@/components/CodeEditor';
import { CodePreview } from '@/components/CodePreview';
import { extractCodeBlocks, isRenderableCode, hasProjectMarkers } from '@/lib/codeExtractor';
import { parseProjectFiles, generateFileTree, type ProjectFile } from '@/lib/projectGenerator';
import { ResourceBadges } from '@/components/ResourceBadges';
import { CloudPanel } from '@/components/CloudPanel';
import { parseActions, executeAllActions, enrichWithRAG, type ActionResult } from '@/lib/chatActions';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const STORAGE_KEYS = {
  provider: 'binario_provider',
  model: 'binario_model',
  useWebSocket: 'binario_websocket',
  systemPrompt: 'binario_system_prompt',
};

const DEFAULT_SYSTEM_PROMPT = `You are Binario AI, a professional full-stack web development assistant powered by Cloudflare's edge infrastructure.

You have DIRECT ACCESS to these cloud resources and MUST use them automatically when relevant:

## Your Cloud Actions (use these automatically, don't ask the user to do it manually)

When you need to use a cloud resource, include the action marker in your response. The system will execute it automatically.

- **Search knowledge base**: [ACTION:rag_search:{"query":"your search"}]
- **Ask knowledge base**: [ACTION:rag_query:{"query":"your question"}]
- **Ingest a document**: [ACTION:rag_ingest:{"content":"text to store"}]
- **Deep research**: [ACTION:workflow_research:{"topic":"research topic"}]
- **Ingest URL into knowledge base**: [ACTION:workflow_rag_ingest:{"url":"https://..."}]
- **Check workflow status**: [ACTION:workflow_status:{"instanceId":"id"}]
- **Create sandbox project**: [ACTION:project_create:{"name":"project-name","template":"react-vite"}]

## When to auto-use actions:
- User asks to "search", "find", "look up" → use rag_search or rag_query
- User asks to "remember", "save", "store knowledge" → use rag_ingest
- User asks to "research", "investigate", "analyze deeply" → use workflow_research  
- User shares a URL to learn from → use workflow_rag_ingest
- User wants to create a project/app → use project_create AND generate code

## Code Generation

When creating apps/websites, organize code into multiple files:

// filename: src/App.jsx
[code here]

// filename: src/styles.css
[code here]

// filename: index.html
[code here]

Always include: index.html, CSS, and JS/JSX files. Use modern CSS and responsive design.

IMPORTANT: Use actions naturally in your responses. The user should never need to manually trigger cloud features - you do it for them.`;

export default function Playground() {
  const { apiKey: storedApiKey, isAuthenticated, regenerateApiKey } = useAuth();
  const { providers, models, isLoading: isLoadingProviders, refetch: refetchProviders } = useProviders();
  
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
    localStorage.getItem(STORAGE_KEYS.systemPrompt) || DEFAULT_SYSTEM_PROMPT
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [tokensPerSecond, setTokensPerSecond] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // WebSocket
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('disconnected');
  const [conversationId] = useState(() => crypto.randomUUID());
  const wsRef = useRef<WebSocket | null>(null);
  const streamingContentRef = useRef('');
  const tokenCountRef = useRef(0);
  const streamStartTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  
  // API Key
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // HTTP
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // IDE state
  const [projectFiles, setProjectFiles] = useState<Record<string, ProjectFile>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudTab, setCloudTab] = useState('models');
  const fileTree = useMemo(() => generateFileTree(projectFiles), [projectFiles]);
  const totalFiles = Object.keys(projectFiles).length;
  const activeFileData = activeFile ? projectFiles[activeFile] : null;

  // Persist preferences
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.provider, selectedProvider); }, [selectedProvider]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.model, selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.useWebSocket, String(useWebSocket)); }, [useWebSocket]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt); }, [systemPrompt]);

  const getEffectiveApiKey = useCallback(() => apiKeyInput || storedApiKey || '', [apiKeyInput, storedApiKey]);

  useEffect(() => {
    if (isAuthenticated && storedApiKey && !apiKeyInput) {
      setApiKeyInput(storedApiKey);
      setIsApiKeyValid(true);
    }
  }, [isAuthenticated, storedApiKey, apiKeyInput]);

  // Validate API key
  useEffect(() => {
    const keyToValidate = apiKeyInput || storedApiKey;
    if (!keyToValidate?.trim()) { setIsApiKeyValid(null); return; }
    const validateKey = async () => {
      setIsValidating(true);
      try {
        if (!keyToValidate.startsWith('bsk_')) { setIsApiKeyValid(false); return; }
        const response = await fetch(`${API_BASE_URL}/v1/models`, {
          headers: { 'Authorization': `Bearer ${keyToValidate}` },
        });
        setIsApiKeyValid(response.ok);
      } catch { setIsApiKeyValid(false); }
      finally { setIsValidating(false); }
    };
    const debounce = setTimeout(validateKey, 500);
    return () => clearTimeout(debounce);
  }, [apiKeyInput, storedApiKey]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey || wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/v1/agent/ws/${conversationId}?apiKey=${effectiveApiKey}`;
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
          case 'history': if (data.messages) setMessages(data.messages); break;
          case 'token':
            if (data.content) {
              setIsThinking(false);
              if (!streamStartTimeRef.current) streamStartTimeRef.current = Date.now();
              streamingContentRef.current += data.content;
              tokenCountRef.current += 1;
              setStreamingContent(streamingContentRef.current);
              const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
              if (elapsed > 0.5) setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
            }
            break;
          case 'complete':
            setIsThinking(false);
            if (streamingContentRef.current) {
              setMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current, timestamp: Date.now() }]);
              streamingContentRef.current = '';
              setStreamingContent('');
            }
            setTokensPerSecond(null);
            streamStartTimeRef.current = null;
            tokenCountRef.current = 0;
            break;
          case 'error': toast.error(data.error || 'Agent error'); setIsThinking(false); break;
          case 'pong': break;
        }
      } catch (error) { console.error('Failed to parse WebSocket message:', error); }
    };

    ws.onerror = () => {
      setWsStatus('error');
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        toast.warning('WebSocket unavailable, switching to HTTP mode');
        setUseWebSocket(false);
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
      if (useWebSocket && isApiKeyValid && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        setTimeout(() => connectWebSocket(), delay);
      }
    };
  }, [conversationId, getEffectiveApiKey, selectedModel, systemPrompt, useWebSocket, isApiKeyValid]);

  const disconnectWebSocket = useCallback(() => {
    reconnectAttemptsRef.current = maxReconnectAttempts;
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
  }, []);

  useEffect(() => {
    if (useWebSocket && isApiKeyValid) {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        reconnectAttemptsRef.current = 0;
        connectWebSocket();
      }
    } else if (!useWebSocket) { disconnectWebSocket(); }
    return () => { wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebSocket, isApiKeyValid]);

  useEffect(() => {
    const providerModels = models[selectedProvider];
    if (providerModels?.length) {
      if (!providerModels.some(m => m.id === selectedModel)) {
        setSelectedModel(providerModels[0].id);
      }
    }
  }, [selectedProvider, models, selectedModel]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);

  // Auto-detect project files from latest assistant message
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;

    if (hasProjectMarkers(lastAssistant.content)) {
      const files = parseProjectFiles(lastAssistant.content);
      if (Object.keys(files).length > 0) {
        setProjectFiles(files);
        const firstFile = Object.keys(files)[0];
        setActiveFile(firstFile);
        return;
      }
    }

    // Fallback: check for single renderable blocks
    const blocks = extractCodeBlocks(lastAssistant.content);
    if (isRenderableCode(blocks)) {
      // Create a virtual file map from blocks
      const virtualFiles: Record<string, ProjectFile> = {};
      blocks.forEach((block, i) => {
        const ext = block.language === 'css' ? 'css' : block.language === 'html' || block.language === 'htm' ? 'html' : block.language === 'jsx' || block.language === 'tsx' ? 'jsx' : 'js';
        const name = blocks.length === 1 ? `index.${ext}` : `file${i + 1}.${ext}`;
        virtualFiles[name] = { code: block.code, language: block.language };
      });
      setProjectFiles(virtualFiles);
      setActiveFile(Object.keys(virtualFiles)[0]);
    }
  }, [messages]);

  const handleRegenerateApiKey = async () => {
    setIsRegenerating(true);
    const result = await regenerateApiKey();
    if (result.success && result.apiKey) {
      setApiKeyInput(result.apiKey);
      setIsApiKeyValid(true);
      toast.success('New API key generated!');
    } else { toast.error(result.error || 'Failed to regenerate API key'); }
    setIsRegenerating(false);
  };

  const testApiKey = async () => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey) { toast.error('No API key to test'); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/v1/models`, { headers: { 'Authorization': `Bearer ${effectiveApiKey}` } });
      const data = await response.json();
      if (response.ok) { toast.success(`API key valid! Found ${data.models?.length || 0} models`); refetchProviders(); }
      else { toast.error(`API error: ${response.status}`); }
    } catch (error) { toast.error(`Network error: ${(error as Error).message}`); }
  };

  const manualReconnect = () => {
    reconnectAttemptsRef.current = 0;
    disconnectWebSocket();
    setTimeout(() => connectWebSocket(), 500);
  };

  const sendWebSocket = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { toast.error('WebSocket not connected'); return; }
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
    setIsThinking(true);
    streamingContentRef.current = '';
    setStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;
    wsRef.current.send(JSON.stringify({ type: 'chat', content }));
  }, []);

  const sendHttp = async (content: string) => {
    const effectiveApiKey = getEffectiveApiKey();
    if (!effectiveApiKey.trim()) { toast.error('Please enter your API key'); return; }
    const userMessage: Message = { role: 'user', content };

    // Auto-enrich with RAG context (silent, non-blocking)
    let ragContext: string | null = null;
    try { ragContext = await enrichWithRAG(content, effectiveApiKey); } catch { /* silent */ }

    const allMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...(ragContext ? [{ role: 'system' as const, content: ragContext }] : []),
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveApiKey}` },
        body: JSON.stringify({ messages: allMessages, model: selectedModel, provider: selectedProvider, stream: true }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('API key inválida. Regenera tu API key desde el Dashboard.');
          setIsApiKeyValid(false);
          setMessages(prev => prev.slice(0, -1));
          return;
        }
        if (response.status === 429) { toast.error('Límite de peticiones excedido.'); return; }
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
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.choices?.[0]?.delta?.content;
                  if (token) {
                    if (!streamStartTimeRef.current) { setIsThinking(false); streamStartTimeRef.current = Date.now(); }
                    streamingContentRef.current += token;
                    tokenCountRef.current += 1;
                    setStreamingContent(streamingContentRef.current);
                    const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
                    if (elapsed > 0.5) setTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
                  }
                } catch { /* ignore */ }
              }
            }
          }
        }
      } else {
        setIsThinking(false);
        const data = await response.json();
        const assistantContent = data.choices?.[0]?.message?.content || '';
        // Process actions from non-streaming response
        const { cleanText, actions } = parseActions(assistantContent);
        setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
        if (actions.length > 0) {
          processActions(actions, effectiveApiKey);
        }
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
        return;
      }

      // Process actions from streaming response
      const finalContent = streamingContentRef.current;
      const { cleanText, actions } = parseActions(finalContent);
      setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
      setStreamingContent('');
      if (actions.length > 0) {
        processActions(actions, effectiveApiKey);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { console.error('Chat error:', error); toast.error('Failed to get response'); }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      streamingContentRef.current = '';
      setStreamingContent('');
      setTokensPerSecond(null);
      abortControllerRef.current = null;
    }
  };

  // Auto-execute actions from AI responses
  const processActions = async (actions: ReturnType<typeof parseActions>['actions'], apiKey: string) => {
    const results = await executeAllActions(actions, apiKey);
    for (const result of results) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.summary,
        timestamp: Date.now(),
      }]);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) sendWebSocket(content);
    else sendHttp(content);
  };

  const handleStop = () => {
    if (useWebSocket) {
      setIsThinking(false);
      if (streamingContentRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: streamingContentRef.current }]);
        streamingContentRef.current = '';
        setStreamingContent('');
      }
    } else { abortControllerRef.current?.abort(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
    setProjectFiles({});
    setActiveFile(null);
    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);
  const currentModels = models[selectedProvider] || [];
  const isStreamingOrLoading = isThinking || isLoading || !!streamingContent;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navigation />
      
      {/* Top bar */}
      <div className="pt-16 px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Binario <span className="gradient-text">IDE</span></span>
          {useWebSocket && (
            <Badge variant="outline" className="text-xs border-primary/50 text-primary">
              <Wifi className="w-3 h-3 mr-1" />WS
            </Badge>
          )}
          <ConnectionStatus wsStatus={wsStatus} useWebSocket={useWebSocket} isApiKeyValid={isApiKeyValid} />
          <ResourceBadges apiKey={getEffectiveApiKey()} onBadgeClick={(tab) => { setCloudTab(tab); setCloudOpen(true); }} />
        </div>
        <div className="flex items-center gap-2">
          {/* Cloud Panel Sheet */}
          <Sheet open={cloudOpen} onOpenChange={setCloudOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1">
                <Cloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Cloud</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] p-0 overflow-hidden">
              <CloudPanel apiKey={getEffectiveApiKey()} activeTab={cloudTab} onModelSelect={(m) => { setSelectedModel(m); setCloudOpen(false); toast.success(`Model set: ${m.split('/').pop()}`); }} />
            </SheetContent>
          </Sheet>
          {/* Config Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1">
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Config</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Configuration</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* API Key */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Key className="w-4 h-4" /> API Key
                    {isAuthenticated && <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">Logged in</Badge>}
                  </h4>
                  <div className="relative">
                    <Input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder={storedApiKey ? 'Using stored key...' : 'bsk_live_...'} className="pr-10" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {!isValidating && isApiKeyValid === true && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {!isValidating && isApiKeyValid === false && <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                  {isAuthenticated && storedApiKey && <p className="text-xs text-emerald-400">✓ API key stored and ready</p>}
                  {isAuthenticated && !storedApiKey && (
                    <Button size="sm" variant="outline" onClick={handleRegenerateApiKey} disabled={isRegenerating} className="w-full">
                      {isRegenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                      {isRegenerating ? 'Generating...' : 'Generate API Key'}
                    </Button>
                  )}
                  {isAuthenticated && storedApiKey && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={handleRegenerateApiKey} disabled={isRegenerating} className="flex-1 text-xs">
                        {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={testApiKey} className="flex-1 text-xs">Test API</Button>
                    </div>
                  )}
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">
                      <Link to="/auth" className="text-primary hover:underline">Login</Link> to auto-fill your API key
                    </p>
                  )}
                </div>

                {/* Connection Mode */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    {useWebSocket ? <Wifi className="w-4 h-4 text-primary" /> : <WifiOff className="w-4 h-4" />} Connection
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{useWebSocket ? 'WebSocket' : 'HTTP'}</p>
                      <p className="text-xs text-muted-foreground">{useWebSocket ? 'Real-time, persistent' : 'Standard streaming'}</p>
                    </div>
                    <Switch checked={useWebSocket} onCheckedChange={setUseWebSocket} />
                  </div>
                  {useWebSocket && wsStatus !== 'connected' && (
                    <Button size="sm" variant="outline" onClick={manualReconnect} className="w-full text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" /> Reconnect
                    </Button>
                  )}
                </div>

                {/* Provider/Model */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Provider & Model
                    {isLoadingProviders && <Loader2 className="w-3 h-3 animate-spin" />}
                  </h4>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providers.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            {p.name}
                            {p.free && <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400">Free</Badge>}
                            {!p.configured && <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400"><AlertTriangle className="w-3 h-3 mr-1" />NC</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentModels.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            {m.name}
                            {m.tier === 'free' && <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400">Free</Badge>}
                            {m.tier === 'pro' && <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">Pro</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">System Prompt</h4>
                  <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="min-h-[120px] text-xs" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main IDE Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ResizablePanelGroup direction="vertical">
          {/* Top: 3-panel IDE */}
          <ResizablePanel defaultSize={chatOpen ? 65 : 90} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              {/* File Explorer */}
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
                <FileExplorer tree={fileTree} activeFile={activeFile} onFileSelect={setActiveFile} totalFiles={totalFiles} />
              </ResizablePanel>
              <ResizableHandle withHandle />
              {/* Code Editor */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <CodeEditor
                  filename={activeFile}
                  code={activeFileData?.code || ''}
                  language={activeFileData?.language || 'text'}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              {/* Live Preview */}
              <ResizablePanel defaultSize={42} minSize={20}>
                <CodePreview files={projectFiles} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Bottom: Chat */}
          <ResizablePanel defaultSize={chatOpen ? 35 : 10} minSize={5} maxSize={70}>
            <div className="h-full flex flex-col border-t border-border bg-background">
              {/* Chat header */}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center justify-between px-4 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Chat</span>
                  <Badge variant="outline" className="text-xs">{messages.length} msgs</Badge>
                  {isStreamingOrLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </div>
                {chatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {chatOpen && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {messages.length === 0 && !streamingContent && !isThinking && (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-1">
                          <Bot className="w-8 h-8 mx-auto text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">Ask AI to create a project</p>
                          <p className="text-xs text-muted-foreground/60">Try: "Create a modern tech blog"</p>
                        </div>
                      </div>
                    )}

                    {isThinking && !streamingContent && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <div className="rounded-lg px-3 py-2 bg-secondary text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {messages.map((message, i) => (
                      <div key={i} className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {message.role === 'assistant' && (
                          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
                            <Bot className="w-3 h-3 text-primary" />
                          </div>
                        )}
                        <div className={cn(
                          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                          message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                        )}>
                          <pre className="whitespace-pre-wrap font-sans text-xs">{message.content}</pre>
                        </div>
                        {message.role === 'user' && (
                          <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center shrink-0">
                            <User className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    ))}

                    {streamingContent && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <div className="max-w-[85%] rounded-lg px-3 py-2 bg-secondary">
                          <pre className="whitespace-pre-wrap font-sans text-xs">
                            {streamingContent}
                            <span className="inline-block w-1.5 h-3 bg-primary animate-pulse ml-0.5" />
                          </pre>
                          {tokensPerSecond && <div className="mt-1 text-xs text-muted-foreground">{tokensPerSecond} tok/s</div>}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-border bg-secondary/10">
                    <div className="flex gap-2">
                      <Textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe what to build... (Enter to send)"
                        className="min-h-[40px] max-h-[80px] resize-none text-sm"
                        disabled={isStreamingOrLoading}
                      />
                      {isStreamingOrLoading ? (
                        <Button onClick={handleStop} variant="destructive" size="sm" className="h-auto px-3">Stop</Button>
                      ) : (
                        <Button onClick={handleSend} disabled={!input.trim() || !getEffectiveApiKey().trim()} size="sm" className="h-auto px-3">
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearChat} disabled={messages.length === 0}>Clear</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={copyConversation} disabled={messages.length === 0}>
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedProviderData?.name || selectedProvider} · {selectedModel.split('/').pop()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
