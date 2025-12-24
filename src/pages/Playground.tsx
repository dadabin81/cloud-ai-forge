import { useState, useRef, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const API_BASE_URL = 'https://binario-api.databin81.workers.dev';

const providers = [
  { id: 'cloudflare', name: 'Cloudflare Workers AI', free: true },
  { id: 'lovable', name: 'Lovable AI', free: false },
  { id: 'openai', name: 'OpenAI', free: false },
  { id: 'anthropic', name: 'Anthropic', free: false },
  { id: 'google', name: 'Google', free: false },
];

const models: Record<string, { id: string; name: string }[]> = {
  cloudflare: [
    { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B (Default)' },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (Fast)' },
    { id: '@cf/meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision' },
    { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B' },
  ],
  lovable: [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
};

export default function Playground() {
  const { token, isAuthenticated } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState('cloudflare');
  const [selectedModel, setSelectedModel] = useState('@cf/meta/llama-3.1-8b-instruct');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  
  // API Key state - auto-fill from auth if logged in
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-fill API key when user is authenticated
  useEffect(() => {
    if (isAuthenticated && token && !apiKey) {
      setApiKey(token);
      setIsApiKeyValid(true);
    }
  }, [isAuthenticated, token, apiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Update model when provider changes
  useEffect(() => {
    const providerModels = models[selectedProvider];
    if (providerModels?.length) {
      setSelectedModel(providerModels[0].id);
    }
  }, [selectedProvider]);

  // Validate API key when it changes
  useEffect(() => {
    if (!apiKey.trim()) {
      setIsApiKeyValid(null);
      return;
    }

    const validateKey = async () => {
      setIsValidating(true);
      try {
        const response = await fetch(`${API_BASE_URL}/v1/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        setIsApiKeyValid(response.ok);
      } catch {
        setIsApiKeyValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    const debounce = setTimeout(validateKey, 500);
    return () => clearTimeout(debounce);
  }, [apiKey]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!apiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const allMessages: Message[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages,
      userMessage,
    ];

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          model: selectedModel,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Invalid API key');
          setIsApiKeyValid(false);
          return;
        }
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please wait and try again.');
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let fullContent = '';

      // Check if response is streaming (text/event-stream) or regular JSON
      if (contentType.includes('text/event-stream')) {
        // Handle streaming response
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
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullContent += content;
                    setStreamingContent(fullContent);
                  }
                } catch {
                  // Ignore parse errors for partial chunks
                }
              }
            }
          }
        }
      } else {
        // Handle regular JSON response
        const data = await response.json();
        fullContent = data.choices?.[0]?.message?.content || '';
        setStreamingContent(fullContent);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
        if (streamingContent) {
          setMessages(prev => [...prev, { role: 'assistant', content: streamingContent }]);
        }
      } else {
        console.error('Chat error:', error);
        toast.error('Failed to get response');
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
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
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  const codeSnippet = `import { createBinario, useBinarioStream } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: 'your-api-key', // Get from dashboard
});

// Simple chat
const response = await ai.chat([
  { role: 'user', content: 'Hello!' }
], { model: '${selectedModel}' });

// With streaming
const { messages, send, isStreaming } = useBinarioStream(ai, {
  model: '${selectedModel}',
});`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Interactive Demo</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              Binario <span className="gradient-text">Playground</span>
            </h1>
            <p className="text-muted-foreground">
              Test the Binario API with real AI responses. Enter your API key to get started.
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
                    {messages.length === 0 && !streamingContent && (
                      <div className="h-full flex items-center justify-center text-center">
                        <div className="space-y-2">
                          <Bot className="w-12 h-12 mx-auto text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            Start a conversation with Binario AI
                          </p>
                          <p className="text-sm text-muted-foreground/70">
                            Enter your API key and send a message
                          </p>
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
                        disabled={isLoading}
                      />
                      {isLoading ? (
                        <Button onClick={handleStop} variant="destructive" className="h-auto">
                          Stop
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSend}
                          disabled={!input.trim() || !apiKey.trim()}
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
                    This is the code to replicate this chat configuration in your app.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Config Panel */}
            <div className="space-y-6">
              {/* API Key Input */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Key
                </h3>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="bnr_live_..."
                      className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {!isValidating && isApiKeyValid === true && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {!isValidating && isApiKeyValid === false && <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from the Dashboard
                  </p>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Configuration
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
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Model</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models[selectedProvider]?.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
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
                    <span className="font-medium">{selectedProviderData?.name}</span>
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
                    <Badge variant="outline" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Streaming
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                <p className="text-sm text-primary/90">
                  <strong>Live API:</strong> Connected to Binario at {API_BASE_URL.replace('https://', '')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
