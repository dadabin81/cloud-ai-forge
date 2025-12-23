import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Key, 
  BarChart3, 
  Copy, 
  Check, 
  Plus, 
  Trash2,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// Mock data for demo
const mockApiKeys = [
  { id: '1', name: 'Production', prefix: 'bsk_live_abc...', createdAt: '2024-01-15', lastUsed: '2024-01-20' },
  { id: '2', name: 'Development', prefix: 'bsk_test_xyz...', createdAt: '2024-01-10', lastUsed: '2024-01-19' },
];

const mockUsage = {
  requestsUsed: 847,
  requestsLimit: 1000,
  tokensUsed: 125430,
  plan: 'free' as const,
  resetAt: '2024-02-01',
};

const mockDailyUsage = [
  { date: '2024-01-14', requests: 120, tokens: 18500 },
  { date: '2024-01-15', requests: 95, tokens: 14200 },
  { date: '2024-01-16', requests: 180, tokens: 27300 },
  { date: '2024-01-17', requests: 145, tokens: 21800 },
  { date: '2024-01-18', requests: 167, tokens: 25100 },
  { date: '2024-01-19', requests: 89, tokens: 13400 },
  { date: '2024-01-20', requests: 51, tokens: 7630 },
];

export default function Dashboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const usagePercentage = (mockUsage.requestsUsed / mockUsage.requestsLimit) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your API keys and monitor usage
            </p>
          </div>

          {/* Usage Overview Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Requests This Month</CardDescription>
                <CardTitle className="text-3xl">
                  {mockUsage.requestsUsed.toLocaleString()}
                  <span className="text-lg text-muted-foreground font-normal">
                    /{mockUsage.requestsLimit.toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Resets {new Date(mockUsage.resetAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tokens Used</CardDescription>
                <CardTitle className="text-3xl">
                  {(mockUsage.tokensUsed / 1000).toFixed(1)}K
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Across all API requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Plan</CardDescription>
                <CardTitle className="text-3xl capitalize">
                  {mockUsage.plan}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <a href="/pricing">Upgrade Plan</a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="keys" className="space-y-6">
            <TabsList>
              <TabsTrigger value="keys" className="gap-2">
                <Key className="w-4 h-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Usage
              </TabsTrigger>
            </TabsList>

            {/* API Keys Tab */}
            <TabsContent value="keys">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage your API keys for accessing Binario
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => {
                      setIsCreatingKey(true);
                      setTimeout(() => {
                        toast.success('New API key created!');
                        setIsCreatingKey(false);
                      }, 1000);
                    }}
                    disabled={isCreatingKey}
                  >
                    {isCreatingKey ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create New Key
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockApiKeys.map((key) => (
                      <div 
                        key={key.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{key.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                              {showKey === key.id ? 'bsk_live_abcdefgh1234567890' : key.prefix}
                            </code>
                            <button
                              onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showKey === key.id ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Created {key.createdAt} • Last used {key.lastUsed}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard('bsk_live_abcdefgh1234567890', key.id)}
                          >
                            {copied === key.id ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => toast.success('API key revoked')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <p className="text-sm text-amber-400">
                      <strong>Security tip:</strong> Never share your API keys or commit them to version control. 
                      Use environment variables instead.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage">
              <Card>
                <CardHeader>
                  <CardTitle>Usage History</CardTitle>
                  <CardDescription>
                    Your API usage over the last 7 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Simple bar chart */}
                    <div className="flex items-end gap-2 h-40">
                      {mockDailyUsage.map((day, i) => {
                        const maxRequests = Math.max(...mockDailyUsage.map(d => d.requests));
                        const height = (day.requests / maxRequests) * 100;
                        return (
                          <div 
                            key={i} 
                            className="flex-1 flex flex-col items-center gap-2"
                          >
                            <div 
                              className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                              style={{ height: `${height}%` }}
                              title={`${day.requests} requests`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Usage table */}
                    <div className="mt-8">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-right py-2 text-sm font-medium text-muted-foreground">Requests</th>
                            <th className="text-right py-2 text-sm font-medium text-muted-foreground">Tokens</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockDailyUsage.map((day, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-3 text-sm">{day.date}</td>
                              <td className="py-3 text-sm text-right">{day.requests.toLocaleString()}</td>
                              <td className="py-3 text-sm text-right">{day.tokens.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
