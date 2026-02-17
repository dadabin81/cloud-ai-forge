import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractCodeBlocks, buildPreviewDocument, isRenderableCode } from '@/lib/codeExtractor';
import { buildProjectPreview, type ProjectFile } from '@/lib/projectGenerator';
import { PreviewToolbar, type Viewport } from '@/components/PreviewToolbar';
import { downloadProjectAsHtml } from '@/lib/projectGenerator';

interface CodePreviewProps {
  /** Raw message content (markdown with code blocks) - legacy mode */
  content?: string;
  /** Multi-file project - takes priority over content */
  files?: Record<string, ProjectFile>;
  className?: string;
}

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function CodePreview({ content, files, className }: CodePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const previewDoc = useMemo(() => {
    // Multi-file mode
    if (files && Object.keys(files).length > 0) {
      return buildProjectPreview(files);
    }
    // Legacy single-content mode
    if (content) {
      const blocks = extractCodeBlocks(content);
      if (isRenderableCode(blocks)) {
        return buildPreviewDocument(blocks);
      }
    }
    return '';
  }, [content, files]);

  const hasFiles = !!files && Object.keys(files).length > 0;

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
        onDownload={() => files && downloadProjectAsHtml(files)}
        hasFiles={hasFiles}
      />

      {/* Iframe container with viewport sizing */}
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
    </div>
  );
}
