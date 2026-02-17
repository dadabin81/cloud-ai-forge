import { useState, useMemo } from 'react';
import { Maximize2, Minimize2, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { extractCodeBlocks, buildPreviewDocument, isRenderableCode } from '@/lib/codeExtractor';
import { toast } from 'sonner';

interface CodePreviewProps {
  /** Raw message content (markdown with code blocks) */
  content: string;
  className?: string;
}

export function CodePreview({ content, className }: CodePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { blocks, renderable, document: previewDoc } = useMemo(() => {
    const blocks = extractCodeBlocks(content);
    const renderable = isRenderableCode(blocks);
    const document = renderable ? buildPreviewDocument(blocks) : '';
    return { blocks, renderable, document: document };
  }, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(previewDoc);
    setCopied(true);
    toast.success('HTML copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!renderable || !previewDoc) {
    return (
      <div className={cn('flex items-center justify-center h-full min-h-[400px] rounded-xl border border-border bg-secondary/20', className)}>
        <div className="text-center space-y-2 p-6">
          <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">No renderable code detected</p>
          <p className="text-xs text-muted-foreground/60">
            Ask the AI to generate HTML, CSS, JS, or React/JSX code to see a live preview here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border border-border overflow-hidden',
      isFullscreen && 'fixed inset-0 z-50 rounded-none',
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            Live Preview — {blocks.map(b => b.language.toUpperCase()).join(' + ')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setRefreshKey(k => k + 1)}
            title="Refresh preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            title="Copy HTML"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        key={refreshKey}
        srcDoc={previewDoc}
        sandbox="allow-scripts"
        className="flex-1 w-full bg-white"
        style={{ minHeight: isFullscreen ? 'calc(100vh - 40px)' : '400px' }}
        title="Code Preview"
      />
    </div>
  );
}
