import { FeatureCard } from '@/components/FeatureCard';
import { 
  Layers, 
  Zap, 
  Shield, 
  Database, 
  RefreshCw, 
  Code2, 
  Globe, 
  Cpu,
  Workflow,
  Bot,
  FileJson,
  DollarSign
} from 'lucide-react';

const features = [
  {
    icon: DollarSign,
    title: 'Free Llama 3',
    description: 'Use Llama 3.3 70B completely free via Cloudflare Workers AI. 10,000 neurons/day included.',
    highlight: true,
  },
  {
    icon: FileJson,
    title: 'Pydantic-Style Schemas',
    description: 'Type-safe structured output with Zod validation. Define schemas, get validated responses.',
  },
  {
    icon: Bot,
    title: 'Agent Framework',
    description: 'Multi-step reasoning agents with tool calling and dependency injection. Like LangChain but simpler.',
  },
  {
    icon: Layers,
    title: 'Multi-Provider',
    description: 'Seamlessly switch between OpenAI, Anthropic, Google, Cloudflare, Mistral, and Cohere.',
  },
  {
    icon: Zap,
    title: 'Edge-Ready Streaming',
    description: 'Native SSE streaming optimized for Cloudflare Workers with V8 isolate security.',
  },
  {
    icon: Shield,
    title: 'Type-Safe',
    description: 'Full TypeScript support with intelligent autocompletion and compile-time error checking.',
  },
  {
    icon: Database,
    title: 'Smart Caching',
    description: 'Built-in LRU cache with configurable TTL to reduce latency and API costs.',
  },
  {
    icon: RefreshCw,
    title: 'Auto-Retry',
    description: 'Configurable exponential backoff with intelligent retry strategies for resilient apps.',
  },
  {
    icon: Code2,
    title: 'React Hooks',
    description: 'useBinarioChat, useBinarioStream, useBinarioAgent, and useBinarioStructured for React.',
  },
  {
    icon: Workflow,
    title: 'Tool Calling',
    description: 'Native support for function calling and tool use across all compatible providers.',
  },
  {
    icon: Cpu,
    title: 'Structured Output',
    description: 'Zod schema validation for reliable structured responses from any model.',
  },
  {
    icon: Globe,
    title: 'Framework Agnostic',
    description: 'Works with React, Vue, Svelte, or vanilla JS. Use it anywhere JavaScript runs.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="relative max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            More power,
            <br />
            <span className="gradient-text">less cost</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Free Llama 3 via Cloudflare, Pydantic-style schemas, and an Agent framework. 
            Everything you need, nothing you don't.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={index * 50}
              className="animate-slide-up"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
