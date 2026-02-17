import { useState, useMemo, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractCodeBlocks, buildPreviewDocument, isRenderableCode } from '@/lib/codeExtractor';
import { buildProjectPreview, type ProjectFile } from '@/lib/projectGenerator';
import { PreviewToolbar, type Viewport } from '@/components/PreviewToolbar';
import { PreviewConsole, type ConsoleLog } from '@/components/PreviewConsole';
import { classifyError, type PreviewError } from '@/lib/errorCorrection';
import { exportAsZip, exportAsHtml, exportAsJson, importFromJson } from '@/lib/projectExporter';
import { toast } from 'sonner';

interface CodePreviewProps {
  content?: string;
  files?: Record<string, ProjectFile>;
  className?: string;
  onErrors?: (errors: PreviewError[]) => void;
  onImportProject?: (files: Record<string, ProjectFile>, name: string) => void;
  projectName?: string;
}

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function CodePreview({ content, files, className, onErrors, onImportProject, projectName }: CodePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);

  const previewDoc = useMemo(() => {
    if (files && Object.keys(files).length > 0) {
      return buildProjectPreview(files);
    }
    if (content) {
      const blocks = extractCodeBlocks(content);
      if (isRenderableCode(blocks)) {
        return buildPreviewDocument(blocks);
      }
    }
    return '';
  }, [content, files]);

  const hasFiles = !!files && Object.keys(files).length > 0;

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.source === 'preview-console') {
      const log: ConsoleLog = {
        type: event.data.type || 'log',
        message: event.data.message || '',
        timestamp: Date.now(),
      };
      setConsoleLogs(prev => [...prev.slice(-200), log]);

      if (log.type === 'error' && onErrors) {
        const err: PreviewError = {
          message: log.message,
          type: classifyError(log.message),
          timestamp: log.timestamp,
        };
        onErrors([err]);
      }
    }
  }, [onErrors]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    setConsoleLogs([]);
  }, [refreshKey, previewDoc]);

  const handleImportJson = async (file: File) => {
    const result = await importFromJson(file);
    if (result && onImportProject) {
      onImportProject(result.files, result.name);
      toast.success(`Imported: ${result.name}`);
    } else {
      toast.error('Invalid project file');
    }
  };

  if (!previewDoc) {
    return (
      <div className={cn('flex items-center justify-center h-full min-h-[300px] rounded-xl border border-border bg-secondary/20', className)}>
        <div className="text-center space-y-2 p-6">
          <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No renderable code detected</p>
          <p className="text-xs text-muted-foreground/60">
            Ask the AI to generate HTML, CSS, JS, or React/JSX code to see a live preview here.
          </p>
        </div>
      </div>
    );
  }

  const errorCount = consoleLogs.filter(l => l.type === 'error').length;

  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border border-border overflow-hidden bg-background',
      isFullscreen && 'fixed inset-0 z-50 rounded-none',
      className,
    )}>
      <PreviewToolbar
        viewport={viewport}
        onViewportChange={setViewport}
        isFullscreen={isFullscreen}
        onFullscreenToggle={() => setIsFullscreen(f => !f)}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onDownloadZip={() => files && exportAsZip(files, projectName)}
        onDownloadHtml={() => files && exportAsHtml(files, projectName)}
        onExportJson={() => files && exportAsJson(files, { name: projectName || 'project' })}
        onImportJson={handleImportJson}
        hasFiles={hasFiles}
        errorCount={errorCount}
      />

      <div className="flex-1 flex justify-center bg-muted/20 overflow-auto">
        <iframe
          key={refreshKey}
          srcDoc={previewDoc}
          sandbox="allow-scripts allow-same-origin"
          className="bg-white transition-all duration-300"
          style={{
            width: VIEWPORT_WIDTHS[viewport],
            maxWidth: '100%',
            minHeight: isFullscreen ? 'calc(100vh - 40px)' : '400px',
            height: '100%',
          }}
          title="Code Preview"
        />
      </div>

      <PreviewConsole logs={consoleLogs} onClear={() => setConsoleLogs([])} />
    </div>
  );
}
