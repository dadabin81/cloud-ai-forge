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

// ============= Memory Hooks =============

import type { Memory, MemoryStore, ConversationContext } from './memory/types';
import { BufferMemory } from './memory/buffer';
import { SummaryMemory, type SummarizerFn } from './memory/summary';
import { SummaryBufferMemory } from './memory/summary-buffer';
import { VectorMemory } from './memory/vector';
import { InMemoryStore } from './memory/stores/in-memory';
import { LocalStorageStore } from './memory/stores/local-storage';
import type { EmbeddingsProvider } from './embeddings/types';

export type MemoryType = 'buffer' | 'summary' | 'summary-buffer' | 'vector';

export interface UseBinarioMemoryOptions {
  /** Memory type to use */
  type?: MemoryType;
  /** Conversation ID (auto-generated if not provided) */
  conversationId?: string;
  /** Storage backend: 'memory' | 'localStorage' | custom MemoryStore */
  store?: 'memory' | 'localStorage' | MemoryStore;
  /** LocalStorage prefix (only for localStorage store) */
  storagePrefix?: string;
  /** Max messages to keep (for buffer/summary-buffer) */
  maxMessages?: number;
  /** Max tokens to keep */
  maxTokens?: number;
  /** Buffer size for summary-buffer memory */
  bufferSize?: number;
  /** Summarizer function (required for summary/summary-buffer) */
  summarizer?: SummarizerFn;
  /** Embeddings provider (required for vector memory) */
  embeddings?: EmbeddingsProvider;
  /** Top K results for vector search */
  topK?: number;
  /** Min similarity score for vector search */
  minScore?: number;
}

export interface UseBinarioMemoryReturn {
  /** The memory instance */
  memory: Memory;
  /** Current messages in memory */
  messages: Message[];
  /** Current context (messages + summary + token count) */
  context: ConversationContext | null;
  /** Whether memory is loading */
  isLoading: boolean;
  /** Add a message to memory */
  addMessage: (message: Message) => Promise<void>;
  /** Add multiple messages */
  addMessages: (messages: Message[]) => Promise<void>;
  /** Clear all messages */
  clear: () => Promise<void>;
  /** Refresh messages from memory */
  refresh: () => Promise<void>;
  /** Get context window with token limit */
  getContextWindow: (maxTokens: number) => Promise<ConversationContext>;
  /** Current conversation ID */
  conversationId: string;
  /** Switch to a different conversation */
  switchConversation: (id: string) => void;
}

export function useBinarioMemory(
  options: UseBinarioMemoryOptions = {}
): UseBinarioMemoryReturn {
  const {
    type = 'buffer',
    conversationId: initialConversationId,
    store: storeOption = 'memory',
    storagePrefix = '',
    maxMessages = 50,
    maxTokens = 4000,
    bufferSize = 10,
    summarizer,
    embeddings,
    topK = 5,
    minScore = 0.5,
  } = options;

  // Create store
  const store = useRef<MemoryStore>(
    typeof storeOption === 'string'
      ? storeOption === 'localStorage'
        ? new LocalStorageStore(storagePrefix)
        : new InMemoryStore()
      : storeOption
  );

  // Create memory instance
  const memory = useRef<Memory | null>(null);
  const [conversationId, setConversationId] = useState(
    initialConversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoad = useRef(true);

  // Initialize memory
  useEffect(() => {
    const memoryOptions = {
      store: store.current,
      conversationId,
      maxMessages,
      maxTokens,
    };

    switch (type) {
      case 'summary':
        const summaryMem = new SummaryMemory({ ...memoryOptions, summarizer });
        if (summarizer) summaryMem.setSummarizer(summarizer);
        memory.current = summaryMem;
        break;
      case 'summary-buffer':
        const sbMem = new SummaryBufferMemory({ ...memoryOptions, bufferSize, summarizer });
        if (summarizer) sbMem.setSummarizer(summarizer);
        memory.current = sbMem;
        break;
      case 'vector':
        if (!embeddings) {
          throw new Error('VectorMemory requires an embeddings provider');
        }
        memory.current = new VectorMemory({ ...memoryOptions, embeddings, topK, minScore });
        break;
      default:
        memory.current = new BufferMemory(memoryOptions);
    }

    // Load initial messages
    loadMessages(isInitialLoad.current);
    isInitialLoad.current = false;
  }, [type, conversationId]);

  const loadMessages = useCallback(async (skipLoadingState = false) => {
    if (!memory.current) return;
    if (!skipLoadingState) {
      setIsLoading(true);
    }
    try {
      const msgs = await memory.current.getMessages();
      const ctx = await memory.current.getContext();
      setMessages(msgs);
      setContext(ctx);
    } catch (error) {
      console.error('Failed to load memory:', error);
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
      }
    }
  }, []);

  const addMessage = useCallback(async (message: Message) => {
    if (!memory.current) return;
    await memory.current.add(message);
    await loadMessages();
  }, [loadMessages]);

  const addMessages = useCallback(async (msgs: Message[]) => {
    if (!memory.current) return;
    await memory.current.addMany(msgs);
    await loadMessages();
  }, [loadMessages]);

  const clear = useCallback(async () => {
    if (!memory.current) return;
    await memory.current.clear();
    setMessages([]);
    setContext(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  const getContextWindow = useCallback(async (maxTkns: number) => {
    if (!memory.current) {
      return { messages: [], tokenCount: 0, messageCount: 0 };
    }
    return memory.current.getContextWindow(maxTkns);
  }, []);

  const switchConversation = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  return {
    memory: memory.current!,
    messages,
    context,
    isLoading,
    addMessage,
    addMessages,
    clear,
    refresh,
    getContextWindow,
    conversationId,
    switchConversation,
  };
}

// ============= Chat with Memory Hook =============

export interface UseBinarioChatWithMemoryOptions extends UseBinarioChatOptions {
  /** Memory options */
  memory?: UseBinarioMemoryOptions;
  /** Auto-save messages to memory */
  autoSave?: boolean;
  /** Context window size in tokens */
  contextWindowSize?: number;
}

export interface UseBinarioChatWithMemoryReturn extends UseBinarioChatReturn {
  /** Memory state and controls */
  memory: UseBinarioMemoryReturn;
  /** Load conversation from memory */
  loadConversation: (conversationId?: string) => Promise<void>;
  /** Save current conversation to memory */
  saveConversation: () => Promise<void>;
}

export function useBinarioChatWithMemory(
  binario: BinarioAI,
  options: UseBinarioChatWithMemoryOptions = {}
): UseBinarioChatWithMemoryReturn {
  const {
    memory: memoryOptions = {},
    autoSave = true,
    contextWindowSize = 4000,
    ...chatOptions
  } = options;

  // Initialize memory
  const memoryHook = useBinarioMemory(memoryOptions);

  // Initialize chat with memory messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync memory messages to chat on load
  useEffect(() => {
    if (memoryHook.messages.length > 0 && messages.length === 0) {
      setMessages(memoryHook.messages);
    }
  }, [memoryHook.messages]);

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

      // Auto-save user message
      if (autoSave) {
        await memoryHook.addMessage(message);
      }

      try {
        // Get context-aware messages
        const contextWindow = await memoryHook.getContextWindow(contextWindowSize);
        const contextMessages = contextWindow.messages.length > 0 
          ? contextWindow.messages 
          : newMessages;

        const response = await binario.chat(contextMessages, chatOptions);
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls,
        };
        
        const updatedMessages = [...newMessages, assistantMessage];
        setMessages(updatedMessages);
        setLastResponse(response);

        // Auto-save assistant message
        if (autoSave) {
          await memoryHook.addMessage(assistantMessage);
        }

        chatOptions.onFinish?.(response);
      } catch (err) {
        const error = err as Error;
        setError(error);
        chatOptions.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, binario, chatOptions, autoSave, memoryHook, contextWindowSize]
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
      const response = await binario.chat(messagesToReload, chatOptions);
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      };
      setMessages([...messagesToReload, assistantMessage]);
      setLastResponse(response);
      chatOptions.onFinish?.(response);
    } catch (err) {
      const error = err as Error;
      setError(error);
      chatOptions.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, binario, chatOptions]);

  const loadConversation = useCallback(async (conversationId?: string) => {
    if (conversationId) {
      memoryHook.switchConversation(conversationId);
    }
    await memoryHook.refresh();
    setMessages(memoryHook.messages);
  }, [memoryHook]);

  const saveConversation = useCallback(async () => {
    // Clear and re-add all messages
    await memoryHook.clear();
    await memoryHook.addMessages(messages);
  }, [memoryHook, messages]);

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
    memory: memoryHook,
    loadConversation,
    saveConversation,
  };
}

// ============= Embeddings Hook =============

import type { 
  EmbeddingsProvider, 
  EmbeddingResult, 
  BatchEmbeddingResult 
} from './embeddings/types';
import { CloudflareEmbeddings } from './embeddings/cloudflare';
import { cosineSimilarity } from './memory/utils';

export type EmbeddingsProviderType = 'cloudflare' | 'custom';

export interface UseBinarioEmbedOptions {
  /** Embeddings provider type */
  provider?: EmbeddingsProviderType;
  /** Custom embeddings provider instance */
  customProvider?: EmbeddingsProvider;
  /** Model to use (provider-specific) */
  model?: string;
  /** Cloudflare account ID (for REST API) */
  accountId?: string;
  /** Cloudflare API key (for REST API) */
  apiKey?: string;
  /** Cache embeddings in memory */
  cache?: boolean;
  /** Callback when embedding starts */
  onStart?: () => void;
  /** Callback when embedding completes */
  onComplete?: (result: EmbeddingResult | BatchEmbeddingResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseBinarioEmbedReturn {
  /** Generate embedding for a single text */
  embed: (text: string) => Promise<EmbeddingResult | null>;
  /** Generate embeddings for multiple texts */
  embedMany: (texts: string[]) => Promise<BatchEmbeddingResult | null>;
  /** Calculate similarity between two texts */
  similarity: (text1: string, text2: string) => Promise<number | null>;
  /** Find most similar texts from a list */
  findSimilar: (query: string, candidates: string[], topK?: number) => Promise<Array<{ text: string; score: number }> | null>;
  /** Current embedding result */
  result: EmbeddingResult | null;
  /** Batch embedding results */
  batchResult: BatchEmbeddingResult | null;
  /** Whether embedding is in progress */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Clear cached embeddings */
  clearCache: () => void;
  /** Get embedding from cache */
  getCached: (text: string) => number[] | null;
}

export function useBinarioEmbed(
  options: UseBinarioEmbedOptions = {}
): UseBinarioEmbedReturn {
  const {
    provider: providerType = 'cloudflare',
    customProvider,
    model,
    accountId,
    apiKey,
    cache = true,
    onStart,
    onComplete,
    onError,
  } = options;

  // State
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchEmbeddingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Embedding cache
  const cacheRef = useRef<Map<string, number[]>>(new Map());

  // Provider instance
  const providerRef = useRef<EmbeddingsProvider | null>(null);

  // Initialize provider
  useEffect(() => {
    if (customProvider) {
      providerRef.current = customProvider;
    } else if (providerType === 'cloudflare') {
      providerRef.current = new CloudflareEmbeddings({
        model,
        accountId,
        apiKey,
      });
    }
  }, [providerType, customProvider, model, accountId, apiKey]);

  const embed = useCallback(async (text: string): Promise<EmbeddingResult | null> => {
    if (!providerRef.current) {
      const err = new Error('Embeddings provider not initialized');
      setError(err);
      onError?.(err);
      return null;
    }

    // Check cache
    if (cache && cacheRef.current.has(text)) {
      const cached: EmbeddingResult = {
        text,
        embedding: cacheRef.current.get(text)!,
      };
      setResult(cached);
      return cached;
    }

    setIsLoading(true);
    setError(null);
    onStart?.();

    try {
      const embeddingResult = await providerRef.current.embed(text);
      
      // Cache result
      if (cache) {
        cacheRef.current.set(text, embeddingResult.embedding);
      }
      
      setResult(embeddingResult);
      onComplete?.(embeddingResult);
      return embeddingResult;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [cache, onStart, onComplete, onError]);

  const embedMany = useCallback(async (texts: string[]): Promise<BatchEmbeddingResult | null> => {
    if (!providerRef.current) {
      const err = new Error('Embeddings provider not initialized');
      setError(err);
      onError?.(err);
      return null;
    }

    if (texts.length === 0) {
      return { embeddings: [], model: '', usage: { promptTokens: 0, totalTokens: 0 } };
    }

    // Check cache for all texts
    const uncached: string[] = [];
    const cachedResults: Map<string, number[]> = new Map();
    
    if (cache) {
      for (const text of texts) {
        if (cacheRef.current.has(text)) {
          cachedResults.set(text, cacheRef.current.get(text)!);
        } else {
          uncached.push(text);
        }
      }
    } else {
      uncached.push(...texts);
    }

    setIsLoading(true);
    setError(null);
    onStart?.();

    try {
      let newEmbeddings: BatchEmbeddingResult = { 
        embeddings: [], 
        model: '', 
        usage: { promptTokens: 0, totalTokens: 0 } 
      };
      
      // Only call API for uncached texts
      if (uncached.length > 0) {
        newEmbeddings = await providerRef.current.embedMany(uncached);
        
        // Cache new results
        if (cache) {
          for (const emb of newEmbeddings.embeddings) {
            cacheRef.current.set(emb.text, emb.embedding);
          }
        }
      }

      // Combine cached and new results in original order
      const allEmbeddings: EmbeddingResult[] = texts.map(text => {
        if (cachedResults.has(text)) {
          return { text, embedding: cachedResults.get(text)! };
        }
        const found = newEmbeddings.embeddings.find(e => e.text === text);
        return found || { text, embedding: [] };
      });

      const batchResult: BatchEmbeddingResult = {
        embeddings: allEmbeddings,
        model: newEmbeddings.model,
        usage: newEmbeddings.usage,
      };
      
      setBatchResult(batchResult);
      onComplete?.(batchResult);
      return batchResult;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [cache, onStart, onComplete, onError]);

  const similarity = useCallback(async (text1: string, text2: string): Promise<number | null> => {
    const results = await embedMany([text1, text2]);
    if (!results || results.embeddings.length < 2) {
      return null;
    }
    
    const [emb1, emb2] = results.embeddings;
    return cosineSimilarity(emb1.embedding, emb2.embedding);
  }, [embedMany]);

  const findSimilar = useCallback(async (
    query: string, 
    candidates: string[], 
    topK: number = 5
  ): Promise<Array<{ text: string; score: number }> | null> => {
    if (candidates.length === 0) return [];
    
    // Embed query and all candidates
    const allTexts = [query, ...candidates];
    const results = await embedMany(allTexts);
    
    if (!results || results.embeddings.length === 0) {
      return null;
    }

    const queryEmbedding = results.embeddings[0].embedding;
    const candidateEmbeddings = results.embeddings.slice(1);

    // Calculate similarities
    const similarities = candidateEmbeddings.map((emb, i) => ({
      text: candidates[i],
      score: cosineSimilarity(queryEmbedding, emb.embedding),
    }));

    // Sort by score and take top K
    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }, [embedMany]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const getCached = useCallback((text: string): number[] | null => {
    return cacheRef.current.get(text) ?? null;
  }, []);

  return {
    embed,
    embedMany,
    similarity,
    findSimilar,
    result,
    batchResult,
    isLoading,
    error,
    clearCache,
    getCached,
  };
}

// ============= Semantic Search Hook =============

export interface UseBinarioSemanticSearchOptions extends UseBinarioEmbedOptions {
  /** Minimum similarity score to include in results */
  minScore?: number;
  /** Maximum number of results to return */
  maxResults?: number;
}

export interface SearchDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
}

export interface UseBinarioSemanticSearchReturn {
  /** Add documents to the search index */
  addDocuments: (documents: SearchDocument[]) => Promise<void>;
  /** Search for similar documents */
  search: (query: string) => Promise<SearchResult[]>;
  /** Remove documents by ID */
  removeDocuments: (ids: string[]) => void;
  /** Clear all documents */
  clear: () => void;
  /** Number of indexed documents */
  documentCount: number;
  /** Whether indexing is in progress */
  isIndexing: boolean;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error if any */
  error: Error | null;
}

export function useBinarioSemanticSearch(
  options: UseBinarioSemanticSearchOptions = {}
): UseBinarioSemanticSearchReturn {
  const { minScore = 0.5, maxResults = 10, ...embedOptions } = options;
  
  const { embedMany, clearCache } = useBinarioEmbed(embedOptions);
  
  // Document index with embeddings
  const indexRef = useRef<Map<string, { document: SearchDocument; embedding: number[] }>>(new Map());
  
  const [documentCount, setDocumentCount] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addDocuments = useCallback(async (documents: SearchDocument[]) => {
    if (documents.length === 0) return;
    
    setIsIndexing(true);
    setError(null);

    try {
      const texts = documents.map(d => d.text);
      const embeddings = await embedMany(texts);
      
      if (!embeddings) {
        throw new Error('Failed to generate embeddings');
      }

      for (let i = 0; i < documents.length; i++) {
        indexRef.current.set(documents[i].id, {
          document: documents[i],
          embedding: embeddings.embeddings[i].embedding,
        });
      }

      setDocumentCount(indexRef.current.size);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsIndexing(false);
    }
  }, [embedMany]);

  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (indexRef.current.size === 0) return [];
    
    setIsSearching(true);
    setError(null);

    try {
      const queryEmbeddings = await embedMany([query]);
      
      if (!queryEmbeddings || queryEmbeddings.embeddings.length === 0) {
        throw new Error('Failed to generate query embedding');
      }

      const queryEmbedding = queryEmbeddings.embeddings[0].embedding;

      const results: SearchResult[] = [];
      
      for (const { document, embedding } of indexRef.current.values()) {
        const score = cosineSimilarity(queryEmbedding, embedding);
        
        if (score >= minScore) {
          results.push({ document, score });
        }
      }

      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [embedMany, minScore, maxResults]);

  const removeDocuments = useCallback((ids: string[]) => {
    for (const id of ids) {
      indexRef.current.delete(id);
    }
    setDocumentCount(indexRef.current.size);
  }, []);

  const clear = useCallback(() => {
    indexRef.current.clear();
    clearCache();
    setDocumentCount(0);
  }, [clearCache]);

  return {
    addDocuments,
    search,
    removeDocuments,
    clear,
    documentCount,
    isIndexing,
    isSearching,
    error,
  };
}

// Legacy aliases for backwards compatibility
export { useBinarioChat as useNexusChat };
export { useBinarioStream as useNexusStream };
export { useBinarioCompletion as useNexusCompletion };
