import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/CodeBlock';
import { ArrowRight, Terminal, Sparkles } from 'lucide-react';

const heroCode = `import { createNexus, useNexusStream } from 'nexus-ai';

const nexus = createNexus({
  providers: {
    openai: { apiKey: process.env.OPENAI_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_KEY },
    google: { apiKey: process.env.GOOGLE_KEY },
  },
  defaultProvider: 'openai',
  cache: { enabled: true, ttl: 3600000 },
});

function ChatApp() {
  const { messages, send, isStreaming, streamingContent } = 
    useNexusStream(nexus, {
      model: 'gpt-4o',
      temperature: 0.7,
    });

  return (
    <Chat 
      messages={messages}
      streamingContent={streamingContent}
      onSend={send}
      loading={isStreaming}
    />
  );
}`;

export function HeroSection() {
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">v2.0 Now Available</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight animate-slide-up">
              The AI SDK that
              <br />
              <span className="gradient-text">doesn't hold back</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-muted-foreground max-w-xl animate-slide-up" style={{ animationDelay: '100ms' }}>
              Multi-provider support, edge-ready streaming, intelligent caching, and type-safe React hooks. 
              Built for developers who demand more from their AI integrations.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <Button variant="hero" size="xl" className="gap-2">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="xl" className="gap-2">
                <Terminal className="w-5 h-5" />
                View Examples
              </Button>
            </div>

            {/* Install command */}
            <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/30 border border-border/50 font-mono text-sm">
                <span className="text-muted-foreground">$</span>
                <span className="text-foreground">npm install nexus-ai</span>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
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
