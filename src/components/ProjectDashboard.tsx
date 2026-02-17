import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cloud, ExternalLink, RefreshCw, FileCode, Clock, Loader2, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectFile } from '@/lib/projectGenerator';

interface ProjectDashboardProps {
  projectName: string;
  sandboxStatus: string;
  previewUrl: string | null;
  files: Record<string, ProjectFile>;
  lastDeployUrl?: string;
  isSaving: boolean;
  onSyncToCloud: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  isSyncing: boolean;
}

export function ProjectDashboard({
  projectName, sandboxStatus, previewUrl, files, lastDeployUrl,
  isSaving, onSyncToCloud, onStartServer, onStopServer, isSyncing,
}: ProjectDashboardProps) {
  const fileCount = Object.keys(files).length;
  const statusColors: Record<string, string> = {
    none: 'bg-gray-500', creating: 'bg-yellow-500', ready: 'bg-blue-500',
    running: 'bg-green-500', stopped: 'bg-gray-500', error: 'bg-red-500',
  };

  return (
    <div className="space-y-3 p-3">
      {/* Project info */}
      <div>
        <h3 className="text-sm font-semibold truncate">{projectName || 'Untitled'}</h3>
        <div className="flex items-center gap-2 mt-1">
          <div className={cn('w-2 h-2 rounded-full', statusColors[sandboxStatus] || 'bg-gray-500')} />
          <span className="text-[11px] text-muted-foreground capitalize">{sandboxStatus}</span>
          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-border/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><FileCode className="w-3 h-3" /> Files</p>
          <p className="text-sm font-bold">{fileCount}</p>
        </div>
        <div className="border border-border/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Status</p>
          <p className="text-sm font-bold capitalize">{sandboxStatus}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" onClick={onSyncToCloud} disabled={isSyncing || fileCount === 0}>
          {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
          {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
        </Button>

        {sandboxStatus === 'ready' && (
          <Button size="sm" className="w-full h-7 text-xs gap-1.5" onClick={onStartServer}>
            <Play className="w-3 h-3" /> Start Dev Server
          </Button>
        )}

        {sandboxStatus === 'running' && (
          <Button size="sm" variant="destructive" className="w-full h-7 text-xs gap-1.5" onClick={onStopServer}>
            <Square className="w-3 h-3" /> Stop Server
          </Button>
        )}
      </div>

      {/* Preview URL */}
      {previewUrl && (
        <div className="border border-border/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground mb-1">Cloud Preview</p>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{previewUrl}</span>
          </a>
        </div>
      )}

      {/* Last deploy */}
      {lastDeployUrl && (
        <div className="border border-border/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground mb-1">Last Deploy</p>
          <a href={lastDeployUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lastDeployUrl}</span>
          </a>
        </div>
      )}
    </div>
  );
}
