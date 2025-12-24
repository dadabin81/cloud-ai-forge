import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/CodeBlock';
import { ArrowRight, Terminal, Zap, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

const heroCode = `import { createBinario, useBinarioStream } from 'binario';
import { z } from 'zod';

// FREE Llama 3 via Cloudflare Workers AI
const ai = createBinario({
  providers: {
    cloudflare: { 
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
    },
    openai: { apiKey: process.env.OPENAI_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_KEY },
  },
  defaultProvider: 'cloudflare', // Free tier!
  cache: { enabled: true, ttl: 3600000 },
});

// Pydantic-style type-safe schemas
const ResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
  sources: z.array(z.string()),
});

// Streaming with React hooks
function ChatApp() {
  const { messages, send, isStreaming } = 
    useBinarioStream(ai, {
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });

  return <Chat messages={messages} onSend={send} />;
}`;

export function HeroSection() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install binario zod');
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToExamples = () => {
    const element = document.getElementById('examples');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern bg-[size:60px_60px] opacity-[0.02]" />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Text content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-fade-in">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Free Llama 3 via Cloudflare</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight animate-slide-up">
              The AI SDK that
              <br />
              <span className="gradient-text">doesn't hold back</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-muted-foreground max-w-xl animate-slide-up" style={{ animationDelay: '100ms' }}>
              <strong className="text-foreground">Free Llama 3</strong> via Cloudflare Workers AI.
              Pydantic-style schemas. Agent framework with tools.
              Multi-provider streaming. Built for developers who demand more.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 text-sm animate-slide-up" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">10K</span>
                <span className="text-muted-foreground">free neurons/day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">4</span>
                <span className="text-muted-foreground">providers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">100%</span>
                <span className="text-muted-foreground">TypeScript</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <Button 
                variant="hero" 
                size="xl" 
                className="gap-2"
                onClick={() => navigate('/docs')}
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button 
                variant="glass" 
                size="xl" 
                className="gap-2"
                onClick={scrollToExamples}
              >
                <Terminal className="w-5 h-5" />
                View Examples
              </Button>
            </div>

            {/* Install command */}
            <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/30 border border-border/50 font-mono text-sm">
                <span className="text-muted-foreground">$</span>
                <span className="text-foreground">npm install binario zod</span>
                <button 
                  onClick={copyCommand}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Copy install command"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right side - Code example */}
          <div className="relative animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
            <CodeBlock 
              code={heroCode}
              language="typescript"
              filename="app.tsx"
              className="relative"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
