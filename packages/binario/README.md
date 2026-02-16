# Binario

> Universal AI SDK for Cloudflare Workers — Unified API, smart fallbacks, and cost optimization.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ⚠️ Status: Beta

This SDK is currently in **beta**. The hosted API at binario.dev is fully functional. For npm installation, build from source.

## ✨ Features

| Feature | Status | Notes |
|---------|--------|-------|
| Chat completions | ✅ Working | Cloudflare Workers AI |
| Streaming (SSE) | ✅ Working | Real-time token streaming |
| Structured output | ✅ Working | JSON Schema validation |
| Embeddings | ✅ Working | `@cf/baai/bge-base-en-v1.5` |
| Agent framework | ✅ Working | Tool calling with iterations |
| React Hooks | ✅ Working | Chat, stream, agent, memory |
| Multi-provider | ⚠️ Config required | Needs your own API keys |
| Smart caching | ⚠️ Planned | KV-based LRU cache |
| Memory system | ⚠️ Client-side | Buffer, summary, vector |

## 📦 Installation

### Option 1: Use the hosted API (Recommended)

Sign up at [binario.dev](https://binario.dev) and get an API key.

### Option 2: Build from source

```bash
git clone https://github.com/your-repo/binario.git
cd binario/packages/binario
npm install && npm run build
```

## 🚀 Quick Start

### SaaS Mode (Recommended)

The easiest way to get started — use our hosted API with no setup required:

```typescript
import { Binario } from 'binario';

// Initialize with your API key
const client = new Binario('bsk_your_api_key');

// Simple chat
const response = await client.chat('What is the capital of France?');
console.log(response.content); // "The capital of France is Paris."

// With options
const response = await client.chat('Explain quantum computing', {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 500,
});
```

### Streaming Responses

```typescript
// Streaming with async iterator
for await (const chunk of client.stream('Tell me a long story')) {
  process.stdout.write(chunk);
}

// Streaming with callbacks
await client.stream('Tell me a story', {
  onToken: (token) => process.stdout.write(token),
  onComplete: (fullText) => console.log('\nDone!'),
  onError: (error) => console.error('Error:', error),
});
```

### Check Usage & Limits

```typescript
// Get your current usage
const usage = await client.usage();
console.log(`Tokens: ${usage.tokensUsed}/${usage.tokensLimit}`);
console.log(`Requests: ${usage.requestsUsed}/${usage.requestsLimit}`);
console.log(`Plan: ${usage.plan}`);
```

## 🏠 Self-Hosted Mode

Run your own backend with Cloudflare Workers for full control:

```typescript
import { createBinario } from 'binario';

const ai = createBinario({
  providers: {
    cloudflare: {
      binding: env.AI, // Cloudflare AI binding
      accountId: env.CF_ACCOUNT_ID,
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
    },
  },
  defaultProvider: 'cloudflare',
});

// Chat with messages array
const response = await ai.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
]);

// Streaming
const stream = await ai.stream([
  { role: 'user', content: 'Write a poem' }
]);

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## ⚛️ React Hooks

### useBinarioChat

Full-featured chat hook with message history:

```tsx
import { useBinarioChat } from 'binario/react';

function ChatComponent() {
  const { 
    messages, 
    sendMessage, 
    isLoading, 
    error,
    clearMessages 
  } = useBinarioChat({
    apiKey: 'bsk_your_api_key',
    systemPrompt: 'You are a helpful assistant.',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = e.target.message.value;
    sendMessage(input);
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      {isLoading && <div>Thinking...</div>}
      {error && <div className="error">{error.message}</div>}
      
      <form onSubmit={handleSubmit}>
        <input name="message" placeholder="Type a message..." />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### useBinarioStream

Streaming responses with real-time updates:

```tsx
import { useBinarioStream } from 'binario/react';

function StreamingComponent() {
  const { 
    content, 
    isStreaming, 
    startStream, 
    stopStream 
  } = useBinarioStream({
    apiKey: 'bsk_your_api_key',
  });

  return (
    <div>
      <div className="output">{content}</div>
      <button onClick={() => startStream('Tell me a story')}>
        Start
      </button>
      {isStreaming && (
        <button onClick={stopStream}>Stop</button>
      )}
    </div>
  );
}
```

### useBinarioAgent

Run AI agents with tools in React:

```tsx
import { useBinarioAgent } from 'binario/react';
import { defineTool } from 'binario';
import { z } from 'zod';

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temperature: 22, condition: 'sunny' };
  },
});

function AgentComponent() {
  const { 
    result, 
    isRunning, 
    runAgent,
    steps 
  } = useBinarioAgent({
    apiKey: 'bsk_your_api_key',
    tools: [weatherTool],
    systemPrompt: 'You help users with weather information.',
  });

  return (
    <div>
      <button onClick={() => runAgent('What\'s the weather in Paris?')}>
        Ask Agent
      </button>
      
      {steps.map((step, i) => (
        <div key={i} className="step">
          {step.type === 'tool_call' && (
            <span>Called: {step.toolName}</span>
          )}
        </div>
      ))}
      
      {result && <div className="result">{result.output}</div>}
    </div>
  );
}
```

### useBinarioCompletion

Simple completions without chat history management:

```tsx
import { useBinarioCompletion } from 'binario/react';

function CompletionComponent() {
  const { 
    result, 
    isLoading, 
    error,
    complete,
    reset 
  } = useBinarioCompletion({
    apiKey: 'bsk_your_api_key',
    model: 'gpt-4',
    temperature: 0.7,
  });

  return (
    <div>
      <button onClick={() => complete('Explain quantum computing in simple terms')}>
        Generate
      </button>
      {isLoading && <div>Generating...</div>}
      {result && <div className="result">{result.content}</div>}
      {error && <div className="error">{error.message}</div>}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### useBinarioStructured

Type-safe structured outputs with Zod schemas:

```tsx
import { useBinarioStructured } from 'binario/react';
import { z } from 'zod';

const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  category: z.enum(['electronics', 'clothing', 'food']),
  inStock: z.boolean(),
});

function StructuredComponent() {
  const { 
    data, 
    isLoading, 
    error,
    extract 
  } = useBinarioStructured<z.infer<typeof ProductSchema>>({
    apiKey: 'bsk_your_api_key',
    schema: ProductSchema,
  });

  return (
    <div>
      <button onClick={() => extract('iPhone 15 Pro, $999, electronics, in stock')}>
        Extract Product
      </button>
      {data && (
        <div>
          <p>Name: {data.name}</p>
          <p>Price: ${data.price}</p>
          <p>Category: {data.category}</p>
          <p>In Stock: {data.inStock ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
}
```

### useBinarioTools

Tool calling with automatic execution:

```tsx
import { useBinarioTools } from 'binario/react';
import { z } from 'zod';

function ToolsComponent() {
  const { 
    messages,
    toolCalls,
    isExecuting,
    sendMessage,
  } = useBinarioTools({
    apiKey: 'bsk_your_api_key',
    tools: {
      get_weather: {
        description: 'Get weather for a location',
        parameters: z.object({
          location: z.string(),
        }),
        execute: async ({ location }) => {
          return { temperature: 22, condition: 'sunny', location };
        },
      },
      calculate: {
        description: 'Perform calculations',
        parameters: z.object({
          expression: z.string(),
        }),
        execute: async ({ expression }) => {
          return { result: eval(expression) };
        },
      },
    },
  });

  return (
    <div>
      <button onClick={() => sendMessage('What is the weather in Paris?')}>
        Ask
      </button>
      {toolCalls.map((call, i) => (
        <div key={i}>Tool: {call.name} → {JSON.stringify(call.result)}</div>
      ))}
    </div>
  );
}
```

### useBinarioMemory

Memory management for persistent conversations:

```tsx
import { useBinarioMemory } from 'binario/react';

function MemoryComponent() {
  const { 
    messages,
    context,
    addMessage,
    getContext,
    clear,
    isLoading,
    tokenCount,
  } = useBinarioMemory({
    type: 'buffer',
    maxMessages: 50,
    maxTokens: 4000,
  });

  // Add messages
  const handleSend = async (content: string) => {
    await addMessage({ role: 'user', content });
    // Get AI response and add it
    await addMessage({ role: 'assistant', content: 'Response...' });
  };

  return (
    <div>
      <div>Messages: {messages.length}</div>
      <div>Tokens: {tokenCount}</div>
      <button onClick={clear}>Clear Memory</button>
    </div>
  );
}
```

### useBinarioChatWithMemory

Chat with automatic persistent memory:

```tsx
import { useBinarioChatWithMemory } from 'binario/react';

function PersistentChatComponent() {
  const { 
    messages,
    sendMessage,
    isLoading,
    error,
    summary,
    memoryStats,
    clearMemory,
  } = useBinarioChatWithMemory({
    apiKey: 'bsk_your_api_key',
    memoryType: 'summary-buffer', // 'buffer' | 'summary' | 'summary-buffer' | 'vector'
    memoryOptions: {
      maxMessages: 20,
      summarizeThreshold: 10,
    },
    systemPrompt: 'You are a helpful assistant with memory.',
  });

  return (
    <div>
      <div className="stats">
        <span>Messages in memory: {memoryStats.messageCount}</span>
        <span>Tokens used: {memoryStats.tokenCount}</span>
      </div>
      
      {summary && (
        <div className="summary">
          <strong>Conversation summary:</strong> {summary}
        </div>
      )}
      
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>{msg.content}</div>
        ))}
      </div>
      
      <input 
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
      
      <button onClick={clearMemory}>Clear Memory</button>
    </div>
  );
}
```

### useBinarioEmbed

Generate embeddings for semantic operations:

```tsx
import { useBinarioEmbed } from 'binario/react';

function EmbeddingsComponent() {
  const { 
    embed,
    embedMany,
    similarity,
    findSimilar,
    isLoading,
    error,
  } = useBinarioEmbed({
    model: 'bge-base-en-v1.5',
    cacheResults: true,
  });

  // Generate single embedding
  const handleEmbed = async () => {
    const result = await embed('Hello, world!');
    console.log('Embedding dimensions:', result.embedding.length);
  };

  // Generate batch embeddings
  const handleBatchEmbed = async () => {
    const results = await embedMany([
      'First text',
      'Second text',
      'Third text',
    ]);
    console.log('Generated embeddings:', results.embeddings.length);
  };

  // Calculate similarity between texts
  const handleSimilarity = async () => {
    const score = await similarity(
      'I love programming',
      'Coding is my passion'
    );
    console.log('Similarity score:', score); // ~0.85
  };

  // Find similar texts
  const handleFindSimilar = async () => {
    const documents = [
      'JavaScript is a programming language',
      'Python is great for data science',
      'The weather is nice today',
      'React is a UI library',
    ];
    
    const similar = await findSimilar('frontend development', documents, {
      topK: 2,
      minScore: 0.5,
    });
    
    console.log('Similar documents:', similar);
    // [{ text: 'React is a UI library', score: 0.78 }, ...]
  };

  return (
    <div>
      <button onClick={handleEmbed}>Generate Embedding</button>
      <button onClick={handleBatchEmbed}>Batch Embed</button>
      <button onClick={handleSimilarity}>Check Similarity</button>
      <button onClick={handleFindSimilar}>Find Similar</button>
      {isLoading && <div>Processing...</div>}
    </div>
  );
}
```

### useBinarioSemanticSearch

Full semantic search solution with document management:

```tsx
import { useBinarioSemanticSearch } from 'binario/react';

function SemanticSearchComponent() {
  const { 
    addDocument,
    addDocuments,
    search,
    removeDocument,
    clear,
    documentCount,
    isLoading,
  } = useBinarioSemanticSearch({
    model: 'bge-base-en-v1.5',
  });

  // Add documents to the index
  const handleAddDocuments = async () => {
    await addDocuments([
      { id: 'doc1', content: 'React is a JavaScript library for building UIs' },
      { id: 'doc2', content: 'Vue.js is a progressive JavaScript framework' },
      { id: 'doc3', content: 'Angular is a platform for building web apps' },
      { id: 'doc4', content: 'Python is popular for machine learning' },
    ]);
  };

  // Search for similar documents
  const handleSearch = async () => {
    const results = await search('frontend framework for web development', {
      maxResults: 3,
      minScore: 0.5,
    });
    
    console.log('Search results:', results);
    // [
    //   { id: 'doc3', content: 'Angular...', score: 0.82 },
    //   { id: 'doc1', content: 'React...', score: 0.79 },
    //   { id: 'doc2', content: 'Vue.js...', score: 0.77 },
    // ]
  };

  return (
    <div>
      <div>Documents indexed: {documentCount}</div>
      <button onClick={handleAddDocuments}>Add Documents</button>
      <button onClick={handleSearch}>Search</button>
      <button onClick={() => removeDocument('doc1')}>Remove doc1</button>
      <button onClick={clear}>Clear Index</button>
    </div>
  );
}
```

## 🧠 Memory System

The Memory System provides persistent conversation context with multiple strategies for different use cases.

### Memory Types

| Type | Description | Best For |
|------|-------------|----------|
| `buffer` | Sliding window of recent messages | Simple chatbots, short conversations |
| `summary` | LLM-powered summarization | Long conversations, context compression |
| `summary-buffer` | Hybrid (buffer + summary) | Balanced memory with both recent and historical context |
| `vector` | Semantic search with embeddings | RAG, document Q&A, knowledge retrieval |

### BufferMemory

Keeps a sliding window of the most recent messages:

```typescript
import { createMemory } from 'binario';

const memory = createMemory({
  type: 'buffer',
  options: {
    maxMessages: 50,    // Keep last 50 messages
    maxTokens: 4000,    // Or limit by token count
  },
});

// Add messages
await memory.add({ role: 'user', content: 'Hello!' });
await memory.add({ role: 'assistant', content: 'Hi there!' });

// Get context for AI
const context = await memory.getContext();
console.log(context.messages); // Recent messages
console.log(context.tokenCount); // Approximate tokens
```

### SummaryMemory

Automatically summarizes conversations when they exceed a threshold:

```typescript
import { createMemory } from 'binario';

const memory = createMemory({
  type: 'summary',
  options: {
    summarizeThreshold: 20,  // Summarize after 20 messages
    summaryMaxTokens: 500,   // Max tokens for summary
  },
});

// Add messages as usual
await memory.add({ role: 'user', content: 'Tell me about Paris' });
await memory.add({ role: 'assistant', content: 'Paris is the capital of France...' });

// Get context includes summary
const context = await memory.getContext();
console.log(context.summary); // "User asked about Paris. Assistant explained..."
console.log(context.messages); // Recent messages after summary
```

### SummaryBufferMemory

Combines buffer memory with automatic summarization:

```typescript
import { createMemory } from 'binario';

const memory = createMemory({
  type: 'summary-buffer',
  options: {
    maxMessages: 10,          // Keep 10 recent messages
    summarizeThreshold: 20,   // Summarize when total exceeds 20
    summaryMaxTokens: 500,
  },
});

// Best of both worlds
const context = await memory.getContext();
console.log(context.summary);   // Summarized older context
console.log(context.messages);  // Recent 10 messages
```

### VectorMemory

Semantic retrieval for relevant context:

```typescript
import { createMemory } from 'binario';

const memory = createMemory({
  type: 'vector',
  options: {
    topK: 5,           // Retrieve top 5 relevant messages
    minScore: 0.7,     // Minimum similarity threshold
    embeddings: embeddingsProvider, // Your embeddings provider
  },
});

// Add messages (embeddings generated automatically)
await memory.add({ role: 'user', content: 'How do I deploy to Cloudflare?' });
await memory.add({ role: 'assistant', content: 'Use wrangler deploy command...' });

// Search retrieves semantically relevant messages
const results = await memory.search('cloudflare deployment');
// Returns messages about deployment, even if exact words don't match
```

### Storage Backends

Memory supports multiple storage backends:

```typescript
import { 
  createMemory, 
  InMemoryStore, 
  LocalStorageStore, 
  CloudflareKVStore 
} from 'binario';

// In-Memory (default, development)
const memoryDev = createMemory({
  type: 'buffer',
  store: new InMemoryStore(),
});

// LocalStorage (browser persistence)
const memoryBrowser = createMemory({
  type: 'buffer',
  store: new LocalStorageStore('my-chat-'),
});

// Cloudflare KV (production, distributed)
const memoryProd = createMemory({
  type: 'buffer',
  store: new CloudflareKVStore(env.CHAT_KV),
});
```

## 🔍 Embeddings API

Generate text embeddings for semantic search, similarity, and RAG applications.

### CloudflareEmbeddings

Use Cloudflare Workers AI for embeddings:

```typescript
import { CloudflareEmbeddings, createCloudflareEmbeddings } from 'binario';

// With Workers AI binding (recommended in Workers)
const embeddings = new CloudflareEmbeddings({
  binding: env.AI,
  model: 'bge-base-en-v1.5',
});

// With REST API (for external use)
const embeddings = createCloudflareEmbeddings({
  accountId: process.env.CF_ACCOUNT_ID,
  apiKey: process.env.CF_API_KEY,
  model: 'bge-large-en-v1.5',
});
```

### Available Models

| Model | Dimensions | Use Case |
|-------|------------|----------|
| `bge-small-en-v1.5` | 384 | Fast, lightweight |
| `bge-base-en-v1.5` | 768 | Balanced (default) |
| `bge-large-en-v1.5` | 1024 | Highest quality |

### Generate Embeddings

```typescript
// Single embedding
const result = await embeddings.embed('Hello, world!');
console.log(result.embedding);  // Float32Array(768)
console.log(result.model);      // 'bge-base-en-v1.5'

// Batch embeddings (more efficient)
const batch = await embeddings.embedMany([
  'First document',
  'Second document',
  'Third document',
]);
console.log(batch.embeddings.length); // 3
```

### Similarity Search

```typescript
// Calculate cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find similar documents
const query = await embeddings.embed('machine learning');
const docs = await embeddings.embedMany([
  'artificial intelligence and neural networks',
  'cooking recipes for beginners',
  'deep learning models',
]);

const similarities = docs.embeddings.map((emb, i) => ({
  index: i,
  score: cosineSimilarity(query.embedding, emb),
}));

similarities.sort((a, b) => b.score - a.score);
console.log(similarities);
// [{ index: 2, score: 0.89 }, { index: 0, score: 0.82 }, { index: 1, score: 0.12 }]
```

### RAG (Retrieval Augmented Generation)

```typescript
import { Binario, CloudflareEmbeddings, createMemory } from 'binario';

// Setup
const client = new Binario('bsk_your_api_key');
const embeddings = new CloudflareEmbeddings({ binding: env.AI });

// Create vector memory for documents
const memory = createMemory({
  type: 'vector',
  options: {
    topK: 3,
    embeddings,
  },
});

// Index your documents
const documents = [
  'Binario is an AI SDK for Cloudflare Workers',
  'It supports multiple AI providers including OpenAI and Anthropic',
  'The Memory System provides persistent conversation context',
  'Embeddings can be generated using Cloudflare Workers AI',
];

for (const doc of documents) {
  await memory.add({ role: 'system', content: doc });
}

// Query with RAG
async function queryWithRAG(question: string) {
  // Retrieve relevant context
  const results = await memory.search(question);
  const context = results.map(r => r.content).join('\n');
  
  // Generate answer with context
  const response = await client.chat([
    { role: 'system', content: `Answer based on this context:\n${context}` },
    { role: 'user', content: question },
  ]);
  
  return response.content;
}

const answer = await queryWithRAG('What AI providers does Binario support?');
// "Binario supports multiple AI providers including OpenAI and Anthropic."
```

## 🤖 Agent Framework

Create powerful AI agents with tool calling:

```typescript
import { Binario, defineTool } from 'binario';
import { z } from 'zod';

const client = new Binario('bsk_your_api_key');

// Define tools with Zod schemas
const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return { result: a + b };
      case 'subtract': return { result: a - b };
      case 'multiply': return { result: a * b };
      case 'divide': return { result: a / b };
    }
  },
});

const searchTool = defineTool({
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(5),
  }),
  execute: async ({ query, limit }) => {
    // Your search implementation
    return { results: ['Result 1', 'Result 2'] };
  },
});

// Create agent with tools
const agent = client.agent({
  systemPrompt: 'You are a helpful assistant with access to tools.',
  tools: [calculatorTool, searchTool],
  maxIterations: 10,
});

// Run the agent
const result = await agent.run('What is 25 * 4, then search for that number');

console.log(result.output);
console.log('Steps taken:', result.steps.length);
console.log('Tokens used:', result.usage.totalTokens);
```

## ☁️ Cloudflare Workers

Utilities for building AI-powered Workers:

```typescript
import { 
  runWithTools, 
  tool,
  calculateNeurons,
  getRecommendedModel,
  CLOUDFLARE_MODELS,
} from 'binario/cloudflare';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get recommended model based on task
    const model = getRecommendedModel('chat', true); // true = prefer free tier
    
    // Define tools using the simple helper
    const weatherTool = tool('get_weather', 'Get weather info', {
      location: { type: 'string', description: 'City name' },
    });
    
    // Run with tool support
    const result = await runWithTools(
      env.AI,
      model,
      [{ role: 'user', content: 'What is the weather in Tokyo?' }],
      [weatherTool],
      {
        onToolCall: async (name, args) => {
          if (name === 'get_weather') {
            return { temperature: 18, condition: 'cloudy' };
          }
        },
      }
    );
    
    // Calculate neuron usage for billing
    const neurons = calculateNeurons(model, result.usage);
    
    return Response.json({
      response: result.content,
      model,
      neurons,
    });
  },
};
```

### Available Cloudflare Models

```typescript
import { CLOUDFLARE_MODELS, NEURON_COSTS } from 'binario/cloudflare';

// All available models
console.log(CLOUDFLARE_MODELS);
// ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.2-3b-instruct', ...]

// Check neuron costs
console.log(NEURON_COSTS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']);
// { input: 0.0001, output: 0.0003 }
```

## 📊 Structured Outputs

Get type-safe structured data from AI:

```typescript
import { Binario, createSchema, z } from 'binario';

const client = new Binario('bsk_your_api_key');

// Define output schema
const ProductSchema = createSchema('Product', z.object({
  name: z.string().describe('Product name'),
  price: z.number().describe('Price in USD'),
  category: z.enum(['electronics', 'clothing', 'food']),
  inStock: z.boolean(),
}));

// Get structured output
const product = await client.structured(
  'Extract product info: iPhone 15 Pro, $999, electronics, available',
  ProductSchema
);

console.log(product.name);     // "iPhone 15 Pro"
console.log(product.price);    // 999
console.log(product.category); // "electronics"
console.log(product.inStock);  // true
```

## 🔌 Supported Providers

| Provider | Status | Models | Free Tier |
|----------|--------|--------|-----------|
| Cloudflare Workers AI | ✅ Full | Llama 3.2/3.3, Mistral, Qwen, DeepSeek | ✅ 10K neurons/day |
| OpenRouter | ✅ Full | 100+ models | ✅ Free models available |
| OpenAI | ✅ Full | GPT-4, GPT-4o, GPT-3.5 | ❌ |
| Anthropic | ✅ Full | Claude 3.5, Claude 3 | ❌ |
| Google | ✅ Full | Gemini Pro, Gemini Flash | ✅ Free tier |
| Mistral | ✅ Full | Mistral Large, Medium, Small | ❌ |

## 💰 Pricing

| Plan | Requests/Month | Tokens/Month | Price |
|------|---------------|--------------|-------|
| Free | 1,000 | 50,000 | $0 |
| Pro | 50,000 | 500,000 | $19/mo |
| Team | 200,000 | 2,000,000 | $79/mo |
| Enterprise | Unlimited | Unlimited | Custom |

## 🔑 Getting Your API Key

1. Sign up at [binario.dev](https://binario.dev)
2. Go to Dashboard → API Keys
3. Create a new key starting with `bsk_`
4. Use it in your application

## 🛠️ Error Handling

```typescript
import { Binario, BinarioRateLimitError, BinarioPaymentError } from 'binario';

const client = new Binario('bsk_your_api_key');

try {
  const response = await client.chat('Hello');
} catch (error) {
  if (error instanceof BinarioRateLimitError) {
    console.log('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof BinarioPaymentError) {
    console.log('Upgrade required:', error.message);
  } else {
    throw error;
  }
}
```

## 📚 API Reference

### Binario Class

```typescript
new Binario(apiKey: string)
new Binario(options: BinarioOptions)

interface BinarioOptions {
  apiKey: string;
  baseUrl?: string;      // Custom API endpoint
  timeout?: number;      // Request timeout in ms
  retries?: number;      // Number of retries
}
```

### Methods

| Method | Description |
|--------|-------------|
| `chat(message, options?)` | Send a chat message |
| `stream(message, options?)` | Stream a response |
| `structured(message, schema)` | Get structured output |
| `agent(config)` | Create an agent |
| `usage()` | Get usage statistics |

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📄 License

MIT © Binario Team

## 🔗 Links

- [Documentation](https://binario.dev/docs)
- [API Reference](https://binario.dev/docs/api)
- [Examples](https://github.com/binario-ai/binario/tree/main/examples)
- [Discord Community](https://discord.gg/binario)
- [Twitter](https://twitter.com/binario_ai)
