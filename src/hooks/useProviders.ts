import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/contexts/AuthContext';

export interface Provider {
  id: string;
  name: string;
  configured: boolean;
  free: boolean;
}

export interface Model {
  id: string;
  name: string;
  tier: string;
  provider: string;
  neurons_per_m_input?: number;
  neurons_per_m_output?: number;
  capabilities?: string[];
  context_window?: number;
}

export interface ProvidersStatus {
  providers: Record<string, { available: boolean; configured: boolean; name: string }>;
  defaultProvider: string;
  websocket: { enabled: boolean; durableObjects: boolean };
}

export interface UseProvidersReturn {
  providers: Provider[];
  models: Record<string, Model[]>;
  allModels: Model[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getModelsForProvider: (providerId: string) => Model[];
  isProviderConfigured: (providerId: string) => boolean;
}

export function useProviders(): UseProvidersReturn {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Record<string, Model[]>>({});
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProvidersAndModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both endpoints in parallel
      const [statusRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/providers/status`),
        fetch(`${API_BASE_URL}/v1/models`),
      ]);

      if (!statusRes.ok) {
        throw new Error(`Failed to fetch providers status: ${statusRes.status}`);
      }

      if (!modelsRes.ok) {
        throw new Error(`Failed to fetch models: ${modelsRes.status}`);
      }

      const status: ProvidersStatus = await statusRes.json();
      const modelsData: { models: Model[] } = await modelsRes.json();

      // Build providers list from status
      const availableProviders: Provider[] = Object.entries(status.providers)
        .map(([id, info]) => ({
          id,
          name: info.name,
          configured: info.configured,
          free: id === 'cloudflare', // Cloudflare is free tier
        }))
        .sort((a, b) => {
          // Sort: configured first, then by name
          if (a.configured !== b.configured) return a.configured ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      // Group models by provider
      const modelsByProvider: Record<string, Model[]> = {};
      for (const model of modelsData.models) {
        const provider = model.provider || 'cloudflare';
        if (!modelsByProvider[provider]) {
          modelsByProvider[provider] = [];
        }
        modelsByProvider[provider].push(model);
      }

      setProviders(availableProviders);
      setModels(modelsByProvider);
      setAllModels(modelsData.models);
    } catch (err) {
      console.error('Failed to fetch providers/models:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback to default Cloudflare provider if fetch fails
      setProviders([
        { id: 'cloudflare', name: 'Cloudflare Workers AI', configured: true, free: true },
      ]);
      const fallbackModels: Model[] = [
        { id: '@cf/meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 2457, neurons_per_m_output: 18252, capabilities: ['chat'], context_window: 131072 },
        { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 4625, neurons_per_m_output: 34375, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 4119, neurons_per_m_output: 30623, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', name: 'Llama 3.1 8B Fast', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 4119, neurons_per_m_output: 30623, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 26668, neurons_per_m_output: 204805, capabilities: ['chat', 'code', 'reasoning'], context_window: 131072 },
        { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 10000, neurons_per_m_output: 75000, capabilities: ['chat', 'code', 'vision'], context_window: 131072 },
        { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 15000, neurons_per_m_output: 112000, capabilities: ['chat', 'reasoning'], context_window: 65536 },
        { id: '@cf/qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 15000, neurons_per_m_output: 112000, capabilities: ['code'], context_window: 131072 },
      ];
      setModels({ cloudflare: fallbackModels });
      setAllModels(fallbackModels);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProvidersAndModels();
  }, [fetchProvidersAndModels]);

  const getModelsForProvider = useCallback(
    (providerId: string): Model[] => {
      return models[providerId] || [];
    },
    [models]
  );

  const isProviderConfigured = useCallback(
    (providerId: string): boolean => {
      const provider = providers.find((p) => p.id === providerId);
      return provider?.configured ?? false;
    },
    [providers]
  );

  return {
    providers,
    models,
    allModels,
    isLoading,
    error,
    refetch: fetchProvidersAndModels,
    getModelsForProvider,
    isProviderConfigured,
  };
}
