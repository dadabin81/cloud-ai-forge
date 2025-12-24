# Binario

> Universal AI SDK for Cloudflare Workers — Unified API, smart fallbacks, and cost optimization.

[![npm version](https://img.shields.io/npm/v/binario.svg)](https://www.npmjs.com/package/binario)
[![npm downloads](https://img.shields.io/npm/dm/binario.svg)](https://www.npmjs.com/package/binario)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Simple API** — One unified interface for all AI providers
- ⚡ **Cloudflare-First** — Optimized for Workers AI with neuron tracking
- 🔄 **Smart Fallbacks** — Automatic failover to free models when limits are reached
- 🤖 **Agent Framework** — Multi-step reasoning with tool calling
- 📊 **Usage Tracking** — Built-in cost optimization and rate limiting
- 🔧 **Type-Safe** — Full TypeScript support with Zod schemas
- ⚛️ **React Hooks** — Ready-to-use hooks for chat, streaming, and agents

## Installation

```bash
npm install binario
```

## Quick Start

### SaaS Mode (Recommended)

The easiest way to get started — use our hosted API:

```typescript
import { Binario } from 'binario';

const client = new Binario('bsk_your_api_key');

// Simple chat
const response = await client.chat('What is the capital of France?');
console.log(response.content);

// Streaming
for await (const chunk of client.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### Self-Hosted Mode

Run your own backend with Cloudflare Workers:

```typescript
import { createBinario } from 'binario';

const ai = createBinario({
  providers: {
    cloudflare: {
      binding: env.AI, // Cloudflare AI binding
      accountId: env.CF_ACCOUNT_ID,
    },
  },
  defaultProvider: 'cloudflare',
});

const response = await ai.chat([
  { role: 'user', content: 'Hello!' }
]);
```

## React Hooks

```typescript
import { useBinarioChat, useBinarioStream } from 'binario/react';

function ChatComponent() {
  const { messages, sendMessage, isLoading } = useBinarioChat({
    apiKey: 'bsk_your_api_key',
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send
      </button>
    </div>
  );
}
```

## Agent Framework

Create powerful AI agents with tool calling:

```typescript
import { Binario, defineTool } from 'binario';
import { z } from 'zod';

const client = new Binario('bsk_your_api_key');

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    // Your weather API call here
    return { temperature: 22, condition: 'sunny' };
  },
});

const agent = client.agent({
  systemPrompt: 'You are a helpful weather assistant.',
  tools: [weatherTool],
});

const result = await agent.run('What is the weather in Paris?');
console.log(result.output);
```

## Cloudflare Workers

Utilities for building AI-powered Workers:

```typescript
import { 
  runWithTools, 
  calculateNeurons,
  getRecommendedModel 
} from 'binario/cloudflare';

export default {
  async fetch(request, env) {
    const model = getRecommendedModel('chat', true); // free tier
    
    const result = await runWithTools(
      env.AI,
      model,
      [{ role: 'user', content: 'Hello!' }],
      [weatherTool]
    );
    
    return Response.json(result);
  },
};
```

## Supported Providers

| Provider | Status | Models |
|----------|--------|--------|
| Cloudflare Workers AI | ✅ Full | Llama 3.2/3.3, Mistral, Qwen, DeepSeek |
| OpenRouter | ✅ Full | 100+ models including free options |
| OpenAI | ✅ Full | GPT-4, GPT-3.5, etc. |
| Anthropic | ✅ Full | Claude 3.5, Claude 3, etc. |
| Google | ✅ Full | Gemini Pro, Gemini Flash |
| Mistral | ✅ Full | Mistral Large, Medium, Small |

## Pricing

| Plan | Requests/Month | Tokens/Month | Price |
|------|---------------|--------------|-------|
| Free | 1,000 | 50,000 | $0 |
| Pro | 50,000 | 500,000 | $19/mo |
| Enterprise | Unlimited | Unlimited | Custom |

## Documentation

Full documentation available at [binario.dev/docs](https://binario.dev/docs)

## License

MIT © Binario Team
