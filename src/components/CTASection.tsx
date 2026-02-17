import { Button } from '@/components/ui/button';
import { ArrowRight, Github, Zap } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-8">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">10,000 free neurons/day</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
          Start building with
          <br />
          <span className="gradient-text">free Llama 3</span>
        </h2>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Get started in minutes with Cloudflare's free tier. 
          Pydantic-style schemas, Agent framework, and multi-provider support included.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Button variant="hero" size="xl" className="gap-2" onClick={() => window.open('https://www.npmjs.com/package/binario', '_blank')}>
            Install from NPM
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="glass" size="xl" className="gap-2" onClick={() => window.open('https://github.com/dadabin81/cloud-ai-forge', '_blank')}>
            <Github className="w-5 h-5" />
            View on GitHub
          </Button>
        </div>

        {/* Install command */}
        <div className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
          <code className="font-mono text-sm">
            <span className="text-muted-foreground">$</span>{' '}
            <span className="text-foreground">npm install binario zod</span>
          </code>
          <div className="w-px h-6 bg-border" />
          <a 
            href="https://github.com/dadabin81/cloud-ai-forge"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            Star on GitHub
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">✓</span>
            <span>Free Cloudflare tier</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">✓</span>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">✓</span>
            <span>MIT licensed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
