import { useState, useCallback, useEffect, useRef } from 'react';
import type { ProjectFile } from '@/lib/projectGenerator';
import { sandboxService } from '@/lib/sandboxService';
import { toast } from 'sonner';

export interface PlaygroundProject {
  id: string;
  user_id: string;
  name: string;
  files: Record<string, ProjectFile>;
  template: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Extract a smart project name from the user's first message.
 */
function deriveProjectName(userMessage: string): string {
  const cleaned = userMessage
    .replace(/^(crea|create|build|make|genera|haz|hazme|diseña|design|construye)\s+(me\s+)?(una?\s+)?/i, '')
    .replace(/[^\w\sáéíóúñ]/gi, '')
    .trim();
  if (cleaned.length > 3 && cleaned.length <= 40) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > 40) {
    return cleaned.slice(0, 37) + '...';
  }
  return `Project ${new Date().toLocaleDateString()}`;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-playground-project`;

async function callFn(
  method: string,
  token: string,
  action: string,
  params: Record<string, string> = {},
  body?: unknown
) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function usePlaygroundProject(userId?: string, token?: string) {
  const [project, setProject] = useState<PlaygroundProject | null>(null);
  const [projects, setProjects] = useState<PlaygroundProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAuth = !!(userId && token);

  // Load user's projects list
  const loadProjects = useCallback(async () => {
    if (!hasAuth) return;
    setIsLoading(true);
    try {
      const data = await callFn('GET', token!, 'list');
      setProjects((data || []) as PlaygroundProject[]);
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setIsLoading(false);
    }
  }, [hasAuth, token]);

  // Load a specific project
  const loadProject = useCallback(async (projectId: string) => {
    if (!hasAuth) return null;
    setIsLoading(true);
    try {
      const data = await callFn('GET', token!, 'get', { id: projectId });
      const proj = data as PlaygroundProject;
      setProject(proj);
      return proj;
    } catch (e) {
      console.error('Failed to load project:', e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasAuth, token]);

  // Create a new project
  const createProject = useCallback(async (nameOrMessage: string, files: Record<string, ProjectFile> = {}) => {
    if (!hasAuth) { toast.error('Login required to save projects'); return null; }
    const name = deriveProjectName(nameOrMessage);
    try {
      const data = await callFn('POST', token!, 'create', {}, { name, files });
      const proj = data as PlaygroundProject;
      setProject(proj);
      sandboxService.syncProject(proj.id, userId!, name, files).catch(() => {});
      return proj;
    } catch (e) {
      console.error('Failed to create project:', e);
      toast.error('Failed to create project');
      return null;
    }
  }, [hasAuth, token, userId]);

  // Save files (debounced 500ms)
  const saveFiles = useCallback((files: Record<string, ProjectFile>) => {
    if (!project || !hasAuth) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await callFn('PUT', token!, 'update-files', {}, { id: project.id, files });
        sandboxService.syncProject(project.id, project.user_id, project.name, files).catch(() => {});
      } catch (e) {
        console.error('Auto-save failed:', e);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [project, hasAuth, token]);

  // Rename project
  const renameProject = useCallback(async (name: string) => {
    if (!project || !hasAuth) return;
    try {
      await callFn('PUT', token!, 'rename', {}, { id: project.id, name });
      setProject(prev => prev ? { ...prev, name } : null);
    } catch (e) {
      console.error('Rename failed:', e);
    }
  }, [project, hasAuth, token]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string) => {
    if (!hasAuth) return false;
    try {
      await callFn('DELETE', token!, 'delete', { id: projectId });
      if (project?.id === projectId) setProject(null);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      return true;
    } catch (e) {
      toast.error('Failed to delete project');
      return false;
    }
  }, [hasAuth, token, project]);

  // Auto-load on mount
  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Cleanup
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  return {
    project, projects, isLoading, isSaving,
    loadProjects, loadProject, createProject, saveFiles,
    renameProject, deleteProject, setProject,
  };
}
