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
  ChevronDown, MessageSquare, Layers, Save, Wrench, Rocket, Shield, Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FileExplorer } from '@/components/FileExplorer';
import { CodeEditor } from '@/components/CodeEditor';
import { CodePreview } from '@/components/CodePreview';
import { BlueprintCard } from '@/components/BlueprintCard';
import { ChatMessage } from '@/components/ChatMessage';
import { ProjectManager } from '@/components/ProjectManager';
import { DeployDialog } from '@/components/DeployDialog';
import { usePlaygroundProject } from '@/hooks/usePlaygroundProject';
import { useBinarioAgent } from '@/hooks/useBinarioAgent';
import { useProjectSync } from '@/hooks/useProjectSync';
import { buildGenerationPrompt } from '@/lib/blueprintSystem';
import { buildErrorCorrectionPrompt, canAutoCorrect, type PreviewError } from '@/lib/errorCorrection';

// Message type used for display (mapped from AgentMessage)
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

const STORAGE_KEYS = {
  model: 'binario_model',
  useWebSocket: 'binario_websocket',
  systemPrompt: 'binario_system_prompt',
};

const PROMPT_VERSION = 4;
const PROMPT_VERSION_KEY = 'binario_prompt_version';

const DEFAULT_SYSTEM_PROMPT = `You are Binario AI, a professional full-stack VibeCoding assistant that ONLY creates web applications using HTML, CSS, JavaScript, and React/JSX. You NEVER generate Python, Java, PHP, Ruby, or any backend-only code. Everything you produce runs in the browser.

## CRITICAL: FILE FORMAT
Every file you generate MUST start with a filename marker on its own line, immediately before the code block:
// filename: path/to/file.ext

Example:
// filename: index.html
\`\`\`html
<!DOCTYPE html>...
\`\`\`

// filename: src/App.jsx
\`\`\`jsx
function App() { return <div>Hello</div>; }
\`\`\`

## PROJECT STRUCTURE
\`\`\`
index.html              ← Entry point with React/Babel CDN
src/
  App.jsx               ← Main app component
  components/
    Header.jsx          ← Navigation
    [Feature].jsx       ← Feature components
  styles/
    globals.css         ← Global styles
\`\`\`

## RULES
1. ALWAYS use \`// filename: path\` markers before EVERY code block.
2. Write COMPLETE working code — never placeholders or "...".
3. Use React 18 with Babel CDN + Tailwind CDN. No npm/import from packages.
4. For data simulation, use JavaScript arrays/objects with realistic fake data (Spanish names, real-looking emails, prices, etc.).
5. Mobile-first responsive design, dark mode support.
6. When editing existing files, use [EDIT_FILE: path] for modifications, [NEW_FILE: path] for new files.
7. ONLY include files that actually change when editing.

## Proactive Behavior
- After generating, suggest 2-3 improvements
- If vague, ask clarifying questions first
- Explain what you built and why`;

export default function Playground() {
  const { apiKey: storedApiKey, isAuthenticated, regenerateApiKey, user, token } = useAuth();
  const { providers, models, isLoading: isLoadingProviders, refetch: refetchProviders } = useProviders();
  const { project, projects, isSaving, createProject, saveFiles, loadProject, loadProjects, deleteProject, setProject } = usePlaygroundProject(user?.id, token ?? undefined);
  
  // Force cloudflare as the only provider - clean up legacy localStorage
  const selectedProvider = 'cloudflare';
  useEffect(() => { localStorage.removeItem('binario_provider'); }, []);

  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.model) || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  );
  const [useWebSocket, setUseWebSocket] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.useWebSocket) === 'true'
  );
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  // Messages are derived from the agent hook - single source of truth (no local state)
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // API Key
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  const [chatCollapsed, setChatCollapsed] = useState(false);
  
  // Error correction state
  const [previewErrors, setPreviewErrors] = useState<PreviewError[]>([]);
  const [errorCorrectionAttempts, setErrorCorrectionAttempts] = useState(0);
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(() => {
    return localStorage.getItem('binario_autocorrect') === 'true';
  });

  const firstUserMessageRef = useRef<string | null>(null);

  const getEffectiveApiKey = useCallback(() => apiKeyInput || storedApiKey || '', [apiKeyInput, storedApiKey]);

  // Unified Binario Agent hook - single source of truth for messages
  const {
    status: agentStatus,
    messages: agentMessages,
    streamingContent,
    isStreaming,
    isLoading,
    agentState,
    tokensPerSecond,
    send: agentSend,
    stop: agentStop,
    clear: agentClear,
    updateState,
    connect: agentConnect,
    disconnect: agentDisconnect,
    sendHttp,
  } = useBinarioAgent({
    baseUrl: API_BASE_URL,
    apiKey: getEffectiveApiKey() || undefined,
    autoConnect: false,
    systemPrompt,
    model: selectedModel,
    onToken: () => {},
    onComplete: () => {},
    onError: (error) => {
      toast.error(error.message);
    },
    onStatusChange: (status) => {
      if (status === 'connected') {
        toast.success('Agent connected!');
      }
    },
  });

  // Derive display messages from agent hook (single source of truth)
  const messages: Message[] = useMemo(() => 
    agentMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: m.createdAt?.getTime(),
    })),
    [agentMessages]
  );

  // Project sync hook
  const {
    projectFiles, setProjectFiles,
    activeFile, setActiveFile, activeFileData,
    fileTree, totalFiles,
    currentBlueprint, setCurrentBlueprint,
    currentPhase, setCurrentPhase,
    handleCodeChange, handleImportProject,
    resetProject, loadFiles,
  } = useProjectSync({
    messages,
    isAuthenticated,
    project,
    saveFiles,
    createProject,
    firstUserMessageRef,
  });

  const projectFilesRef = useRef(projectFiles);
  projectFilesRef.current = projectFiles;

  // Persist preferences
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.model, selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.model, selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.useWebSocket, String(useWebSocket)); }, [useWebSocket]);
  useEffect(() => { localStorage.setItem('binario_autocorrect', String(autoCorrectEnabled)); }, [autoCorrectEnabled]);

  // Force-update stale system prompts via versioning
  useEffect(() => {
    const storedVersion = localStorage.getItem(PROMPT_VERSION_KEY);
    if (storedVersion !== String(PROMPT_VERSION)) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      localStorage.setItem(PROMPT_VERSION_KEY, String(PROMPT_VERSION));
      localStorage.setItem(STORAGE_KEYS.systemPrompt, DEFAULT_SYSTEM_PROMPT);
    }
  }, []);

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

  // WebSocket connection lifecycle via unified agent
  useEffect(() => {
    if (useWebSocket && isApiKeyValid) {
      agentConnect();
    } else if (!useWebSocket) {
      agentDisconnect();
    }
    return () => { agentDisconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebSocket, isApiKeyValid]);

  // Sync model changes to agent state
  useEffect(() => {
    updateState({ model: selectedModel });
  }, [selectedModel, updateState]);

  useEffect(() => {
    const providerModels = models[selectedProvider];
    if (providerModels?.length) {
      if (!providerModels.some(m => m.id === selectedModel)) {
        setSelectedModel(providerModels[0].id);
      }
    }
  }, [selectedProvider, models, selectedModel]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);

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

  // Unified send - routes through agent (WS) or HTTP fallback
  // The hook manages messages internally - no local setMessages needed
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    
    if (!firstUserMessageRef.current) {
      firstUserMessageRef.current = content;
    }

    if (useWebSocket && agentStatus === 'connected') {
      agentSend(content);
    } else {
      sendHttp(content);
    }
  }, [input, useWebSocket, agentStatus, agentSend, sendHttp]);

  // Handle sending programmatic messages (for error correction, blueprints)
  const handleSendMessage = useCallback((content: string) => {
    if (useWebSocket && agentStatus === 'connected') {
      agentSend(content);
    } else {
      sendHttp(content);
    }
  }, [useWebSocket, agentStatus, agentSend, sendHttp]);

  // No longer needed - messages are tracked by the hook

  const handleStop = useCallback(() => {
    agentStop();
  }, [agentStop]);

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
    agentClear();
    resetProject();
    setPreviewErrors([]);
    setErrorCorrectionAttempts(0);
    firstUserMessageRef.current = null;
  };

  // Handle preview errors
  const handlePreviewErrors = useCallback((errors: PreviewError[]) => {
    setPreviewErrors(prev => [...prev, ...errors]);
    if (autoCorrectEnabled && canAutoCorrect(errorCorrectionAttempts)) {
      const prompt = buildErrorCorrectionPrompt(errors, projectFiles);
      setErrorCorrectionAttempts(a => a + 1);
      handleSendMessage(prompt);
    }
  }, [autoCorrectEnabled, errorCorrectionAttempts, projectFiles, handleSendMessage]);

  // Handle blueprint approval
  const handleBlueprintApprove = useCallback(() => {
    if (!currentBlueprint) return;
    setCurrentPhase('generating');
    const prompt = buildGenerationPrompt(currentBlueprint);
    handleSendMessage(prompt);
  }, [currentBlueprint, handleSendMessage, setCurrentPhase]);

  const handleBlueprintModify = useCallback(() => {
    setCurrentBlueprint(null);
    setCurrentPhase('idle');
    toast.info('Describe los cambios que quieres en el blueprint');
  }, [setCurrentBlueprint, setCurrentPhase]);

  const manualReconnect = useCallback(() => {
    agentDisconnect();
    setTimeout(() => agentConnect(), 500);
  }, [agentDisconnect, agentConnect]);

  const currentModels = models[selectedProvider] || models['cloudflare'] || [];
  const isThinking = isLoading && !streamingContent;
  const isStreamingOrLoading = isThinking || isLoading || !!streamingContent;

  // Map agent status to legacy wsStatus format for ConnectionStatus component
  const wsStatus = agentStatus as 'disconnected' | 'connecting' | 'connected' | 'error';

  const suggestionChips = [
    "Crea un blog moderno con dark mode",
    "Landing page SaaS profesional",
    "Dashboard de analytics interactivo",
    "Portfolio minimalista con animaciones",
  ];

  const handleSuggestionClick = (suggestion: string) => {
    if (isStreamingOrLoading) return;
    if (!firstUserMessageRef.current) {
      firstUserMessageRef.current = suggestion;
    }
    if (useWebSocket && agentStatus === 'connected') {
      agentSend(suggestion);
    } else {
      sendHttp(suggestion);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navigation />
      
      {/* Clean Top Bar */}
      <div className="pt-16 px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Binario <span className="gradient-text">IDE</span></span>
          {project && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              · {project.name}
            </span>
          )}
          {isSaving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Save className="w-3 h-3 animate-pulse" /> Saving...
            </span>
          )}
          {useWebSocket && (
            <Badge variant="outline" className="text-xs border-primary/50 text-primary">
              <Wifi className="w-3 h-3 mr-1" />WS
            </Badge>
          )}
          <ConnectionStatus wsStatus={wsStatus} useWebSocket={useWebSocket} isApiKeyValid={isApiKeyValid} />
          {/* Neurons usage indicator */}
          {agentState.neuronsUsed > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/80 border border-border text-xs">
              <Brain className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">
                {Math.round(agentState.neuronsUsed).toLocaleString()}/{Math.round(agentState.neuronsLimit).toLocaleString()}
              </span>
              <Progress value={(agentState.neuronsUsed / agentState.neuronsLimit) * 100} className="w-12 h-1.5" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProjectManager
            projects={projects}
            currentProjectId={project?.id}
            onLoadProject={loadProject}
            onDeleteProject={deleteProject}
            onNewProject={() => {
              resetProject();
              setProject(null);
              agentClear();
              firstUserMessageRef.current = null;
            }}
            onProjectLoaded={(proj) => {
              loadFiles(proj.files || {});
            }}
          />
          <DeployDialog
            files={projectFiles}
            projectId={project?.id}
            projectName={project?.name}
            hasFiles={Object.keys(projectFiles).length > 0}
          />
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
                      <p className="text-sm font-medium">{useWebSocket ? 'WebSocket (Agents SDK)' : 'HTTP'}</p>
                      <p className="text-xs text-muted-foreground">{useWebSocket ? 'Real-time, reactive state' : 'Standard streaming'}</p>
                    </div>
                    <Switch checked={useWebSocket} onCheckedChange={setUseWebSocket} />
                  </div>
                  {useWebSocket && agentStatus !== 'connected' && (
                    <Button size="sm" variant="outline" onClick={manualReconnect} className="w-full text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" /> Reconnect
                    </Button>
                  )}
                </div>

                {/* Auto-Correct Toggle */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Error Correction
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-fix errors</p>
                      <p className="text-xs text-muted-foreground">AI automatically fixes preview errors (max 3 attempts)</p>
                    </div>
                    <Switch checked={autoCorrectEnabled} onCheckedChange={setAutoCorrectEnabled} />
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Model
                    {isLoadingProviders && <Loader2 className="w-3 h-3 animate-spin" />}
                    <Badge variant="secondary" className="text-[10px]">Cloudflare AI</Badge>
                  </h4>
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
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left: Chat Panel */}
          <ResizablePanel defaultSize={chatCollapsed ? 4 : 30} minSize={4} maxSize={50}>
            <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)' }}>
              {chatCollapsed ? (
                <div className="h-full flex flex-col items-center py-4 gap-3">
                  <button onClick={() => setChatCollapsed(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Expand chat">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </button>
                  {isStreamingOrLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {messages.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{messages.length}</Badge>
                  )}
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(175 80% 50%), hsl(262 80% 60%))' }}>
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Binario AI</h3>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {selectedModel.split('/').pop()}
                          </Badge>
                          {currentPhase !== 'idle' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/50 text-primary">
                              {currentPhase === 'planning' ? 'Planning...' : 'Generating...'}
                            </Badge>
                          )}
                          {isStreamingOrLoading && (
                            <span className="flex items-center gap-1 text-[10px] text-primary">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
                              generating
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearChat} disabled={messages.length === 0} title="Clear chat">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={copyConversation} disabled={messages.length === 0} title="Copy conversation">
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <button onClick={() => setChatCollapsed(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Collapse chat">
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && !streamingContent && !isThinking && (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-4 max-w-[280px]">
                          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center animate-float" style={{ background: 'linear-gradient(135deg, hsl(175 80% 50% / 0.15), hsl(262 80% 60% / 0.15))' }}>
                            <Sparkles className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">¿Qué quieres crear?</p>
                            <p className="text-xs text-muted-foreground mt-1">Describe tu proyecto y lo construiré</p>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {suggestionChips.map((chip, i) => (
                              <button
                                key={i}
                                onClick={() => handleSuggestionClick(chip)}
                                className="px-3 py-1.5 rounded-full text-xs border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {messages.map((message, i) => (
                      <div key={i} className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {message.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, hsl(175 80% 50% / 0.2), hsl(262 80% 60% / 0.2))', border: '1px solid hsl(175 80% 50% / 0.3)' }}>
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <div className={cn(
                          'max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-secondary/70 border border-border/30 rounded-bl-sm',
                        )}>
                          <ChatMessage content={message.content} role={message.role} />
                        </div>
                        {message.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    ))}

                    {isThinking && !streamingContent && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, hsl(175 80% 50% / 0.2), hsl(262 80% 60% / 0.2))' }}>
                          <Bot className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="rounded-xl px-4 py-3 bg-secondary/70 border border-border/30">
                          <div className="flex items-center gap-2">
                            <span className="flex gap-1">
                              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {streamingContent && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, hsl(175 80% 50% / 0.2), hsl(262 80% 60% / 0.2))' }}>
                          <Bot className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="max-w-[90%] rounded-xl px-4 py-3 bg-secondary/70 border border-border/30 rounded-bl-sm">
                          <ChatMessage content={streamingContent} role="assistant" />
                          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
                          
                          {tokensPerSecond && (
                            <div className="mt-2 text-[11px] text-muted-foreground/60 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {tokensPerSecond} tok/s
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Blueprint Card */}
                    {currentBlueprint && currentPhase === 'planning' && (
                      <div className="px-2">
                        <BlueprintCard
                          blueprint={currentBlueprint}
                          onApprove={handleBlueprintApprove}
                          onModify={handleBlueprintModify}
                        />
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-3 border-t border-border/50 bg-card/50">
                    <div className="relative">
                      <Textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe lo que quieres construir..."
                        className="min-h-[60px] max-h-[140px] resize-none text-sm pr-12 bg-secondary/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl"
                        disabled={isStreamingOrLoading}
                      />
                      <div className="absolute right-2 bottom-2">
                        {isStreamingOrLoading ? (
                          <Button onClick={handleStop} variant="destructive" size="sm" className="h-8 w-8 p-0 rounded-lg">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSend}
                            disabled={!input.trim() || !getEffectiveApiKey().trim()}
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg"
                            variant="hero"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-[11px] text-muted-foreground/60">
                        Cloudflare AI · {selectedModel.split('/').pop()}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40">
                        Enter ↵ enviar · Shift+Enter nueva línea
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: IDE (3-panel) */}
          <ResizablePanel defaultSize={chatCollapsed ? 96 : 70} minSize={40}>
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
                  onCodeChange={handleCodeChange}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              {/* Live Preview */}
              <ResizablePanel defaultSize={42} minSize={20}>
                <div className="h-full flex flex-col">
                  {/* Error correction banner */}
                  {previewErrors.length > 0 && !autoCorrectEnabled && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border-b border-destructive/20 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      <span className="flex-1 truncate text-destructive">{previewErrors[previewErrors.length - 1]?.message}</span>
                      {canAutoCorrect(errorCorrectionAttempts) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1 border-destructive/30"
                          onClick={() => {
                            const prompt = buildErrorCorrectionPrompt(previewErrors, projectFiles);
                            setErrorCorrectionAttempts(a => a + 1);
                            setPreviewErrors([]);
                            handleSendMessage(prompt);
                          }}
                        >
                          <Wrench className="w-3 h-3" /> Auto-fix ({3 - errorCorrectionAttempts} left)
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <CodePreview
                      files={projectFiles}
                      onErrors={handlePreviewErrors}
                      onImportProject={handleImportProject}
                      projectName={project?.name}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
