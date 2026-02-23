import { useState } from 'react';
import { CodeBlock } from '@/components/CodeBlock';
import { cn } from '@/lib/utils';

const examples = {
  cloudflare: {
    title: 'Cloudflare Free Tier',
    description: 'Use AI for free with 10K neurons/day via Cloudflare Workers AI',
    code: `import { createBinario } from 'binario';

// Configure Cloudflare Workers AI
// Free tier: 10,000 neurons/day
const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      // Use small models for best free tier usage
      defaultModel: '@cf/meta/llama-3.2-1b-instruct',
    },
  },
  defaultProvider: 'cloudflare',
});

// Small models: ~500+ tokens/day free
// llama-3.2-1b: Best for free tier
// llama-3.2-3b: More capable, ~300 tokens/day
// llama-3.1-8b-fast: ~280 tokens/day

const response = await ai.chat([
  { role: 'user', content: 'Hello!' }
]);

console.log(response.content);

// ⚠️ Large models (70B) consume 200K+ neurons per request
// Not recommended for free tier usage`,
  },
  functionCalling: {
    title: 'Function Calling',
    description: 'Tool use with models that support it',
    code: `import { createBinario, defineTool, z } from 'binario';

// Models that support function calling:
// - @hf/nousresearch/hermes-2-pro-mistral-7b (recommended)
// - @cf/meta/llama-3.3-70b-instruct-fp8-fast
// - @cf/meta/llama-4-scout-17b-16e-instruct

const ai = createBinario({
  providers: {
    cloudflare: {
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
      // hermes-2-pro is best for function calling
      defaultModel: '@hf/nousresearch/hermes-2-pro-mistral-7b',
    },
  },
});

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => {
    return \`Weather in \${city}: 22°C, sunny\`;
  },
});

const response = await ai.chat(
  [{ role: 'user', content: 'What\\'s the weather in Tokyo?' }],
  { tools: [weatherTool] }
);`,
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
  model: '@hf/nousresearch/hermes-2-pro-mistral-7b',
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
  cloudflareModels: {
    title: 'Model Selection',
    description: 'Choose the right Cloudflare model for your use case',
    code: `const ai = createBinario({
  providers: {
    cloudflare: { 
      accountId: process.env.CF_ACCOUNT_ID,
      apiKey: process.env.CF_API_TOKEN,
    },
  },
});

// Most efficient (free tier champion: ~985 tokens/day)
await ai.chat(messages, { model: '@cf/ibm-granite/granite-4.0-h-micro' });

// Best quality/cost ratio (~328 tokens/day free)
await ai.chat(messages, { model: '@cf/qwen/qwen3-30b-a3b-fp8' });

// Best for reasoning (~147 tokens/day free)
await ai.chat(messages, { model: '@cf/openai/gpt-oss-120b' });

// Highest quality (Pro tier recommended)
await ai.chat(messages, { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });

// Vision support
await ai.chat(messages, { model: '@cf/meta/llama-3.2-11b-vision-instruct' });`,
  },
  rag: {
    title: 'RAG Pipeline',
    description: 'Ingest documents, search by similarity, and query with context',
    code: `// Ingest a document into the RAG pipeline
const ingestRes = await fetch(API_URL + '/v1/rag/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  body: JSON.stringify({
    content: 'Binario is an AI SDK for Cloudflare Workers...',
    metadata: { source: 'docs', topic: 'overview' },
  }),
});
// → { documentId: "abc-123", chunks: 3, inserted: 3 }

// Search for similar documents
const searchRes = await fetch(API_URL + '/v1/rag/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  body: JSON.stringify({
    query: 'How does Binario work?',
    topK: 5,
  }),
});
// → [{ id, score: 0.92, content: "..." }]

// RAG Query - search + generate answer
const queryRes = await fetch(API_URL + '/v1/rag/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  body: JSON.stringify({
    query: 'Explain Binario architecture',
    topK: 5,
    model: '@cf/meta/llama-3.1-8b-instruct',
  }),
});
// → { answer: "Binario uses...", sources: [...] }`,
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
            Cloudflare's free AI tier, Pydantic-style schemas, Agent framework, and more.
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
