import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createCloudflareApi, type HealthStatus, type RAGSearchResult, type ModelInfo, type WorkflowInstance } from '@/lib/cloudflareApi';
import {
  Brain, Search, Workflow, Server, Activity, Loader2,
  Upload, MessageSquare, Play, Eye, CheckCircle, XCircle,
  Database, HardDrive, Sparkles, FileCode, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CloudPanelProps {
  apiKey: string;
  activeTab?: string;
  onModelSelect?: (model: string) => void;
}

export function CloudPanel({ apiKey, activeTab = 'models', onModelSelect }: CloudPanelProps) {
  const [tab, setTab] = useState(activeTab);
  const api = createCloudflareApi(apiKey);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Binario <span className="gradient-text">Cloud</span></span>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-2 mt-2 h-8 bg-secondary/50">
          <TabsTrigger value="models" className="text-xs h-6 gap-1"><Brain className="w-3 h-3" /> AI</TabsTrigger>
          <TabsTrigger value="rag" className="text-xs h-6 gap-1"><Search className="w-3 h-3" /> RAG</TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs h-6 gap-1"><Workflow className="w-3 h-3" /> Flow</TabsTrigger>
          <TabsTrigger value="sandbox" className="text-xs h-6 gap-1"><Server className="w-3 h-3" /> Sandbox</TabsTrigger>
          <TabsTrigger value="status" className="text-xs h-6 gap-1"><Activity className="w-3 h-3" /> Status</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-3">
          <TabsContent value="models" className="mt-0"><ModelsTab api={api} onModelSelect={onModelSelect} /></TabsContent>
          <TabsContent value="rag" className="mt-0"><RAGTab api={api} /></TabsContent>
          <TabsContent value="workflows" className="mt-0"><WorkflowsTab api={api} /></TabsContent>
          <TabsContent value="sandbox" className="mt-0"><SandboxTab api={api} /></TabsContent>
          <TabsContent value="status" className="mt-0"><StatusTab api={api} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Models Tab ──────────────────────────────────────────
function ModelsTab({ api, onModelSelect }: { api: ReturnType<typeof createCloudflareApi>; onModelSelect?: (m: string) => void }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsData, usageData] = await Promise.all([api.getModels(), api.getUsage()]);
      setModels(modelsData.models || []);
      setUsage(usageData.neurons);
    } catch (e) { toast.error('Failed to load models'); }
    finally { setLoading(false); }
  }, [api]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Workers AI Models</h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={fetchModels} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>

      {usage && (
        <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Neurons Used</span>
            <span className="font-mono">{usage.used.toLocaleString()} / {usage.limit.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {models.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-4">Click refresh to load models</p>
      )}

      <div className="space-y-1.5">
        {models.map(model => (
          <button
            key={model.id}
            onClick={() => onModelSelect?.(model.id)}
            className="w-full text-left rounded-lg border border-border p-2.5 hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium truncate">{model.name || model.id.split('/').pop()}</span>
              <Badge variant={model.tier === 'free' ? 'secondary' : 'default'} className={cn(
                'text-[10px]',
                model.tier === 'free' && 'bg-emerald-500/10 text-emerald-400',
                model.tier === 'pro' && 'bg-primary/10 text-primary',
              )}>
                {model.tier}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">{model.id}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── RAG Tab ──────────────────────────────────────────────
function RAGTab({ api }: { api: ReturnType<typeof createCloudflareApi> }) {
  const [mode, setMode] = useState<'ingest' | 'search' | 'query'>('query');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RAGSearchResult[]>([]);
  const [answer, setAnswer] = useState('');

  const handleIngest = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await api.ragIngest(content);
      toast.success(`Ingested! ${res.chunks} chunks created`);
      setContent('');
    } catch (e) { toast.error(`Ingest failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.ragSearch(query);
      setResults(res.results || []);
      setAnswer('');
    } catch (e) { toast.error(`Search failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.ragQuery(query);
      setAnswer(res.answer);
      setResults(res.sources || []);
    } catch (e) { toast.error(`Query failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Search className="w-4 h-4 text-primary" /> Vectorize RAG
        </h3>
      </div>

      <div className="flex gap-1">
        {(['query', 'search', 'ingest'] as const).map(m => (
          <Button key={m} variant={mode === m ? 'default' : 'ghost'} size="sm" className="h-7 text-xs flex-1" onClick={() => setMode(m)}>
            {m === 'ingest' && <Upload className="w-3 h-3 mr-1" />}
            {m === 'search' && <Search className="w-3 h-3 mr-1" />}
            {m === 'query' && <MessageSquare className="w-3 h-3 mr-1" />}
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </div>

      {mode === 'ingest' ? (
        <div className="space-y-2">
          <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste document text to ingest..." className="min-h-[120px] text-xs" />
          <Button onClick={handleIngest} disabled={loading || !content.trim()} className="w-full" size="sm">
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
            Ingest Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={mode === 'query' ? 'Ask a question...' : 'Search documents...'} className="text-xs"
              onKeyDown={e => { if (e.key === 'Enter') mode === 'query' ? handleQuery() : handleSearch(); }}
            />
            <Button onClick={mode === 'query' ? handleQuery : handleSearch} disabled={loading || !query.trim()} size="sm">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      )}

      {answer && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs font-semibold text-primary mb-1">AI Answer</p>
          <p className="text-xs whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} sources found</p>
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-2.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-muted-foreground">Source {i + 1}</span>
                <Badge variant="outline" className="text-[10px] h-4">{(r.score * 100).toFixed(0)}% match</Badge>
              </div>
              <p className="text-xs line-clamp-3">{r.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        Powered by <span className="text-primary">Vectorize</span> + <span className="text-primary">Workers AI</span>
      </div>
    </div>
  );
}

// ─── Workflows Tab ──────────────────────────────────────────
function WorkflowsTab({ api }: { api: ReturnType<typeof createCloudflareApi> }) {
  const [topic, setTopic] = useState('');
  const [ragUrl, setRagUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowInstance | null>(null);
  const [polling, setPolling] = useState(false);

  const startResearch = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await api.workflowResearch(topic);
      toast.success('Research workflow started!');
      pollStatus(res.instanceId);
    } catch (e) { toast.error(`Failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  const startRAGIngest = async () => {
    if (!ragUrl.trim()) return;
    setLoading(true);
    try {
      const res = await api.workflowRAGIngest(ragUrl);
      toast.success('RAG ingest workflow started!');
      pollStatus(res.instanceId);
    } catch (e) { toast.error(`Failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  const pollStatus = async (instanceId: string) => {
    setPolling(true);
    const poll = async () => {
      try {
        const status = await api.workflowStatus(instanceId);
        setActiveWorkflow(status);
        if (status.status === 'running' || status.status === 'queued') {
          setTimeout(poll, 2000);
        } else {
          setPolling(false);
          if (status.status === 'complete') toast.success('Workflow complete!');
          else if (status.status === 'errored') toast.error('Workflow failed');
        }
      } catch { setPolling(false); }
    };
    poll();
  };

  const statusColor = (s: string) => {
    if (s === 'complete') return 'text-emerald-400';
    if (s === 'running') return 'text-primary';
    if (s === 'errored') return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Workflow className="w-4 h-4 text-primary" /> Durable Workflows
      </h3>

      {/* Research Workflow */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Research Workflow</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Multi-step AI research: analyze → search → synthesize → report</p>
        <div className="flex gap-2">
          <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Research topic..." className="text-xs" />
          <Button onClick={startResearch} disabled={loading || !topic.trim()} size="sm">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* RAG Ingest Workflow */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">RAG Ingest Workflow</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Fetch URL → extract → chunk → embed → index</p>
        <div className="flex gap-2">
          <Input value={ragUrl} onChange={e => setRagUrl(e.target.value)} placeholder="https://example.com/article" className="text-xs" />
          <Button onClick={startRAGIngest} disabled={loading || !ragUrl.trim()} size="sm">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Active Workflow Status */}
      {activeWorkflow && (
        <div className="rounded-lg bg-secondary/50 border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Workflow Status</span>
            <Badge variant="outline" className={cn('text-[10px]', statusColor(activeWorkflow.status))}>
              {polling && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
              {activeWorkflow.status}
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">ID: {activeWorkflow.id.slice(0, 12)}...</p>

          {activeWorkflow.steps?.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {step.status === 'complete' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
              {step.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              {step.status === 'pending' && <div className="w-3 h-3 rounded-full border border-muted-foreground/40" />}
              {step.status === 'errored' && <XCircle className="w-3 h-3 text-destructive" />}
              <span className={step.status === 'complete' ? 'text-muted-foreground' : ''}>{step.name}</span>
            </div>
          ))}

          {activeWorkflow.status === 'complete' && activeWorkflow.output && (
            <div className="mt-2 rounded bg-card p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
              {typeof activeWorkflow.output === 'string' ? activeWorkflow.output : JSON.stringify(activeWorkflow.output, null, 2)}
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        Powered by <span className="text-primary">Cloudflare Workflows</span>
      </div>
    </div>
  );
}

// ─── Sandbox Tab ──────────────────────────────────────────
function SandboxTab({ api }: { api: ReturnType<typeof createCloudflareApi> }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('react-vite');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; template: string }>>([]);

  const createProject = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.projectCreate(name, template);
      toast.success(`Project "${name}" created!`);
      setName('');
      loadProjects();
    } catch (e) { toast.error(`Failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  };

  const loadProjects = async () => {
    try {
      const res = await api.projectList();
      setProjects(res.projects || []);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Server className="w-4 h-4 text-primary" /> Sandbox Projects
      </h3>
      <p className="text-[10px] text-muted-foreground">Create and manage projects via Durable Objects</p>

      <div className="space-y-2">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Project name..." className="text-xs" />
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger className="text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="react-vite">React + Vite</SelectItem>
            <SelectItem value="vanilla-js">Vanilla JS</SelectItem>
            <SelectItem value="node-express">Node + Express</SelectItem>
            <SelectItem value="python-flask">Python + Flask</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={createProject} disabled={loading || !name.trim()} className="w-full" size="sm">
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileCode className="w-3 h-3 mr-1" />}
          Create Project
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Your Projects</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={loadProjects}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No projects yet. Create one above!</p>
      ) : (
        <div className="space-y-1.5">
          {projects.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-2">
              <div>
                <p className="text-xs font-medium">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.template}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs"><Eye className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        Powered by <span className="text-primary">Durable Objects</span>
      </div>
    </div>
  );
}

// ─── Status Tab ──────────────────────────────────────────
function StatusTab({ api }: { api: ReturnType<typeof createCloudflareApi> }) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await api.healthCheck();
      setHealth(data);
    } catch (e) { toast.error('Health check failed'); }
    finally { setLoading(false); }
  };

  const bindings = [
    { key: 'ai', label: 'Workers AI', icon: Brain, desc: 'Inference API (Llama 3, Mistral, etc.)' },
    { key: 'd1', label: 'D1 Database', icon: Database, desc: 'SQLite database (binario-db)' },
    { key: 'kv', label: 'KV Namespace', icon: HardDrive, desc: 'Key-value storage' },
    { key: 'vectorize', label: 'Vectorize', icon: Search, desc: 'Vector embeddings (binario-embeddings)' },
    { key: 'workflows', label: 'Workflows', icon: Workflow, desc: 'Durable multi-step workflows' },
    { key: 'durableObjects', label: 'Durable Objects', icon: Server, desc: 'BinarioAgent + SandboxProject' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" /> Infrastructure Status
        </h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={fetchHealth} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>

      {!health && !loading && (
        <p className="text-xs text-muted-foreground text-center py-4">Click refresh to check status</p>
      )}

      <div className="space-y-1.5">
        {bindings.map(b => {
          const isActive = health?.bindings?.[b.key as keyof HealthStatus['bindings']] ?? false;
          const Icon = b.icon;
          return (
            <div key={b.key} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isActive ? 'bg-emerald-500/10' : 'bg-muted'
              )}>
                <Icon className={cn('w-4 h-4', isActive ? 'text-emerald-400' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{b.label}</span>
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    isActive ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                  )} />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{b.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {health && (
        <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Environment</span>
            <span className="font-mono">production</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono">{health.version || '0.2.0'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Last Check</span>
            <span className="font-mono">{new Date(health.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        All services on <span className="text-primary">Cloudflare Edge</span> · Zero cold start
      </div>
    </div>
  );
}
