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
      setModels({
        cloudflare: [
          { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tier: 'free', provider: 'cloudflare' },
          { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', provider: 'cloudflare' },
        ],
      });
      setAllModels([
        { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tier: 'free', provider: 'cloudflare' },
        { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', tier: 'pro', provider: 'cloudflare' },
      ]);
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
