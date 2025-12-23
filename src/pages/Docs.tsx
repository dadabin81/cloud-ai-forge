import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { CodeBlock } from '@/components/CodeBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Zap, 
  Code, 
  Layers, 
  Bot, 
  Copy, 
  Check,
  ChevronRight,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const installCode = `npm install binario zod`;

const quickStartCode = `import { createBinario, useBinarioStream } from 'binario';

// Initialize with Cloudflare (free tier)
const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      // Use small models for free tier
      defaultModel: '@cf/meta/llama-3.2-1b-instruct',
    },
  },
  defaultProvider: 'cloudflare',
});

// Use in your React component
function Chat() {
  const { messages, send, isStreaming, streamingContent } = 
    useBinarioStream(ai);

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.content}</div>
      ))}
      {isStreaming && <div>{streamingContent}</div>}
      <button onClick={() => send('Hello!')}>
        Send
      </button>
    </div>
  );
}`;

const schemaCode = `import { createBinario, z } from 'binario';

// Define a type-safe response schema
const ProductSchema = z.object({
  name: z.string().describe('Product name'),
  price: z.number().describe('Price in USD'),
  features: z.array(z.string()).describe('Key features'),
  rating: z.number().min(0).max(5).describe('Rating out of 5'),
});

// Use structured output
const response = await ai.chat([
  { role: 'user', content: 'Describe the iPhone 15 Pro' }
], {
  outputSchema: ProductSchema,
});

// response.data is fully typed!
console.log(response.data.name);     // string
console.log(response.data.price);    // number
console.log(response.data.features); // string[]`;

const agentCode = `import { createBinario, createAgent, defineTool, z } from 'binario';

// Use a model that supports function calling
const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      // hermes-2-pro supports function calling
      defaultModel: '@hf/nousresearch/hermes-2-pro-mistral-7b',
    },
  },
});

// Define tools for the agent
const searchTool = defineTool({
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    return \`Results for: \${query}\`;
  },
});

// Create an agent with tools
const agent = createAgent(ai, {
  name: 'research-assistant',
  systemPrompt: 'You are a helpful research assistant.',
  tools: [searchTool],
  maxIterations: 5,
});

// Run the agent
const result = await agent.run('What is quantum computing?');
console.log(result.output);`;

const providersCode = `import { createBinario } from 'binario';

const ai = createBinario({
  providers: {
    // Cloudflare Workers AI (10K neurons/day FREE)
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      // Small model for free tier
      defaultModel: '@cf/meta/llama-3.2-1b-instruct',
    },
    
    // Lovable AI Gateway (pre-configured in Supabase)
    lovable: {
      apiKey: process.env.LOVABLE_API_KEY,
      defaultModel: 'google/gemini-2.5-flash',
    },
    
    // OpenAI
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4o',
    },
    
    // Anthropic
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022',
    },
  },
  
  defaultProvider: 'cloudflare',
  cache: { enabled: true, ttl: 3600000 },
  retry: { maxRetries: 3, backoff: 'exponential', initialDelay: 1000 },
});`;

// Updated models with accurate information
const models = [
  // Cloudflare - Small (Best for free tier)
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.2-1b-instruct', free: true, notes: 'Best for free tier (~550 tokens/day)' },
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.2-3b-instruct', free: true, notes: 'More capable (~300 tokens/day)' },
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', free: true, notes: 'Fast 8B model (~280 tokens/day)' },
  // Cloudflare - Function Calling
  { provider: 'Cloudflare', model: '@hf/nousresearch/hermes-2-pro-mistral-7b', free: true, notes: 'Best for function calling' },
  // Cloudflare - Large (NOT for free tier)
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', free: false, notes: '⚠️ 200K+ neurons/request' },
  // Cloudflare - Vision & Reasoning
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.2-11b-vision-instruct', free: true, notes: 'Vision support (limited free)' },
  { provider: 'Cloudflare', model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', free: true, notes: 'Reasoning (limited free)' },
  // Other providers
  { provider: 'Lovable', model: 'google/gemini-2.5-flash', free: false, notes: 'Pre-configured in Supabase' },
  { provider: 'OpenAI', model: 'gpt-4o', free: false, notes: 'Most capable' },
  { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022', free: false, notes: 'Best for code' },
];

// Neuron cost examples
const neuronExamples = [
  { model: 'llama-3.2-1b', inputCost: 2457, outputCost: 18252, freeTokens: '~550' },
  { model: 'llama-3.2-3b', inputCost: 4625, outputCost: 30475, freeTokens: '~300' },
  { model: 'llama-3.1-8b-fast', inputCost: 4119, outputCost: 34868, freeTokens: '~280' },
  { model: 'llama-3.3-70b', inputCost: 26668, outputCost: 204805, freeTokens: '~48' },
];

export default function Docs() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, section: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(section);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <BookOpen className="w-4 h-4" />
              <span>Documentation</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Getting Started with <span className="gradient-text">Binario</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Learn how to use Binario to build AI-powered applications with Cloudflare's free AI tier, 
              type-safe schemas, and a powerful agent framework.
            </p>
          </div>

          {/* Free Tier Warning */}
          <section className="mb-8">
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-400 mb-1">Understanding Cloudflare's Free Tier</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Cloudflare Workers AI offers <strong>10,000 neurons/day</strong> for free. Neuron consumption varies by model size:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>Small models</strong> (1B-3B): ~300-550 output tokens/day free</li>
                    <li><strong>Medium models</strong> (8B): ~280 output tokens/day free</li>
                    <li><strong>Large models</strong> (70B): Only ~48 output tokens/day free</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-3">
                    <strong>Recommendation:</strong> Use <code className="bg-secondary px-1 rounded">llama-3.2-1b-instruct</code> for maximum free usage.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Install */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Installation
            </h2>
            <div className="relative">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 border border-border font-mono text-sm">
                <span className="text-muted-foreground">$</span>
                <span className="text-foreground flex-1">{installCode}</span>
                <button 
                  onClick={() => copyCode(installCode, 'install')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedSection === 'install' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Cloudflare Setup */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Cloudflare Setup
            </h2>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                To use Cloudflare Workers AI, you need:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>A Cloudflare account (free)</li>
                <li>Your <strong>Account ID</strong> - found in the Cloudflare dashboard URL</li>
                <li>An <strong>API Token</strong> with Workers AI permissions</li>
              </ol>
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-sm">
                  <strong>Get your credentials:</strong>{' '}
                  <a 
                    href="https://dash.cloudflare.com/profile/api-tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Cloudflare API Tokens →
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <Tabs defaultValue="quickstart" className="mb-16">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="quickstart" className="gap-2">
                <Code className="w-4 h-4" />
                Quick Start
              </TabsTrigger>
              <TabsTrigger value="schemas" className="gap-2">
                <Layers className="w-4 h-4" />
                Schemas
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Bot className="w-4 h-4" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="providers" className="gap-2">
                <Zap className="w-4 h-4" />
                Providers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quickstart" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Basic Usage</h3>
                <p className="text-muted-foreground mb-4">
                  Get started with streaming chat using Cloudflare's free tier.
                </p>
                <CodeBlock code={quickStartCode} language="typescript" filename="chat.tsx" />
              </div>
            </TabsContent>

            <TabsContent value="schemas" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Type-Safe Structured Output</h3>
                <p className="text-muted-foreground mb-4">
                  Use Zod schemas (Pydantic-style) to get fully typed responses from LLMs.
                </p>
                <CodeBlock code={schemaCode} language="typescript" filename="structured.ts" />
              </div>
            </TabsContent>

            <TabsContent value="agents" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Agent Framework</h3>
                <p className="text-muted-foreground mb-4">
                  Build multi-step reasoning agents with tool calling. Note: Use models that support function calling.
                </p>
                <CodeBlock code={agentCode} language="typescript" filename="agent.ts" />
              </div>
            </TabsContent>

            <TabsContent value="providers" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Multi-Provider Configuration</h3>
                <p className="text-muted-foreground mb-4">
                  Configure multiple AI providers and switch between them seamlessly.
                </p>
                <CodeBlock code={providersCode} language="typescript" filename="config.ts" />
              </div>
            </TabsContent>
          </Tabs>

          {/* Neuron Costs Table */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Neuron Consumption by Model</h2>
            <p className="text-muted-foreground mb-4">
              Neurons are calculated as: <code className="bg-secondary px-1 rounded">(input_tokens × input_cost + output_tokens × output_cost) / 1,000,000</code>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Input Cost</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Output Cost</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Free Tokens/Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {neuronExamples.map((item, i) => (
                    <tr key={i} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono">{item.model}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.inputCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.outputCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.freeTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Models Table */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Supported Models</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Free Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {models.map((model, i) => (
                    <tr key={i} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm">{model.provider}</td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{model.model}</td>
                      <td className="px-4 py-3 text-center">
                        {model.free ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
                            Free*
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Paid</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{model.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * Free within 10,000 neurons/day limit. Larger models consume more neurons per request.
            </p>
          </section>

          {/* Next Steps */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <a 
                href="https://github.com/binario-ai/binario"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-border hover:border-primary/50 transition-all hover:bg-secondary/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">GitHub Repository</h3>
                    <p className="text-sm text-muted-foreground">View source code and examples</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </a>
              <a 
                href="/playground"
                className="group p-6 rounded-xl border border-border hover:border-primary/50 transition-all hover:bg-secondary/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Interactive Playground</h3>
                    <p className="text-sm text-muted-foreground">Try Binario in your browser</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
