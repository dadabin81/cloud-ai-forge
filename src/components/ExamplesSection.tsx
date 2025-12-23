import { useState } from 'react';
import { CodeBlock } from '@/components/CodeBlock';
import { cn } from '@/lib/utils';

const examples = {
  streaming: {
    title: 'Streaming Chat',
    description: 'Real-time token streaming with React hooks',
    code: `import { useBinarioStream } from 'binario';

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
}`,
  },
  tools: {
    title: 'Tool Calling',
    description: 'Enable function calling for interactive agents',
    code: `const tools = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
      },
      required: ['location']
    }
  }
}];

const response = await ai.chat(messages, {
  tools,
  toolChoice: 'auto',
});

if (response.toolCalls) {
  for (const call of response.toolCalls) {
    const result = await executeFunction(call);
    // Continue conversation with tool result
  }
}`,
  },
  multiProvider: {
    title: 'Multi-Provider',
    description: 'Seamlessly switch between AI providers',
    code: `const ai = createBinario({
  providers: {
    openai: { 
      apiKey: process.env.OPENAI_KEY,
      defaultModel: 'gpt-4o'
    },
    anthropic: { 
      apiKey: process.env.ANTHROPIC_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
    google: { 
      apiKey: process.env.GOOGLE_KEY,
      defaultModel: 'gemini-2.0-flash'
    },
  },
  defaultProvider: 'openai',
});

// Use OpenAI (default)
await ai.chat(messages);

// Use Claude
await ai.chat(messages, { provider: 'anthropic' });

// Use Gemini with specific model
await ai.chat(messages, { 
  provider: 'google',
  model: 'gemini-2.0-pro'
});`,
  },
  caching: {
    title: 'Smart Caching',
    description: 'Reduce latency and costs with intelligent caching',
    code: `const ai = createBinario({
  providers: { /* ... */ },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 100, // Max cached responses
  },
});

// First call - hits the API
const response1 = await ai.chat(messages);
console.log(response1.cached); // false
console.log(response1.latency); // ~800ms

// Same request - returns from cache
const response2 = await ai.chat(messages);
console.log(response2.cached); // true
console.log(response2.latency); // ~2ms

// Custom cache key for more control
await ai.chat(messages, {
  cacheKey: 'user-123-summary',
  cacheTTL: 86400000, // 24 hours
});`,
  },
};

type ExampleKey = keyof typeof examples;

export function ExamplesSection() {
  const [activeExample, setActiveExample] = useState<ExampleKey>('streaming');

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
            Explore real-world examples and patterns for common AI integration scenarios.
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
