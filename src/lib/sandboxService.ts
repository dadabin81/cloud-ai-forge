// Cloudflare Sandbox Service - Connects frontend to Cloudflare Worker project sync/preview/versions
import { API_CONFIG } from '@/config/api';
import type { ProjectFile } from '@/lib/projectGenerator';

export interface SyncResult {
  success: boolean;
  summary: ProjectSummary;
  version: string;
  changedFiles: string[];
  previewUrl: string;
}

export interface ProjectSummary {
  fileCount: number;
  filePaths: string[];
  components: string[];
  routes: string[];
  hasCSS: boolean;
  hasTailwind: boolean;
  totalSize: number;
}

export interface ProjectVersion {
  id: number;
  project_id: string;
  user_id: string;
  files_hash: string;
  changed_files: string;
  message: string | null;
  created_at: string;
}

class SandboxServiceClient {
  private get baseUrl() { return API_CONFIG.baseUrl; }

  private headers(apiKey?: string): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    return h;
  }

  /**
   * Sync project files from Supabase to Cloudflare KV + create version.
   * Called in background after every Supabase save.
   */
  async syncProject(
    projectId: string,
    userId: string,
    name: string,
    files: Record<string, ProjectFile>,
    message?: string
  ): Promise<SyncResult | null> {
    try {
      // Convert ProjectFile format to plain string map
      const plainFiles: Record<string, string> = {};
      for (const [path, file] of Object.entries(files)) {
        plainFiles[path] = file.code;
      }

      const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/sync`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ projectId, userId, name, files: plainFiles, message }),
      });

      if (!res.ok) {
        console.warn(`Cloudflare sync failed: ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn('Cloudflare sync error (non-blocking):', err);
      return null;
    }
  }

  /**
   * Get the hosted preview URL for a project.
   */
  getPreviewUrl(projectId: string): string {
    return `${this.baseUrl}/v1/projects/${projectId}/preview`;
  }

  /**
   * Get version history for a project.
   */
  async getVersions(projectId: string): Promise<ProjectVersion[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/versions?projectId=${projectId}`, {
        headers: this.headers(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.versions || [];
    } catch {
      return [];
    }
  }

  /**
   * Get project summary (AI context optimization).
   */
  async getSummary(projectId: string): Promise<ProjectSummary | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/projects/${projectId}/summary`, {
        headers: this.headers(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const sandboxService = new SandboxServiceClient();
