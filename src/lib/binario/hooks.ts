// NexusAI React Hooks

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, ChatOptions, ChatResponse, StreamCallbacks } from './types';
import { NexusAI } from './core';

export interface UseNexusChatOptions extends ChatOptions {
  initialMessages?: Message[];
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseNexusChatReturn {
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

export function useNexusChat(
  nexus: NexusAI,
  options: UseNexusChatOptions = {}
): UseNexusChatReturn {
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
        const response = await nexus.chat(newMessages, options);
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
    [messages, nexus, options]
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
      const response = await nexus.chat(messagesToReload, options);
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
  }, [messages, nexus, options]);

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

export interface UseNexusStreamOptions extends ChatOptions {
  initialMessages?: Message[];
  onToken?: (token: string) => void;
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export interface UseNexusStreamReturn {
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

export function useNexusStream(
  nexus: NexusAI,
  options: UseNexusStreamOptions = {}
): UseNexusStreamReturn {
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
        const stream = nexus.streamChat(newMessages, options, callbacks);
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
    [messages, nexus, options]
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

export interface UseNexusCompletionOptions extends ChatOptions {
  onFinish?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

export function useNexusCompletion(
  nexus: NexusAI,
  options: UseNexusCompletionOptions = {}
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
        const response = await nexus.chat(messages, options);
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
    [nexus, options]
  );

  return {
    completion,
    isLoading,
    error,
    complete,
  };
}
