# Binario

> Universal AI SDK for Cloudflare Workers — Unified API, smart fallbacks, and cost optimization.

[![npm version](https://img.shields.io/npm/v/binario.svg)](https://www.npmjs.com/package/binario)
[![npm downloads](https://img.shields.io/npm/dm/binario.svg)](https://www.npmjs.com/package/binario)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🚀 **Simple API** — One unified interface for all AI providers
- ⚡ **Cloudflare-First** — Optimized for Workers AI with neuron tracking
- 🔄 **Smart Fallbacks** — Automatic failover to free models when limits are reached
- 🤖 **Agent Framework** — Multi-step reasoning with tool calling
- 📊 **Usage Tracking** — Built-in cost optimization and rate limiting
- 🔧 **Type-Safe** — Full TypeScript support with Zod schemas
- ⚛️ **React Hooks** — Ready-to-use hooks for chat, streaming, and agents
- 🌐 **Multi-Provider** — OpenAI, Anthropic, Google, Mistral, OpenRouter

## 📦 Installation

```bash
npm install binario
# or
yarn add binario
# or
pnpm add binario
# or
bun add binario
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
