import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  BarChart3, 
  Copy, 
  Check, 
  Plus, 
  Trash2,
  Loader2,
  Rocket,
  Play,
  BookOpen,
  ArrowRight,
  Zap,
  Code,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Usage {
  tokensUsed: number;
  requestsUsed: number;
}

interface DailyUsage {
  date: string;
  tokens: number;
  requests: number;
}

interface UsageData {
  plan: 'free' | 'pro' | 'enterprise';
  usage: Usage;
  limits: {
    tokensPerDay: number;
    requestsPerDay: number;
  };
  dailyUsage: DailyUsage[];
  resetAt: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  
  // Usage state
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Quick start state
  const [quickStartCompleted, setQuickStartCompleted] = useState(() => {
    return localStorage.getItem('binario_quickstart_completed') === 'true';
  });

  // Fetch API keys
  useEffect(() => {
    fetchApiKeys();
    fetchUsage();
  }, [token]);

  const fetchApiKeys = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/v1/keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const fetchUsage = async () => {
    if (!token) return;
    
    // For usage, we need an API key. For now, we'll use mock data
    // since /v1/usage requires an API key, not a session token
    setUsageData({
      plan: user?.plan || 'free',
      usage: { tokensUsed: 0, requestsUsed: 0 },
      limits: { tokensPerDay: 50000, requestsPerDay: 100 },
      dailyUsage: [],
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setIsLoadingUsage(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateKey = async () => {
    if (!token) return;
    
    setIsCreatingKey(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/v1/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName || 'API Key' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewlyCreatedKey(data.key);
        setApiKeys(prev => [{
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          createdAt: data.createdAt,
          lastUsedAt: null,
        }, ...prev]);
        setNewKeyName('');
        toast.success('API key created!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/v1/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
        toast.success('API key revoked');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to revoke API key');
      }
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const dismissQuickStart = () => {
    setQuickStartCompleted(true);
    localStorage.setItem('binario_quickstart_completed', 'true');
  };

  const usagePercentage = usageData 
    ? (usageData.usage.requestsUsed / usageData.limits.requestsPerDay) * 100 
    : 0;

  const quickCode = `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: '${apiKeys[0]?.prefix || 'YOUR_API_KEY'}...',
});

const response = await ai.chat([
  { role: 'user', content: 'Hello!' }
]);`;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {user?.email}
              </p>
            </div>
            <Badge variant="outline" className="text-sm capitalize">
              {user?.plan || 'free'} Plan
            </Badge>
          </div>

          {/* Quick Start Card - Only show if not completed and has API keys */}
          {!quickStartCompleted && apiKeys.length > 0 && (
            <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Quick Start</CardTitle>
                      <CardDescription>Get started with Binario in seconds</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={dismissQuickStart}>
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Code Example */}
                  <div className="relative">
                    <pre className="p-4 bg-[#1a1a2e] rounded-lg font-mono text-xs overflow-x-auto text-gray-300">
                      {quickCode}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => copyToClipboard(quickCode, 'quick-code')}
                    >
                      {copied === 'quick-code' ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Next Steps:</h4>
                    <div className="grid gap-2">
                      <Button variant="outline" className="justify-start h-auto py-3" asChild>
                        <Link to="/playground">
                          <Play className="w-4 h-4 mr-3 text-primary" />
                          <div className="text-left">
                            <div className="font-medium">Try the Playground</div>
                            <div className="text-xs text-muted-foreground">Test API with your key</div>
                          </div>
                        </Link>
                      </Button>
                      <Button variant="outline" className="justify-start h-auto py-3" asChild>
                        <Link to="/docs">
                          <BookOpen className="w-4 h-4 mr-3 text-primary" />
                          <div className="text-left">
                            <div className="font-medium">Read Documentation</div>
                            <div className="text-xs text-muted-foreground">Learn all features</div>
                          </div>
                        </Link>
                      </Button>
                      <Button variant="outline" className="justify-start h-auto py-3" asChild>
                        <Link to="/use-cases">
                          <Code className="w-4 h-4 mr-3 text-primary" />
                          <div className="text-left">
                            <div className="font-medium">Explore Use Cases</div>
                            <div className="text-xs text-muted-foreground">See real-world examples</div>
                          </div>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Overview Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Requests Today</CardDescription>
                <CardTitle className="text-3xl">
                  {isLoadingUsage ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {usageData?.usage.requestsUsed.toLocaleString() || 0}
                      <span className="text-lg text-muted-foreground font-normal">
                        /{usageData?.limits.requestsPerDay.toLocaleString() || 100}
                      </span>
                    </>
                  )}
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
                  Resets {usageData?.resetAt ? new Date(usageData.resetAt).toLocaleDateString() : 'tomorrow'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tokens Used</CardDescription>
                <CardTitle className="text-3xl">
                  {isLoadingUsage ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    `${((usageData?.usage.tokensUsed || 0) / 1000).toFixed(1)}K`
                  )}
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
                <CardDescription>API Keys</CardDescription>
                <CardTitle className="text-3xl">
                  {isLoadingKeys ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    apiKeys.length
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Key
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
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Key
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingKeys ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-8">
                      <Key className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground mb-4">No API keys yet. Create one to get started.</p>
                      <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Key
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiKeys.map((key) => (
                        <div 
                          key={key.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{key.name}</span>
                              <Badge variant="secondary" className="text-xs">Active</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                                {key.prefix}...
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => navigate('/playground')}
                              >
                                Test in Playground
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              Created {new Date(key.createdAt).toLocaleDateString()}
                              {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                  {isLoadingUsage ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : usageData?.dailyUsage && usageData.dailyUsage.length > 0 ? (
                    <div className="space-y-4">
                      {/* Simple bar chart */}
                      <div className="flex items-end gap-2 h-40">
                        {usageData.dailyUsage.map((day, i) => {
                          const maxRequests = Math.max(...usageData.dailyUsage.map(d => d.requests));
                          const height = maxRequests > 0 ? (day.requests / maxRequests) * 100 : 0;
                          return (
                            <div 
                              key={i} 
                              className="flex-1 flex flex-col items-center gap-2"
                            >
                              <div 
                                className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                                style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
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
                            {usageData.dailyUsage.map((day, i) => (
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
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground mb-2">No usage data yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start making API requests to see your usage statistics
                      </p>
                      <Button variant="outline" asChild>
                        <Link to="/playground">
                          <Play className="w-4 h-4 mr-2" />
                          Try the Playground
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Plan Upgrade Card */}
              <Card className="mt-6 border-primary/20">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Zap className="w-8 h-8 text-primary" />
                      <div>
                        <h3 className="font-semibold">Need more requests?</h3>
                        <p className="text-sm text-muted-foreground">
                          Upgrade to Pro for 10,000 requests/day and priority support
                        </p>
                      </div>
                    </div>
                    <Button asChild>
                      <Link to="/pricing">
                        Upgrade Plan
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Give your API key a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          
          {newlyCreatedKey ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <p className="text-sm text-emerald-400 mb-2">
                  <strong>Your new API key:</strong>
                </p>
                <div className="relative">
                  <code className="block w-full p-3 bg-secondary rounded-lg text-sm break-all font-mono">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => copyToClipboard(newlyCreatedKey, 'new-key')}
                  >
                    {copied === 'new-key' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <p className="text-sm text-amber-400">
                  <strong>Save this key!</strong> You won't be able to see it again.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setNewlyCreatedKey(null);
                    setShowCreateDialog(false);
                  }} 
                  className="flex-1"
                >
                  Done
                </Button>
                <Button 
                  onClick={() => {
                    copyToClipboard(newlyCreatedKey, 'new-key');
                    navigate('/playground');
                  }} 
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test in Playground
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production, Development"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={isCreatingKey}>
                  {isCreatingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Key'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
