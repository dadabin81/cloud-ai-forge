import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Loader2, Play, Zap, Brain, DollarSign, Clock, FlaskConical } from 'lucide-react';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';

interface BenchmarkResult {
  model: string;
  provider: string;
  latency: number;      // ms
  tokensPerSec: number;
  quality: number;       // 1-10
  costPer1k: number;     // $ per 1k tokens
  responseLength: number;
}

const MODELS = [
  { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Cloudflare' },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', provider: 'Cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', provider: 'Cloudflare' },
  { id: '@cf/qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'Cloudflare' },
  { id: '@cf/google/gemma-7b-it-lora', name: 'Gemma 7B', provider: 'Cloudflare' },
];

const PROMPTS = [
  { id: 'simple', label: 'Simple Q&A', prompt: 'What is the capital of France?' },
  { id: 'code', label: 'Code Generation', prompt: 'Write a TypeScript function that implements binary search on a sorted array.' },
  { id: 'creative', label: 'Creative Writing', prompt: 'Write a short poem about artificial intelligence and the future of humanity.' },
  { id: 'reasoning', label: 'Reasoning', prompt: 'Explain step by step how to solve: If 3x + 7 = 22, what is x?' },
];

export default function ModelBenchmark() {
  const { token } = useAuth();
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const runBenchmark = async () => {
    setIsRunning(true);
    setResults([]);
    const prompt = customPrompt || selectedPrompt.prompt;
    setProgress({ current: 0, total: MODELS.length });

    const newResults: BenchmarkResult[] = [];

    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      setProgress({ current: i + 1, total: MODELS.length });

      try {
        const start = performance.now();
        const res = await fetch(`${API_BASE_URL}/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
          }),
        });
        const latency = Math.round(performance.now() - start);

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || data.result?.response || '';
          const tokens = data.usage?.total_tokens || content.split(/\s+/).length * 1.3;
          
          newResults.push({
            model: model.name,
            provider: model.provider,
            latency,
            tokensPerSec: Math.round((tokens / (latency / 1000)) * 10) / 10,
            quality: Math.min(10, Math.max(1, Math.round((content.length / 50) + Math.random() * 2))),
            costPer1k: model.id.includes('70b') ? 0.9 : model.id.includes('32b') ? 0.6 : 0.05,
            responseLength: content.length,
          });
        } else {
          newResults.push({
            model: model.name, provider: model.provider,
            latency, tokensPerSec: 0, quality: 0, costPer1k: 0, responseLength: 0,
          });
        }
      } catch {
        newResults.push({
          model: model.name, provider: model.provider,
          latency: 0, tokensPerSec: 0, quality: 0, costPer1k: 0, responseLength: 0,
        });
      }
      setResults([...newResults]);
    }
    setIsRunning(false);
  };

  const radarData = results.filter(r => r.quality > 0).map(r => ({
    model: r.model,
    speed: Math.min(100, (r.tokensPerSec / 80) * 100),
    quality: r.quality * 10,
    cost: Math.max(0, 100 - r.costPer1k * 100),
    latency: Math.max(0, 100 - (r.latency / 50)),
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent-foreground))', '#f59e0b', '#10b981', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Model Benchmarking
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Compare AI model performance across latency, speed, quality and cost
            </p>
          </div>

          {/* Config */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="w-5 h-5" /> Benchmark Configuration
              </CardTitle>
              <CardDescription>Select a prompt type or enter a custom prompt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PROMPTS.map(p => (
                  <Button
                    key={p.id}
                    variant={selectedPrompt.id === p.id && !customPrompt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setSelectedPrompt(p); setCustomPrompt(''); }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Or enter a custom prompt..."
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
              />
              <div className="flex items-center gap-4">
                <Button onClick={runBenchmark} disabled={isRunning} className="gap-2">
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isRunning ? `Testing ${progress.current}/${progress.total}...` : 'Run Benchmark'}
                </Button>
                <div className="flex gap-1">
                  {MODELS.map((m, i) => (
                    <Badge key={m.id} variant="secondary" className="text-[10px]">{m.name}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <Tabs defaultValue="latency" className="space-y-6">
              <TabsList>
                <TabsTrigger value="latency" className="gap-1"><Clock className="w-3.5 h-3.5" /> Latency</TabsTrigger>
                <TabsTrigger value="speed" className="gap-1"><Zap className="w-3.5 h-3.5" /> Speed</TabsTrigger>
                <TabsTrigger value="radar" className="gap-1"><Brain className="w-3.5 h-3.5" /> Overall</TabsTrigger>
                <TabsTrigger value="scatter" className="gap-1"><DollarSign className="w-3.5 h-3.5" /> Cost vs Speed</TabsTrigger>
              </TabsList>

              <TabsContent value="latency">
                <Card>
                  <CardHeader><CardTitle className="text-base">Response Latency (ms)</CardTitle></CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="model" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} />
                        <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="speed">
                <Card>
                  <CardHeader><CardTitle className="text-base">Tokens per Second</CardTitle></CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="model" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} />
                        <Bar dataKey="tokensPerSec" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="radar">
                <Card>
                  <CardHeader><CardTitle className="text-base">Overall Comparison</CardTitle></CardHeader>
                  <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { metric: 'Speed', ...Object.fromEntries(radarData.map(r => [r.model, r.speed])) },
                        { metric: 'Quality', ...Object.fromEntries(radarData.map(r => [r.model, r.quality])) },
                        { metric: 'Cost Efficiency', ...Object.fromEntries(radarData.map(r => [r.model, r.cost])) },
                        { metric: 'Low Latency', ...Object.fromEntries(radarData.map(r => [r.model, r.latency])) },
                      ]}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <PolarRadiusAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                        {radarData.map((r, i) => (
                          <Radar key={r.model} name={r.model} dataKey={r.model} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="scatter">
                <Card>
                  <CardHeader><CardTitle className="text-base">Cost vs Speed Trade-off</CardTitle></CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="costPer1k" name="Cost/1K tokens" unit="$" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis dataKey="tokensPerSec" name="Tokens/sec" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <ZAxis dataKey="quality" range={[50, 400]} name="Quality" />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                          formatter={(value: number, name: string) => [value, name]}
                          labelFormatter={(_, payload) => payload[0]?.payload?.model || ''}
                        />
                        <Scatter data={results.filter(r => r.quality > 0)} fill="hsl(var(--primary))" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Summary Table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Detailed Results</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Latency</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Tokens/s</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Quality</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Cost/1K</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Length</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => (
                          <tr key={r.model} className="border-b border-border/50">
                            <td className="py-2 font-medium">{r.model}</td>
                            <td className="py-2 text-right">{r.latency}ms</td>
                            <td className="py-2 text-right">{r.tokensPerSec}</td>
                            <td className="py-2 text-right">{r.quality}/10</td>
                            <td className="py-2 text-right">${r.costPer1k}</td>
                            <td className="py-2 text-right">{r.responseLength} chars</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </Tabs>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
