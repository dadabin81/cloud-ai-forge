import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Check, 
  Copy, 
  Key, 
  Code, 
  Rocket, 
  ArrowRight, 
  Terminal,
  Zap,
  BookOpen,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, API_BASE_URL } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
}

export default function Welcome() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: 'Get your API Key', description: 'Copy your API key to authenticate requests', icon: Key, completed: false },
    { id: 2, title: 'Install the SDK', description: 'Add Binario to your project', icon: Code, completed: false },
    { id: 3, title: 'Make your first request', description: 'Send a message to the AI', icon: Rocket, completed: false },
  ]);

  // Fetch user's first API key
  useEffect(() => {
    const fetchApiKey = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/v1/keys`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.keys?.length > 0) {
            // Show the prefix for display
            setApiKey(data.keys[0].prefix + '...');
          }
        }
      } catch (error) {
        console.error('Failed to fetch API key:', error);
      }
    };

    fetchApiKey();
  }, [token]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const markStepComplete = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: true } : step
    ));
    if (stepId < 3) {
      setCurrentStep(stepId + 1);
    }
  };

  const installCode = `npm install binario
# or
yarn add binario
# or
pnpm add binario`;

  const usageCode = `import { createBinario } from 'binario';

const ai = createBinario({
  baseUrl: '${API_BASE_URL}',
  apiKey: 'YOUR_API_KEY',
});

// Simple chat request
const response = await ai.chat([
  { role: 'user', content: 'Hello, Binario!' }
]);

console.log(response.content);`;

  const curlExample = `curl -X POST ${API_BASE_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "model": "@cf/meta/llama-3.1-8b-instruct"
  }'`;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Welcome to Binario
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Hi, {user?.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Let's get you set up with Binario in under 5 minutes. 
              Follow these simple steps to start building with AI.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-12">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                    step.completed 
                      ? "bg-primary text-primary-foreground" 
                      : currentStep === step.id 
                        ? "bg-primary/20 text-primary border-2 border-primary" 
                        : "bg-secondary text-muted-foreground"
                  )}
                >
                  {step.completed ? <Check className="w-5 h-5" /> : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-16 h-1 mx-2 rounded-full transition-all",
                    step.completed ? "bg-primary" : "bg-secondary"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Step Cards */}
          <div className="space-y-6">
            {/* Step 1: Get API Key */}
            <Card className={cn(
              "transition-all",
              currentStep === 1 ? "ring-2 ring-primary" : ""
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      steps[0].completed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    )}>
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Step 1: Get your API Key</CardTitle>
                      <CardDescription>Copy your API key to authenticate requests</CardDescription>
                    </div>
                  </div>
                  {steps[0].completed && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiKey ? (
                  <>
                    <div className="relative">
                      <div className="p-4 bg-secondary rounded-lg font-mono text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">{apiKey}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate('/dashboard')}
                        >
                          View in Dashboard
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      For security, your full API key is only shown once. Visit the Dashboard to create a new key if needed.
                    </p>
                  </>
                ) : (
                  <div className="p-4 bg-secondary/50 rounded-lg text-center">
                    <p className="text-muted-foreground mb-3">No API key found</p>
                    <Button onClick={() => navigate('/dashboard')}>
                      Create API Key in Dashboard
                    </Button>
                  </div>
                )}
                {!steps[0].completed && (
                  <Button 
                    onClick={() => markStepComplete(1)} 
                    className="w-full"
                    variant={apiKey ? "default" : "outline"}
                  >
                    {apiKey ? "I have my API Key" : "Skip for now"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Install SDK */}
            <Card className={cn(
              "transition-all",
              currentStep === 2 ? "ring-2 ring-primary" : ""
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      steps[1].completed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    )}>
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Step 2: Install the SDK</CardTitle>
                      <CardDescription>Add Binario to your project with npm, yarn, or pnpm</CardDescription>
                    </div>
                  </div>
                  {steps[1].completed && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="p-4 bg-[#1a1a2e] rounded-lg font-mono text-sm overflow-x-auto text-gray-300">
                    {installCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard('npm install binario', 'install')}
                  >
                    {copied === 'install' ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {!steps[1].completed && currentStep >= 2 && (
                  <Button onClick={() => markStepComplete(2)} className="w-full">
                    I've installed the SDK
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Step 3: First Request */}
            <Card className={cn(
              "transition-all",
              currentStep === 3 ? "ring-2 ring-primary" : ""
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      steps[2].completed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    )}>
                      <Rocket className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Step 3: Make your first request</CardTitle>
                      <CardDescription>Send a message to the AI and get a response</CardDescription>
                    </div>
                  </div>
                  {steps[2].completed && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="p-4 bg-[#1a1a2e] rounded-lg font-mono text-sm overflow-x-auto text-gray-300 max-h-[300px]">
                    {usageCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => copyToClipboard(usageCode, 'usage')}
                  >
                    {copied === 'usage' ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-border bg-secondary/30">
                  <p className="text-sm font-medium mb-2">Or try with cURL:</p>
                  <div className="relative">
                    <pre className="p-3 bg-[#1a1a2e] rounded-lg font-mono text-xs overflow-x-auto text-gray-300">
                      {curlExample}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1"
                      onClick={() => copyToClipboard(curlExample, 'curl')}
                    >
                      {copied === 'curl' ? (
                        <Check className="w-3 h-3 text-primary" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {!steps[2].completed && currentStep >= 3 && (
                  <Button onClick={() => markStepComplete(3)} className="w-full">
                    I've made my first request
                    <Check className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Next Steps / CTA */}
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/playground')}>
              <CardContent className="pt-6">
                <Play className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Try the Playground</h3>
                <p className="text-sm text-muted-foreground">
                  Test the API interactively in your browser
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/docs')}>
              <CardContent className="pt-6">
                <BookOpen className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Read the Docs</h3>
                <p className="text-sm text-muted-foreground">
                  Explore all features and capabilities
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
              <CardContent className="pt-6">
                <Zap className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Go to Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Manage keys and view usage stats
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
