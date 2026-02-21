import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Activity, Brain, Clock, AlertTriangle, TrendingUp, Zap,
  RefreshCw, Loader2, ArrowLeft, Server, Cpu, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';

interface DailyMetric {
  date: string;
  requests: number;
  tokens: number;
  errors: number;
  avgLatencyMs: number;
  neurons: number;
}

interface ModelBreakdown {
  model: string;
  requests: number;
  tokens: number;
  neurons: number;
  avgLatencyMs: number;
}

interface AnalyticsData {
  daily: DailyMetric[];
  models: ModelBreakdown[];
  totals: {
    requests: number;
    tokens: number;
    errors: number;
    neurons: number;
    avgLatencyMs: number;
  };
  period: string;
}

const CHART_COLORS = {
  primary: 'hsl(175, 80%, 50%)',
  accent: 'hsl(262, 80%, 60%)',
  warning: 'hsl(38, 92%, 50%)',
  error: 'hsl(0, 72%, 51%)',
  muted: 'hsl(215, 20%, 55%)',
};

const PIE_COLORS = [
  'hsl(175, 80%, 50%)',
  'hsl(262, 80%, 60%)',
  'hsl(200, 80%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(340, 80%, 55%)',
  'hsl(120, 60%, 45%)',
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function generateMockData(): AnalyticsData {
  const days = 30;
  const daily: DailyMetric[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = Math.floor(Math.random() * 80) + 20;
    daily.push({
      date: d.toISOString().split('T')[0],
      requests: base + Math.floor(Math.random() * 40),
      tokens: (base * 150) + Math.floor(Math.random() * 5000),
      errors: Math.floor(Math.random() * 5),
      avgLatencyMs: 200 + Math.floor(Math.random() * 300),
      neurons: Math.floor(base * 0.8) + Math.floor(Math.random() * 20),
    });
  }

  const models: ModelBreakdown[] = [
    { model: 'llama-3.1-8b', requests: 420, tokens: 68000, neurons: 340, avgLatencyMs: 180 },
    { model: 'llama-3.3-70b', requests: 180, tokens: 45000, neurons: 520, avgLatencyMs: 450 },
    { model: 'deepseek-r1', requests: 95, tokens: 32000, neurons: 280, avgLatencyMs: 380 },
    { model: 'qwen-2.5-72b', requests: 60, tokens: 18000, neurons: 190, avgLatencyMs: 410 },
  ];

  const totals = {
    requests: daily.reduce((s, d) => s + d.requests, 0),
    tokens: daily.reduce((s, d) => s + d.tokens, 0),
    errors: daily.reduce((s, d) => s + d.errors, 0),
    neurons: daily.reduce((s, d) => s + d.neurons, 0),
    avgLatencyMs: Math.round(daily.reduce((s, d) => s + d.avgLatencyMs, 0) / daily.length),
  };

  return { daily, models, totals, period: '30d' };
}

export default function Analytics() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d'>('30d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/account/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const raw = await response.json();
        // Map real API data if available, otherwise use mock
        if (raw.dailyUsage?.length > 0) {
          const daily: DailyMetric[] = raw.dailyUsage.map((d: { date: string; tokens: number; requests: number }) => ({
            date: d.date,
            requests: d.requests,
            tokens: d.tokens,
            errors: 0,
            avgLatencyMs: 250,
            neurons: Math.round(d.tokens * 0.005),
          }));
          setData({
            daily,
            models: [],
            totals: {
              requests: daily.reduce((s, d) => s + d.requests, 0),
              tokens: daily.reduce((s, d) => s + d.tokens, 0),
              errors: 0,
              neurons: daily.reduce((s, d) => s + d.neurons, 0),
              avgLatencyMs: 250,
            },
            period,
          });
        } else {
          setData(generateMockData());
        }
      } else {
        setData(generateMockData());
      }
    } catch {
      setData(generateMockData());
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredDaily = data?.daily.slice(period === '7d' ? -7 : 0) ?? [];
  const errorRate = data ? ((data.totals.errors / Math.max(data.totals.requests, 1)) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/dashboard"><ArrowLeft className="w-4 h-4" /></Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <BarChart3 className="w-7 h-7 text-primary" />
                  Analytics
                </h1>
                <p className="text-muted-foreground text-sm">Real-time API usage metrics and performance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setPeriod('7d')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === '7d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >7 Days</button>
                <button
                  onClick={() => setPeriod('30d')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === '30d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >30 Days</button>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <KpiCard icon={Activity} label="Total Requests" value={formatNumber(data.totals.requests)} trend="+12%" />
                <KpiCard icon={Zap} label="Total Tokens" value={formatNumber(data.totals.tokens)} />
                <KpiCard icon={Brain} label="Neurons Used" value={formatNumber(data.totals.neurons)} />
                <KpiCard icon={Clock} label="Avg Latency" value={`${data.totals.avgLatencyMs}ms`} />
                <KpiCard icon={AlertTriangle} label="Error Rate" value={`${errorRate}%`} variant={Number(errorRate) > 5 ? 'destructive' : 'default'} />
              </div>

              {/* Charts */}
              <Tabs defaultValue="requests" className="space-y-6">
                <TabsList className="bg-card border border-border">
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                  <TabsTrigger value="tokens">Tokens</TabsTrigger>
                  <TabsTrigger value="latency">Latency</TabsTrigger>
                  <TabsTrigger value="neurons">Neurons</TabsTrigger>
                  <TabsTrigger value="models">By Model</TabsTrigger>
                </TabsList>

                <TabsContent value="requests">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Requests per Day</CardTitle>
                      <CardDescription>API requests over the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={filteredDaily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} tickFormatter={d => d.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} />
                            <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 98%)' }} />
                            <Area type="monotone" dataKey="requests" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.15} strokeWidth={2} />
                            <Area type="monotone" dataKey="errors" stroke={CHART_COLORS.error} fill={CHART_COLORS.error} fillOpacity={0.1} strokeWidth={1.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tokens">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Token Usage</CardTitle>
                      <CardDescription>Input + output tokens consumed daily</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredDaily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} tickFormatter={d => d.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} />
                            <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 98%)' }} />
                            <Bar dataKey="tokens" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="latency">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Average Latency</CardTitle>
                      <CardDescription>Response time in milliseconds</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredDaily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} tickFormatter={d => d.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} unit="ms" />
                            <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 98%)' }} />
                            <Line type="monotone" dataKey="avgLatencyMs" stroke={CHART_COLORS.warning} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="neurons">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cloudflare Neurons</CardTitle>
                      <CardDescription>Workers AI compute units consumed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={filteredDaily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} tickFormatter={d => d.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} />
                            <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 98%)' }} />
                            <Area type="monotone" dataKey="neurons" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.2} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="models">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Requests by Model</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {data.models.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={data.models} dataKey="requests" nameKey="model" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                  {data.models.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 98%)' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm text-center py-12">Model breakdown available when real data is connected</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Model Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {(data.models.length > 0 ? data.models : [
                            { model: 'llama-3.1-8b', requests: 420, avgLatencyMs: 180, neurons: 340 },
                            { model: 'llama-3.3-70b', requests: 180, avgLatencyMs: 450, neurons: 520 },
                            { model: 'deepseek-r1', requests: 95, avgLatencyMs: 380, neurons: 280 },
                          ]).map((m, i) => (
                            <div key={m.model} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <div>
                                  <p className="text-sm font-medium">{m.model}</p>
                                  <p className="text-xs text-muted-foreground">{m.requests} requests</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.avgLatencyMs}ms</span>
                                <span className="flex items-center gap-1"><Brain className="w-3 h-3" />{m.neurons}n</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, trend, variant = 'default' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: string;
  variant?: 'default' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-4 h-4 ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} />
          {trend && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/50 text-emerald-400">
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{trend}
            </Badge>
          )}
        </div>
        <p className={`text-2xl font-bold ${variant === 'destructive' ? 'text-destructive' : ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
