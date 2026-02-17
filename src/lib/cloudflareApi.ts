// Binario Cloudflare API Client
// Typed methods for all backend endpoints

import { API_CONFIG } from '@/config/api';

export interface HealthStatus {
  status: string;
  version: string;
  bindings: {
    ai: boolean;
    d1: boolean;
    kv: boolean;
    vectorize: boolean;
    workflows: boolean;
    durableObjects: boolean;
  };
  timestamp: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  provider: string;
  contextWindow?: number;
  supportsTools?: boolean;
}

export interface RAGIngestResponse {
  success: boolean;
  documentId: string;
  chunks: number;
  message: string;
}

export interface RAGSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RAGQueryResponse {
  answer: string;
  sources: RAGSearchResult[];
  model: string;
}

export interface WorkflowInstance {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'errored';
  output?: unknown;
  error?: string;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'errored';
  output?: string;
}

export interface SandboxProject {
  id: string;
  name: string;
  template: string;
  files: string[];
  createdAt: string;
}

class CloudflareApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = API_CONFIG.baseUrl;
    this.apiKey = apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error((err as { error: string }).error || `API error ${response.status}`);
    }
    return response.json();
  }

  // Health & Status
  async healthCheck(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getModels(): Promise<{ models: ModelInfo[] }> {
    return this.request('/v1/models');
  }

  async getProviderStatus(): Promise<{ providers: Array<{ id: string; name: string; configured: boolean; free: boolean }> }> {
    return this.request('/v1/providers/status');
  }

  // RAG (Vectorize)
  async ragIngest(content: string, metadata?: Record<string, string>): Promise<RAGIngestResponse> {
    return this.request('/v1/rag/ingest', {
      method: 'POST',
      body: JSON.stringify({ content, metadata }),
    });
  }

  async ragSearch(query: string, topK = 5): Promise<{ results: RAGSearchResult[] }> {
    return this.request('/v1/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, topK }),
    });
  }

  async ragQuery(query: string): Promise<RAGQueryResponse> {
    return this.request('/v1/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Workflows
  async workflowResearch(topic: string): Promise<{ instanceId: string }> {
    return this.request('/v1/workflows/research', {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
  }

  async workflowRAGIngest(url: string): Promise<{ instanceId: string }> {
    return this.request('/v1/workflows/rag-ingest', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async workflowStatus(instanceId: string): Promise<WorkflowInstance> {
    return this.request(`/v1/workflows/status/${instanceId}`);
  }

  // Sandbox Projects (Durable Objects)
  async projectCreate(name: string, template: string): Promise<SandboxProject> {
    return this.request('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, template }),
    });
  }

  async projectList(): Promise<{ projects: SandboxProject[] }> {
    return this.request('/v1/projects');
  }

  async projectFiles(projectId: string): Promise<{ files: Array<{ path: string; content: string }> }> {
    return this.request(`/v1/projects/${projectId}/files`);
  }

  // Usage
  async getUsage(): Promise<{ neurons: { used: number; limit: number; remaining: number }; requests: number }> {
    return this.request('/v1/usage');
  }
}

export const createCloudflareApi = (apiKey: string) => new CloudflareApiClient(apiKey);
export type { CloudflareApiClient };
