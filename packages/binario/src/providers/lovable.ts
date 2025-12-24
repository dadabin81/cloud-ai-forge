// Lovable AI Gateway Provider
// Uses the Lovable AI Gateway for easy AI integration

import type { Message, ChatResponse, ProviderConfig } from '../types';

export const LOVABLE_MODELS = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gemini-flash-lite': 'google/gemini-2.5-flash-lite',
  'gpt-5': 'openai/gpt-5',
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gpt-5-nano': 'openai/gpt-5-nano',
} as const;

export type LovableModel = keyof typeof LOVABLE_MODELS;

export const DEFAULT_LOVABLE_MODEL = 'gemini-flash';

export interface LovableOptions {
  model?: LovableModel | string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface LovableProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Create a Lovable AI provider configuration
 */
export function createLovableProvider(config?: Partial<LovableProviderConfig>): ProviderConfig {
  return {
    apiKey: config?.apiKey || '',
    baseUrl: config?.baseUrl || 'https://ai.gateway.lovable.dev/v1/chat/completions',
  };
}

/**
 * Format messages for Lovable AI Gateway
 */
function formatMessages(messages: Message[], systemPrompt?: string): Array<{ role: string; content: string }> {
  const formatted = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (systemPrompt && !formatted.some(m => m.role === 'system')) {
    formatted.unshift({ role: 'system', content: systemPrompt });
  }

  return formatted;
}

/**
 * Non-streaming chat completion with Lovable AI
 */
export async function runWithLovable(
  config: LovableProviderConfig,
  messages: Message[],
  options: LovableOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const model = options.model 
    ? (LOVABLE_MODELS[options.model as LovableModel] || options.model)
    : LOVABLE_MODELS[DEFAULT_LOVABLE_MODEL];

  const response = await fetch(config.baseUrl || 'https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: formatMessages(messages, options.systemPrompt),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your Lovable workspace.');
    }
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    id: data.id || crypto.randomUUID(),
    provider: 'lovable',
    model,
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    finishReason: data.choices?.[0]?.finish_reason || 'stop',
    latency: Date.now() - startTime,
    cached: false,
  };
}

/**
 * Streaming chat completion with Lovable AI
 * Returns an async generator that yields tokens
 */
export async function* streamWithLovable(
  config: LovableProviderConfig,
  messages: Message[],
  options: LovableOptions = {}
): AsyncGenerator<string, ChatResponse, unknown> {
  const startTime = Date.now();
  const model = options.model 
    ? (LOVABLE_MODELS[options.model as LovableModel] || options.model)
    : LOVABLE_MODELS[DEFAULT_LOVABLE_MODEL];

  const response = await fetch(config.baseUrl || 'https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: formatMessages(messages, options.systemPrompt),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your Lovable workspace.');
    }
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process line by line
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') break;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullContent += content;
          yield content;
        }
      } catch {
        // Incomplete JSON, put back and wait for more
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    provider: 'lovable',
    model,
    content: fullContent,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: 'stop',
    latency: Date.now() - startTime,
    cached: false,
  };
}

/**
 * Helper to create a chat function for edge functions
 * This is the recommended way to use Lovable AI in Supabase Edge Functions
 */
export function createEdgeFunctionHandler(systemPrompt?: string) {
  return `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${LOVABLE_API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ${JSON.stringify(systemPrompt || 'You are a helpful AI assistant.')} },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(\`AI gateway error: \${status}\`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
`;
}
