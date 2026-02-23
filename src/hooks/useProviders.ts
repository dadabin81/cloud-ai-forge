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
      
      // Fallback to default Cloudflare-only provider
      setProviders([
        { id: 'cloudflare', name: 'Cloudflare Workers AI', configured: true, free: true },
      ]);
      const fallbackModels: Model[] = [
        { id: '@cf/ibm-granite/granite-4.0-h-micro', name: 'Granite Micro', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 1542, neurons_per_m_output: 10158, capabilities: ['chat'], context_window: 8192 },
        { id: '@cf/meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 2457, neurons_per_m_output: 18252, capabilities: ['chat'], context_window: 131072 },
        { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 4625, neurons_per_m_output: 30475, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', name: 'Llama 3.1 8B Fast', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 4119, neurons_per_m_output: 34868, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/openai/gpt-oss-20b', name: 'GPT-OSS 20B', tier: 'free', provider: 'cloudflare', neurons_per_m_input: 18182, neurons_per_m_output: 27273, capabilities: ['chat', 'code'], context_window: 131072 },
        { id: '@cf/qwen/qwen3-30b-a3b-fp8', name: 'Qwen3 30B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 4625, neurons_per_m_output: 30475, capabilities: ['chat', 'code', 'reasoning'], context_window: 131072 },
        { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 26668, neurons_per_m_output: 204805, capabilities: ['chat', 'code', 'reasoning'], context_window: 131072 },
        { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 24545, neurons_per_m_output: 77273, capabilities: ['chat', 'code', 'vision'], context_window: 131072 },
        { id: '@cf/openai/gpt-oss-120b', name: 'GPT-OSS 120B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 31818, neurons_per_m_output: 68182, capabilities: ['chat', 'reasoning'], context_window: 131072 },
        { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B', tier: 'pro', provider: 'cloudflare', neurons_per_m_input: 45170, neurons_per_m_output: 443756, capabilities: ['chat', 'reasoning'], context_window: 65536 },
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
