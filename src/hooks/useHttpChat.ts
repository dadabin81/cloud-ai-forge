import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/contexts/AuthContext';
import type { ProjectFile } from '@/lib/projectGenerator';
import { buildFileContextPrompt } from '@/lib/incrementalParser';
import { parseActions, executeAllActions, detectUserIntent } from '@/lib/chatActions';
import { suggestTemplate } from '@/lib/templates';
import { exportAsZip } from '@/lib/projectExporter';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface UseHttpChatOptions {
  getApiKey: () => string;
  selectedModel: string;
  selectedProvider: string;
  systemPrompt: string;
  onMessages: (updater: (prev: Message[]) => Message[]) => void;
  onStreamingContent: (content: string) => void;
  onThinking: (thinking: boolean) => void;
  onTokensPerSecond: (tps: number | null) => void;
  getMessages: () => Message[];
  getProjectFiles: () => Record<string, ProjectFile>;
  projectName?: string;
  firstUserMessageRef: React.MutableRefObject<string | null>;
  setIsApiKeyValid: (valid: boolean) => void;
}

export function useHttpChat({
  getApiKey,
  selectedModel,
  selectedProvider,
  systemPrompt,
  onMessages,
  onStreamingContent,
  onThinking,
  onTokensPerSecond,
  getMessages,
  getProjectFiles,
  projectName,
  firstUserMessageRef,
  setIsApiKeyValid,
}: UseHttpChatOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');
  const tokenCountRef = useRef(0);
  const streamStartTimeRef = useRef<number | null>(null);

  const sendHttp = useCallback(async (content: string) => {
    const effectiveApiKey = getApiKey();
    if (!effectiveApiKey.trim()) { toast.error('Please enter your API key'); return; }

    if (!firstUserMessageRef.current) {
      firstUserMessageRef.current = content;
    }

    const userMessage: Message = { role: 'user', content };
    const projectFiles = getProjectFiles();
    const hasFiles = Object.keys(projectFiles).length > 0;
    const intent = detectUserIntent(content, hasFiles);

    if (intent === 'deploy') {
      onMessages(prev => [...prev, userMessage, {
        role: 'assistant',
        content: '🚀 Para deployar tu proyecto, usa el botón **Deploy** en la barra superior del preview. Ahí puedes configurar Cloudflare Pages u otro proveedor.',
        timestamp: Date.now(),
      }]);
      return;
    }

    if (intent === 'export') {
      onMessages(prev => [...prev, userMessage]);
      if (hasFiles) {
        try {
          exportAsZip(projectFiles, projectName || 'project');
          onMessages(prev => [...prev, { role: 'assistant', content: '📦 ¡Proyecto exportado como ZIP!', timestamp: Date.now() }]);
        } catch {
          onMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error al exportar. Intenta de nuevo.', timestamp: Date.now() }]);
        }
      } else {
        onMessages(prev => [...prev, { role: 'assistant', content: '⚠️ No hay archivos para exportar. Crea un proyecto primero.', timestamp: Date.now() }]);
      }
      return;
    }

    const fileContext = buildFileContextPrompt(projectFiles);
    let templateContext = '';
    if (intent === 'new_project') {
      const suggested = suggestTemplate(content);
      if (suggested) {
        templateContext = `\n\n[TEMPLATE SUGGESTION: The "${suggested.name}" template (${suggested.description}) is available. You can use it as a starting point or create from scratch based on the user's description.]`;
      }
    }

    const fullSystemPrompt = systemPrompt + fileContext + templateContext;
    const messages = getMessages();
    const allMessages = [
      ...(fullSystemPrompt ? [{ role: 'system' as const, content: fullSystemPrompt }] : []),
      ...messages,
      userMessage,
    ];

    onMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    onThinking(true);
    streamingContentRef.current = '';
    onStreamingContent('');
    tokenCountRef.current = 0;
    streamStartTimeRef.current = null;
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveApiKey}` },
        body: JSON.stringify({ messages: allMessages, model: selectedModel, provider: selectedProvider, stream: true }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('API key inválida. Regenera tu API key desde el Dashboard.');
          setIsApiKeyValid(false);
          onMessages(prev => prev.slice(0, -1));
          return;
        }
        if (response.status === 429) { toast.error('Límite de peticiones excedido.'); return; }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.choices?.[0]?.delta?.content;
                  if (token) {
                    if (!streamStartTimeRef.current) { onThinking(false); streamStartTimeRef.current = Date.now(); }
                    streamingContentRef.current += token;
                    tokenCountRef.current += 1;
                    onStreamingContent(streamingContentRef.current);
                    const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
                    if (elapsed > 0.5) onTokensPerSecond(Math.round(tokenCountRef.current / elapsed));
                  }
                } catch { /* ignore */ }
              }
            }
          }
        }
      } else {
        onThinking(false);
        const data = await response.json();
        const assistantContent = data.choices?.[0]?.message?.content || '';
        const { cleanText, actions } = parseActions(assistantContent);
        onMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
        if (actions.length > 0) {
          const results = await executeAllActions(actions, effectiveApiKey);
          for (const result of results) {
            onMessages(prev => [...prev, { role: 'assistant', content: result.summary, timestamp: Date.now() }]);
          }
        }
        onStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
        return;
      }

      const finalContent = streamingContentRef.current;
      const { cleanText, actions } = parseActions(finalContent);
      onMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
      onStreamingContent('');
      if (actions.length > 0) {
        const results = await executeAllActions(actions, effectiveApiKey);
        for (const result of results) {
          onMessages(prev => [...prev, { role: 'assistant', content: result.summary, timestamp: Date.now() }]);
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Chat error:', error);
        toast.error('Failed to get response');
      }
    } finally {
      setIsLoading(false);
      onThinking(false);
      streamingContentRef.current = '';
      onStreamingContent('');
      onTokensPerSecond(null);
      abortControllerRef.current = null;
    }
  }, [getApiKey, selectedModel, selectedProvider, systemPrompt, onMessages, onStreamingContent, onThinking, onTokensPerSecond, getMessages, getProjectFiles, projectName, firstUserMessageRef, setIsApiKeyValid]);

  const stopHttp = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { isLoading, sendHttp, stopHttp };
}
