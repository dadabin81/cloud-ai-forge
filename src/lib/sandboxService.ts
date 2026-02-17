// Cloudflare Sandbox Service - Connects frontend to Durable Object SandboxProject
import { API_CONFIG } from '@/config/api';
import type { ProjectFile } from '@/lib/projectGenerator';

export interface SandboxProject {
  id: string;
  name: string;
  template: string;
  status: 'creating' | 'ready' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  createdAt: string;
}

export interface SandboxStatus {
  status: string;
  files: string[];
  previewUrl?: string;
  logs?: string[];
}

export interface SandboxExecResult {
  output: string;
  exitCode: number;
}

class SandboxServiceClient {
  private get baseUrl() { return API_CONFIG.baseUrl; }

  private headers(apiKey: string): HeadersInit {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  }

  async createProject(name: string, template: string, apiKey: string): Promise<SandboxProject> {
    const res = await fetch(`${this.baseUrl}/v1/projects`, {
      method: 'POST', headers: this.headers(apiKey),
      body: JSON.stringify({ name, template }),
    });
    if (!res.ok) throw new Error(`Failed to create sandbox: ${res.statusText}`);
    return res.json();
  }

  async getStatus(projectId: string, apiKey: string): Promise<SandboxStatus> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/status`, { headers: this.headers(apiKey) });
    if (!res.ok) throw new Error(`Failed to get sandbox status: ${res.statusText}`);
    return res.json();
  }

  async writeFiles(projectId: string, files: Record<string, ProjectFile>, apiKey: string): Promise<void> {
    const payload = Object.entries(files).map(([path, file]) => ({ path, content: file.code }));
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/files`, {
      method: 'PUT', headers: this.headers(apiKey),
      body: JSON.stringify({ files: payload }),
    });
    if (!res.ok) throw new Error(`Failed to write files: ${res.statusText}`);
  }

  async readFiles(projectId: string, apiKey: string): Promise<Record<string, ProjectFile>> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/files`, { headers: this.headers(apiKey) });
    if (!res.ok) throw new Error(`Failed to read files: ${res.statusText}`);
    const data = await res.json();
    const result: Record<string, ProjectFile> = {};
    for (const f of data.files || []) {
      const ext = f.path.split('.').pop()?.toLowerCase() || '';
      const langMap: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', html: 'html', css: 'css', json: 'json', md: 'markdown', py: 'python' };
      result[f.path] = { code: f.content, language: langMap[ext] || 'text' };
    }
    return result;
  }

  async execCommand(projectId: string, command: string, apiKey: string): Promise<SandboxExecResult> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/exec`, {
      method: 'POST', headers: this.headers(apiKey),
      body: JSON.stringify({ command }),
    });
    if (!res.ok) throw new Error(`Command execution failed: ${res.statusText}`);
    return res.json();
  }

  async startDevServer(projectId: string, apiKey: string): Promise<{ previewUrl: string }> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/start`, {
      method: 'POST', headers: this.headers(apiKey),
    });
    if (!res.ok) throw new Error(`Failed to start dev server: ${res.statusText}`);
    return res.json();
  }

  async stopDevServer(projectId: string, apiKey: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/stop`, {
      method: 'POST', headers: this.headers(apiKey),
    });
    if (!res.ok) throw new Error(`Failed to stop dev server: ${res.statusText}`);
  }

  async getPreviewUrl(projectId: string, apiKey: string): Promise<string | null> {
    try {
      const status = await this.getStatus(projectId, apiKey);
      return status.previewUrl || null;
    } catch { return null; }
  }

  async deploy(projectId: string, apiKey: string): Promise<{ url: string; deployId: string }> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/deploy`, {
      method: 'POST', headers: this.headers(apiKey),
    });
    if (!res.ok) throw new Error(`Deployment failed: ${res.statusText}`);
    return res.json();
  }
}

export const sandboxService = new SandboxServiceClient();
