import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { CodeBlock } from '@/components/CodeBlock';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Zap, 
  Code, 
  Layers, 
  Bot, 
  Copy, 
  Check,
  ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

const installCode = `npm install binario zod`;

const quickStartCode = `import { createBinario, useBinarioStream } from 'binario';

// Initialize with your providers
const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
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

// Define tools for the agent
const searchTool = defineTool({
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    // Your search implementation
    return \`Results for: \${query}\`;
  },
});

const calculatorTool = defineTool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  parameters: z.object({
    expression: z.string().describe('Math expression'),
  }),
  execute: ({ expression }) => {
    return eval(expression); // Don't do this in production!
  },
});

// Create an agent with tools
const agent = createAgent(ai, {
  name: 'research-assistant',
  systemPrompt: 'You are a helpful research assistant.',
  tools: [searchTool, calculatorTool],
  maxIterations: 5,
});

// Run the agent
const result = await agent.run('What is 2 + 2?');
console.log(result.output); // "4"
console.log(result.toolCalls); // [{ tool: 'calculate', args: {...}, result: 4 }]`;

const providersCode = `import { createBinario } from 'binario';

const ai = createBinario({
  providers: {
    // FREE - Cloudflare Workers AI (10K neurons/day)
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
    },
    
    // OpenAI
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    
    // Anthropic
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    
    // Google
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
    
    // Lovable AI Gateway (pre-configured in Supabase)
    lovable: {
      apiKey: process.env.LOVABLE_API_KEY,
    },
  },
  
  // Set your default
  defaultProvider: 'cloudflare',
  
  // Enable caching
  cache: { enabled: true, ttl: 3600000 },
  
  // Retry configuration
  retry: { maxRetries: 3, backoff: 'exponential', initialDelay: 1000 },
});`;

const models = [
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', free: true, notes: 'Best free option' },
  { provider: 'Cloudflare', model: '@cf/meta/llama-3.2-11b-vision-instruct', free: true, notes: 'Vision support' },
  { provider: 'Cloudflare', model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', free: true, notes: 'Reasoning model' },
  { provider: 'OpenAI', model: 'gpt-4o', free: false, notes: 'Most capable' },
  { provider: 'OpenAI', model: 'gpt-4o-mini', free: false, notes: 'Fast & cheap' },
  { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022', free: false, notes: 'Best for code' },
  { provider: 'Google', model: 'gemini-2.0-flash', free: false, notes: 'Fast multimodal' },
  { provider: 'Lovable', model: 'google/gemini-2.5-flash', free: false, notes: 'Pre-configured' },
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
              Learn how to use Binario to build AI-powered applications with free Llama 3, 
              type-safe schemas, and a powerful agent framework.
            </p>
          </div>

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
                  Get started with streaming chat in just a few lines of code.
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
                  Build multi-step reasoning agents with tool calling and dependency injection.
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

          {/* Models Table */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Supported Models</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-xl overflow-hidden">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Free</th>
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
                            Free
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
                href="#playground"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Navigate to playground when implemented
                }}
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
