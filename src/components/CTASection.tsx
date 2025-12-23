import { Button } from '@/components/ui/button';
import { ArrowRight, Github, BookOpen } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold mb-6">
          Ready to build
          <br />
          <span className="gradient-text">smarter AI apps?</span>
        </h2>
        
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
          Join thousands of developers who are shipping AI features faster with NexusAI.
          Open source, battle-tested, and built for production.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Button variant="hero" size="xl" className="gap-2">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="glass" size="xl" className="gap-2">
            <BookOpen className="w-5 h-5" />
            Read the Docs
          </Button>
        </div>

        {/* Install command */}
        <div className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
          <code className="font-mono text-sm">
            <span className="text-muted-foreground">$</span>{' '}
            <span className="text-foreground">npm install nexus-ai</span>
          </code>
          <div className="w-px h-6 bg-border" />
          <a 
            href="#" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
