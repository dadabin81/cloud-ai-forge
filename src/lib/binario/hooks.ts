// Binario React Hooks

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, ChatOptions, ChatResponse, StreamCallbacks } from './types';
import { BinarioAI } from './core';
import { Agent } from './agent';
import type { z } from 'zod';

// ============= Chat Hook =============

export interface UseBinarioChatOptions extends ChatOptions {
  initialMessages?: Message[];
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseBinarioChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  append: (message: Message) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  setMessages: (messages: Message[]) => void;
  lastResponse: ChatResponse | null;
}

export function useBinarioChat(
  binario: BinarioAI,
  options: UseBinarioChatOptions = {}
): UseBinarioChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const append = useCallback(
    async (message: Message) => {
      setIsLoading(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      const newMessages = [...messages, message];
      setMessages(newMessages);

      try {
        const response = await binario.chat(newMessages, options);
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls,
        };
        setMessages([...newMessages, assistantMessage]);
        setLastResponse(response);
        options.onFinish?.(response);
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, binario, options]
  );

  const reload = useCallback(async () => {
    if (messages.length === 0) return;

    const lastUserMessageIndex = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserMessageIndex === -1) return;

    const messagesToReload = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(messagesToReload);

    setIsLoading(true);
    setError(null);

    try {
      const response = await binario.chat(messagesToReload, options);
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      };
      setMessages([...messagesToReload, assistantMessage]);
      setLastResponse(response);
      options.onFinish?.(response);
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, binario, options]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    append,
    reload,
    stop,
    setMessages,
    lastResponse,
  };
}

// ============= Stream Hook =============

export interface UseBinarioStreamOptions extends ChatOptions {
  initialMessages?: Message[];
  onToken?: (token: string) => void;
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseBinarioStreamReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isStreaming: boolean;
  error: Error | null;
  streamingContent: string;
  send: (content: string) => Promise<void>;
  stop: () => void;
  setMessages: (messages: Message[]) => void;
}

export function useBinarioStream(
  binario: BinarioAI,
  options: UseBinarioStreamOptions = {}
): UseBinarioStreamReturn {
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

  const send = useCallback(
    async (content: string) => {
      setIsStreaming(true);
      setError(null);
      setStreamingContent('');
      abortRef.current = false;

      const userMessage: Message = { role: 'user', content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      let fullContent = '';

      const callbacks: StreamCallbacks = {
        onToken: (token) => {
          if (abortRef.current) return;
          fullContent += token;
          setStreamingContent(fullContent);
          options.onToken?.(token);
        },
        onComplete: (response) => {
          const assistantMessage: Message = { role: 'assistant', content: fullContent };
          setMessages([...newMessages, assistantMessage]);
          setStreamingContent('');
          options.onFinish?.(response);
        },
        onError: (err) => {
          setError(err);
          options.onError?.(err);
        },
      };

      try {
        const stream = binario.streamChat(newMessages, options, callbacks);
        for await (const _ of stream) {
          if (abortRef.current) break;
        }
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, binario, options]
  );

  return {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    streamingContent,
    send,
    stop,
    setMessages,
  };
}

// ============= Completion Hook =============

export interface UseBinarioCompletionOptions extends ChatOptions {
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export function useBinarioCompletion(
  binario: BinarioAI,
  options: UseBinarioCompletionOptions = {}
) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const complete = useCallback(
    async (prompt: string, systemPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      setCompletion('');

      const messages: Message[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      try {
        const response = await binario.chat(messages, options);
        setCompletion(response.content);
        options.onFinish?.(response);
        return response.content;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [binario, options]
  );

  return {
    completion,
    isLoading,
    error,
    complete,
  };
}

// ============= Agent Hook =============

export interface UseBinarioAgentOptions {
  onStep?: (step: { type: string; content: string }) => void;
  onToolCall?: (tool: { name: string; args: unknown }) => void;
  onError?: (error: Error) => void;
  maxSteps?: number;
}

export interface UseBinarioAgentReturn<TContext> {
  output: string;
  isRunning: boolean;
  error: Error | null;
  steps: Array<{ type: string; content: string }>;
  run: (input: string, context?: TContext) => Promise<string | null>;
  runStructured: <T>(input: string, schema: z.ZodType<T>, context?: TContext) => Promise<T | null>;
  stop: () => void;
}

export function useBinarioAgent<TContext = unknown, TDeps = unknown>(
  agent: Agent<TContext, TDeps>,
  options: UseBinarioAgentOptions = {}
): UseBinarioAgentReturn<TContext> {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [steps, setSteps] = useState<Array<{ type: string; content: string }>>([]);
  const abortRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  const run = useCallback(
    async (input: string, context?: TContext) => {
      setIsRunning(true);
      setError(null);
      setOutput('');
      setSteps([]);
      abortRef.current = false;

      try {
        const agentWithContext = context ? agent.withContext(context) : agent;
        const result = await agentWithContext.run(input, { 
          maxSteps: options.maxSteps,
          onStep: (step) => {
            if (abortRef.current) return;
            setSteps(prev => [...prev, step]);
            options.onStep?.(step);
          },
        });
        setOutput(result.output);
        return result.output;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [agent, options]
  );

  const runStructured = useCallback(
    async <T,>(input: string, schema: z.ZodType<T>, context?: TContext) => {
      setIsRunning(true);
      setError(null);
      setOutput('');
      setSteps([]);
      abortRef.current = false;

      try {
        const agentWithContext = context ? agent.withContext(context) : agent;
        const result = await agentWithContext.runStructured(input, schema, {
          maxSteps: options.maxSteps,
        });
        setOutput(JSON.stringify(result.output, null, 2));
        return result.output;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [agent, options]
  );

  return {
    output,
    isRunning,
    error,
    steps,
    run,
    runStructured,
    stop,
  };
}

// ============= Structured Output Hook =============

export interface UseBinarioStructuredOptions<T> extends ChatOptions {
  schema: z.ZodType<T>;
  onFinish?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseBinarioStructuredReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  generate: (prompt: string, systemPrompt?: string) => Promise<T | null>;
}

export function useBinarioStructured<T>(
  binario: BinarioAI,
  options: UseBinarioStructuredOptions<T>
): UseBinarioStructuredReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(
    async (prompt: string, systemPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      setData(null);

      const messages: Message[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      try {
        const response = await binario.chat(messages, {
          ...options,
          outputSchema: options.schema,
        });
        
        const parsedData = response.data as T;
        setData(parsedData);
        options.onFinish?.(parsedData);
        return parsedData;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [binario, options]
  );

  return {
    data,
    isLoading,
    error,
    generate,
  };
}

// ============= Tools Hook =============

import { zodToJsonSchema } from './schema';

export interface HookTool {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  execute: (args: unknown) => Promise<unknown> | unknown;
}

export interface UseBinarioToolsOptions {
  tools: HookTool[];
  provider?: string;
  model?: string;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseBinarioToolsReturn {
  messages: Message[];
  isProcessing: boolean;
  error: Error | null;
  send: (content: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
}

export function useBinarioTools(
  binario: BinarioAI,
  options: UseBinarioToolsOptions
): UseBinarioToolsReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const send = useCallback(
    async (content: string) => {
      setIsProcessing(true);
      setError(null);

      const userMessage: Message = { role: 'user', content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      try {
        // Convert tools to API format using zodToJsonSchema
        const apiTools = options.tools.map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.parameters) as Record<string, unknown>,
          },
        }));

        let currentMessages = newMessages;
        let continueLoop = true;

        while (continueLoop) {
          const response = await binario.chat(currentMessages, {
            provider: options.provider as import('./types').Provider,
            model: options.model,
            tools: apiTools,
          });

          if (response.toolCalls && response.toolCalls.length > 0) {
            // Execute tools
            const toolResults: Message[] = [];
            
            for (const toolCall of response.toolCalls) {
              const tool = options.tools.find(t => t.name === toolCall.function.name);
              if (tool) {
                const args = JSON.parse(toolCall.function.arguments);
                options.onToolCall?.(toolCall.function.name, args);
                
                const result = await tool.execute(args);
                options.onToolResult?.(toolCall.function.name, result);
                
                toolResults.push({
                  role: 'tool',
                  content: JSON.stringify(result),
                  tool_call_id: toolCall.id,
                });
              }
            }

            // Add assistant message with tool calls
            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content, tool_calls: response.toolCalls },
              ...toolResults,
            ];
          } else {
            // No more tool calls, add final response
            const assistantMessage: Message = {
              role: 'assistant',
              content: response.content,
            };
            currentMessages = [...currentMessages, assistantMessage];
            continueLoop = false;
          }
        }

        setMessages(currentMessages);
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [messages, binario, options]
  );

  return {
    messages,
    isProcessing,
    error,
    send,
    setMessages,
  };
}

// Legacy aliases for backwards compatibility
export { useBinarioChat as useNexusChat };
export { useBinarioStream as useNexusStream };
export { useBinarioCompletion as useNexusCompletion };
