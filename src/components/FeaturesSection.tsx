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
  DollarSign,
  Search,
  GitBranch
} from 'lucide-react';

const features = [
  {
    icon: DollarSign,
    title: 'Free Llama 3',
    description: 'Use Llama 3 models via Cloudflare Workers AI. 10,000 neurons/day free (~300-500 tokens).',
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
    description: 'Multi-step reasoning agents with tool calling. Uses Hermes 2 Pro for function calling.',
  },
  {
    icon: Search,
    title: 'RAG Pipeline',
    description: 'Built-in Retrieval-Augmented Generation with Vectorize. Ingest, chunk, embed, and query documents.',
    highlight: true,
  },
  {
    icon: GitBranch,
    title: 'Workflows Engine',
    description: 'Durable, multi-step workflows for research and RAG ingestion. Runs on Cloudflare Workers.',
    highlight: true,
  },
  {
    icon: Layers,
    title: 'Cloudflare Native',
    description: '17+ models via Workers AI. Text, images, audio, embeddings — all on Cloudflare\'s global edge.',
    highlight: true,
  },
  {
    icon: Zap,
    title: 'Edge-Ready Streaming',
    description: 'Native SSE streaming optimized for Cloudflare Workers with real-time token delivery.',
  },
  {
    icon: Shield,
    title: 'Type-Safe',
    description: 'Full TypeScript support with intelligent autocompletion and compile-time error checking.',
  },
  {
    icon: Database,
    title: 'Response Caching',
    description: 'KV-based LRU cache to reduce latency and API costs. Configurable TTL per request.',
  },
  {
    icon: RefreshCw,
    title: 'Auto-Retry',
    description: 'Configurable exponential backoff with intelligent retry strategies for resilient apps.',
  },
  {
    icon: Code2,
    title: 'React Hooks',
    description: 'useChat, useStream, useAgent, useUsage — production-ready hooks for any React app.',
  },
  {
    icon: Workflow,
    title: 'Tool Calling',
    description: 'Native support for function calling. Use @hf/nousresearch/hermes-2-pro-mistral-7b.',
  },
  {
    icon: Cpu,
    title: 'Structured Output',
    description: 'JSON Schema validation for reliable structured responses. Works with all Cloudflare models.',
  },
  {
    icon: Globe,
    title: 'Embeddings API',
    description: 'Generate embeddings with @cf/baai/bge-base-en-v1.5 for semantic search and RAG.',
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
