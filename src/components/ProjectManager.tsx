import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, Clock, FileCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PlaygroundProject } from '@/hooks/usePlaygroundProject';
import type { ProjectFile } from '@/lib/projectGenerator';

interface ProjectManagerProps {
  projects: PlaygroundProject[];
  currentProjectId?: string;
  onLoadProject: (projectId: string) => Promise<PlaygroundProject | null>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
  onNewProject: () => void;
  onProjectLoaded: (project: PlaygroundProject) => void;
  isLoading?: boolean;
}

export function ProjectManager({
  projects,
  currentProjectId,
  onLoadProject,
  onDeleteProject,
  onNewProject,
  onProjectLoaded,
  isLoading,
}: ProjectManagerProps) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    const proj = await onLoadProject(id);
    setLoadingId(null);
    if (proj) {
      onProjectLoaded(proj);
      setOpen(false);
      toast.success(`Opened: ${proj.name}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    const ok = await onDeleteProject(id);
    setDeletingId(null);
    if (ok) toast.success('Project deleted');
  };

  const fileCount = (files: any) => {
    if (!files || typeof files !== 'object') return 0;
    return Object.keys(files).length;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1">
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">Projects</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" /> My Projects
          </DialogTitle>
          <DialogDescription>Manage your saved playground projects</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-dashed"
            onClick={() => { onNewProject(); setOpen(false); }}
          >
            <Plus className="w-4 h-4" /> New Project
          </Button>

          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && projects.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No projects yet</p>
          )}

          {projects.map(p => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors',
                p.id === currentProjectId && 'border-primary/50 bg-primary/5'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <FileCode className="w-3 h-3" /> {fileCount(p.files)} files
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" /> {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                  {p.template && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{p.template}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleLoad(p.id)}
                  disabled={loadingId === p.id || p.id === currentProjectId}
                >
                  {loadingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Open'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
