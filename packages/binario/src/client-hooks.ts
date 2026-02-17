// Binario SaaS Client React Hooks
// These hooks work with the Binario SaaS client (API key), NOT the self-hosted BinarioAI core.
// Usage: import { useBinarioClient, useChat, useStream, useAgent } from 'binario/react'

import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { Binario, type ChatOptions, type AgentOptions } from './client';
import type { Message, ChatResponse } from './types';

// ============= Context Provider =============

interface BinarioContextValue {
  client: Binario;
}

const BinarioContext = createContext<BinarioContextValue | null>(null);

export interface BinarioProviderProps {
  apiKey: string;
  baseUrl?: string;
  children: React.ReactNode;
}

export function BinarioProvider({ apiKey, baseUrl, children }: BinarioProviderProps) {
  const clientRef = useRef<Binario | null>(null);
  
  if (!clientRef.current || (clientRef.current as any).apiKey !== apiKey) {
    clientRef.current = new Binario(apiKey, { baseUrl });
  }

  return (
    // @ts-ignore - React.createElement for compatibility
    BinarioContext.Provider({ value: { client: clientRef.current } }, children)
  );
}

export function useBinarioClient(): Binario {
  const context = useContext(BinarioContext);
  if (!context) {
    throw new Error('useBinarioClient must be used within a BinarioProvider');
  }
  return context.client;
}

// ============= useChat Hook (SaaS) =============

export interface UseChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  initialMessages?: Message[];
  onFinish?: (response: any) => void;
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  send: (content?: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  stop: () => void;
}

export function useChat(client: Binario, options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
  }, []);

  const send = useCallback(async (content?: string) => {
    const messageContent = content || input;
    if (!messageContent.trim()) return;

    setIsLoading(true);
    setError(null);
    abortRef.current = false;

    const userMessage: Message = { role: 'user', content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    try {
      const response = await client.chat(newMessages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
      });

      if (abortRef.current) return;

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content || (response as any).choices?.[0]?.message?.content || '',
      };
      setMessages([...newMessages, assistantMessage]);
      options.onFinish?.(response);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      options.onError?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [messages, input, client, options]);

  return { messages, input, setInput, isLoading, error, send, setMessages, stop };
}

// ============= useStream Hook (SaaS) =============

export interface UseStreamOptions extends UseChatOptions {
  onToken?: (token: string) => void;
}

export interface UseStreamReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isStreaming: boolean;
  error: Error | null;
  streamingContent: string;
  send: (content?: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  stop: () => void;
}

export function useStream(client: Binario, options: UseStreamOptions = {}): UseStreamReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  const send = useCallback(async (content?: string) => {
    const messageContent = content || input;
    if (!messageContent.trim()) return;

    setIsStreaming(true);
    setError(null);
    setStreamingContent('');
    abortRef.current = false;

    const userMessage: Message = { role: 'user', content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    let fullContent = '';

    try {
      for await (const token of client.stream(newMessages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
      })) {
        if (abortRef.current) break;
        fullContent += token;
        setStreamingContent(fullContent);
        options.onToken?.(token);
      }

      if (!abortRef.current) {
        const assistantMessage: Message = { role: 'assistant', content: fullContent };
        setMessages([...newMessages, assistantMessage]);
        setStreamingContent('');
        options.onFinish?.({ content: fullContent });
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      options.onError?.(e);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, input, client, options]);

  return { messages, input, setInput, isStreaming, error, streamingContent, send, setMessages, stop };
}

// ============= useAgent Hook (SaaS) =============

export interface UseAgentOptions {
  name?: string;
  systemPrompt?: string;
  tools: AgentOptions['tools'];
  maxIterations?: number;
  model?: string;
  onToolCall?: (tool: string, args: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseAgentReturn {
  output: string;
  isRunning: boolean;
  error: Error | null;
  toolCalls: Array<{ tool: string; args: unknown }>;
  run: (message: string) => Promise<string | null>;
  stop: () => void;
}

export function useAgent(client: Binario, options: UseAgentOptions): UseAgentReturn {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; args: unknown }>>([]);
  const abortRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  const run = useCallback(async (message: string) => {
    setIsRunning(true);
    setError(null);
    setOutput('');
    setToolCalls([]);
    abortRef.current = false;

    try {
      const agent = client.agent({
        name: options.name,
        systemPrompt: options.systemPrompt,
        tools: options.tools,
        maxIterations: options.maxIterations,
        model: options.model,
      });

      const result = await agent.run(message);
      
      if (abortRef.current) return null;

      setOutput(result.output || result.result || '');
      if (result.toolCalls || result.toolResults) {
        const calls = (result.toolCalls || result.toolResults || []).map((tc: any) => ({
          tool: tc.tool || tc.name,
          args: tc.args || tc.arguments,
        }));
        setToolCalls(calls);
        calls.forEach((tc: any) => options.onToolCall?.(tc.tool, tc.args));
      }
      
      return result.output || result.result || '';
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      options.onError?.(e);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [client, options]);

  return { output, isRunning, error, toolCalls, run, stop };
}

// ============= useUsage Hook (SaaS) =============

export interface UseUsageReturn {
  usage: { requestsUsed: number; tokensUsed: number; plan: string } | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useUsage(client: Binario): UseUsageReturn {
  const [usage, setUsage] = useState<UseUsageReturn['usage']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await client.getUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => { refresh(); }, [refresh]);

  return { usage, isLoading, error, refresh };
}
