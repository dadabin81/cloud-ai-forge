import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectFile } from '@/lib/projectGenerator';
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

export function usePlaygroundProject() {
  const [project, setProject] = useState<PlaygroundProject | null>(null);
  const [projects, setProjects] = useState<PlaygroundProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load user's projects list
  const loadProjects = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('playground_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    setIsLoading(false);
    if (error) { console.error('Failed to load projects:', error); return; }
    setProjects((data || []) as unknown as PlaygroundProject[]);
  }, []);

  // Load a specific project
  const loadProject = useCallback(async (projectId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('playground_projects')
      .select('*')
      .eq('id', projectId)
      .single();
    setIsLoading(false);
    if (error) { console.error('Failed to load project:', error); return null; }
    const proj = data as unknown as PlaygroundProject;
    setProject(proj);
    return proj;
  }, []);

  // Create a new project
  const createProject = useCallback(async (name: string = 'Untitled Project', files: Record<string, ProjectFile> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Login required to save projects'); return null; }
    
    const { data, error } = await supabase
      .from('playground_projects')
      .insert([{ user_id: user.id, name, files: JSON.parse(JSON.stringify(files)) }])
      .select()
      .single();
    if (error) { console.error('Failed to create project:', error); toast.error('Failed to create project'); return null; }
    const proj = data as unknown as PlaygroundProject;
    setProject(proj);
    return proj;
  }, []);

  // Save files to current project (debounced)
  const saveFiles = useCallback((files: Record<string, ProjectFile>) => {
    if (!project) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      const { error } = await supabase
        .from('playground_projects')
        .update({ files: JSON.parse(JSON.stringify(files)) })
        .eq('id', project.id);
      setIsSaving(false);
      if (error) console.error('Auto-save failed:', error);
    }, 2000);
  }, [project]);

  // Rename project
  const renameProject = useCallback(async (name: string) => {
    if (!project) return;
    const { error } = await supabase
      .from('playground_projects')
      .update({ name })
      .eq('id', project.id);
    if (!error) setProject(prev => prev ? { ...prev, name } : null);
  }, [project]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase
      .from('playground_projects')
      .delete()
      .eq('id', projectId);
    if (error) { toast.error('Failed to delete project'); return false; }
    if (project?.id === projectId) setProject(null);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    return true;
  }, [project]);

  // Auto-load projects on mount
  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Cleanup
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  return {
    project,
    projects,
    isLoading,
    isSaving,
    loadProjects,
    loadProject,
    createProject,
    saveFiles,
    renameProject,
    deleteProject,
    setProject,
  };
}
