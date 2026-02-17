import { Monitor, Tablet, Smartphone, Maximize2, Minimize2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewToolbarProps {
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onRefresh: () => void;
  onDownload: () => void;
  hasFiles: boolean;
}

const viewports: { id: Viewport; icon: typeof Monitor; label: string; width: string }[] = [
  { id: 'desktop', icon: Monitor, label: 'Desktop', width: '1280px' },
  { id: 'tablet', icon: Tablet, label: 'Tablet', width: '768px' },
  { id: 'mobile', icon: Smartphone, label: 'Mobile', width: '375px' },
];

export function PreviewToolbar({ viewport, onViewportChange, isFullscreen, onFullscreenToggle, onRefresh, onDownload, hasFiles }: PreviewToolbarProps) {
  const currentVp = viewports.find(v => v.id === viewport)!;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
      <div className="flex items-center gap-1">
        {/* Browser dots */}
        <div className="flex gap-1 mr-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        {/* Fake URL bar */}
        <div className="hidden sm:flex items-center bg-background/50 rounded px-2 py-0.5 text-xs text-muted-foreground border border-border/50">
          <span>localhost:3000</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {/* Viewport buttons */}
        {viewports.map(vp => (
          <Button
            key={vp.id}
            variant="ghost"
            size="sm"
            className={cn('h-6 w-6 p-0', viewport === vp.id && 'bg-primary/10 text-primary')}
            onClick={() => onViewportChange(vp.id)}
            title={`${vp.label} (${vp.width})`}
          >
            <vp.icon className="w-3 h-3" />
          </Button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRefresh} title="Refresh">
          <RefreshCw className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onFullscreenToggle} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDownload} disabled={!hasFiles} title="Download project">
          <Download className="w-3 h-3" />
        </Button>

        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{currentVp.width}</span>
      </div>
    </div>
  );
}
