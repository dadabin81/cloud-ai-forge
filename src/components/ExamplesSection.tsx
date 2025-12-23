import { useState } from 'react';
import { CodeBlock } from '@/components/CodeBlock';
import { cn } from '@/lib/utils';

const examples = {
  cloudflare: {
    title: 'Free Llama 3',
    description: 'Use Llama 3.3 70B completely free via Cloudflare',
    code: `import { createBinario } from 'binario';

// Configure Cloudflare Workers AI (FREE tier!)
const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      defaultModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    },
  },
  defaultProvider: 'cloudflare',
});

// 10,000 free neurons/day included
const response = await ai.chat([
  { role: 'user', content: 'Explain quantum computing' }
]);

console.log(response.content);
// Uses Cloudflare's edge network for low latency`,
  },
  schemas: {
    title: 'Pydantic-Style Schemas',
    description: 'Type-safe structured output with Zod validation',
    code: `import { createBinario, z } from 'binario';

// Define your schema (like Pydantic in Python)
const RecipeSchema = z.object({
  name: z.string().describe('Recipe name'),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  prepTime: z.number().describe('Prep time in minutes'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

// Get type-safe, validated responses
const response = await ai.chat(
  [{ role: 'user', content: 'Give me a pasta recipe' }],
  { outputSchema: RecipeSchema }
);

// response.data is fully typed!
console.log(response.data.name);
console.log(response.data.ingredients);`,
  },
  agents: {
    title: 'Agent Framework',
    description: 'Multi-step reasoning with tools and context',
    code: `import { createBinario, createAgent, defineTool, z } from 'binario';

// Define type-safe tools
const searchTool = defineTool({
  name: 'web_search',
  description: 'Search the web',
  parameters: z.object({
    query: z.string(),
    maxResults: z.number().default(5),
  }),
  execute: async ({ query }) => {
    return await searchAPI(query);
  },
});

// Create an agent with tools
const agent = createAgent(ai, {
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  systemPrompt: 'You are a helpful research assistant',
  tools: [searchTool, calculatorTool],
  maxIterations: 5,
});

// Run with callbacks for each step
const result = await agent.run('Research AI trends in 2024', {
  onToolCall: (tool, args, result) => {
    console.log(\`Called \${tool}\`, args);
  },
});`,
  },
  streaming: {
    title: 'React Streaming',
    description: 'Real-time token streaming with hooks',
    code: `import { useBinarioStream, useBinarioAgent } from 'binario';

// Streaming chat hook
function StreamingChat({ ai }) {
  const { 
    messages, 
    send, 
    isStreaming, 
    streamingContent 
  } = useBinarioStream(ai);

  return (
    <div className="chat">
      {messages.map((msg, i) => (
        <Message key={i} {...msg} />
      ))}
      
      {isStreaming && (
        <Message role="assistant" content={streamingContent} />
      )}
      
      <ChatInput onSend={send} disabled={isStreaming} />
    </div>
  );
}

// Agent hook with tool tracking
function AgentChat({ agent }) {
  const { run, output, toolCalls, isRunning } = useBinarioAgent(agent);
  // ...
}`,
  },
  multiProvider: {
    title: 'Multi-Provider',
    description: 'Switch providers with one line',
    code: `const ai = createBinario({
  providers: {
    cloudflare: { 
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
    },
    openai: { 
      apiKey: process.env.OPENAI_KEY,
      defaultModel: 'gpt-4o'
    },
    anthropic: { 
      apiKey: process.env.ANTHROPIC_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
  },
  defaultProvider: 'cloudflare', // Start free!
});

// Use Cloudflare (FREE)
await ai.chat(messages);

// Use Claude for complex reasoning
await ai.chat(messages, { provider: 'anthropic' });

// Use GPT-4 for specific tasks
await ai.chat(messages, { 
  provider: 'openai',
  model: 'gpt-4-turbo'
});`,
  },
};

type ExampleKey = keyof typeof examples;

export function ExamplesSection() {
  const [activeExample, setActiveExample] = useState<ExampleKey>('cloudflare');

  return (
    <section id="examples" className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See it in
            <span className="gradient-text"> action</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Free Llama 3, Pydantic-style schemas, Agent framework, and more.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Tabs */}
          <div className="lg:col-span-4 space-y-3">
            {(Object.keys(examples) as ExampleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveExample(key)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all duration-200',
                  activeExample === key
                    ? 'bg-secondary border-primary/30 shadow-lg'
                    : 'bg-card border-border/50 hover:border-border'
                )}
              >
                <div className="font-semibold text-foreground mb-1">
                  {examples[key].title}
                </div>
                <div className="text-sm text-muted-foreground">
                  {examples[key].description}
                </div>
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="lg:col-span-8">
            <CodeBlock
              code={examples[activeExample].code}
              language="typescript"
              filename={`${activeExample}.tsx`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
