import { useRef } from 'react';
import { Monitor, Tablet, Smartphone, Maximize2, Minimize2, RefreshCw, Download, FileArchive, FileCode2, FileJson, Upload, Rocket, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewToolbarProps {
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onRefresh: () => void;
  onDownloadZip: () => void;
  onDownloadHtml: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  hasFiles: boolean;
  errorCount?: number;
}

const viewports: { id: Viewport; icon: typeof Monitor; label: string; width: string }[] = [
  { id: 'desktop', icon: Monitor, label: 'Desktop', width: '1280px' },
  { id: 'tablet', icon: Tablet, label: 'Tablet', width: '768px' },
  { id: 'mobile', icon: Smartphone, label: 'Mobile', width: '375px' },
];

export function PreviewToolbar({ viewport, onViewportChange, isFullscreen, onFullscreenToggle, onRefresh, onDownloadZip, onDownloadHtml, onExportJson, onImportJson, hasFiles, errorCount = 0 }: PreviewToolbarProps) {
  const currentVp = viewports.find(v => v.id === viewport)!;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportJson(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
      <div className="flex items-center gap-1">
        {/* Browser dots */}
        <div className="flex gap-1 mr-2">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
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

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5" disabled={!hasFiles}>
              <Download className="w-3 h-3" />
              <ChevronDown className="w-2.5 h-2.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onDownloadZip} className="gap-2 text-xs">
              <FileArchive className="w-3.5 h-3.5" /> Download as ZIP
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadHtml} className="gap-2 text-xs">
              <FileCode2 className="w-3.5 h-3.5" /> Download as HTML
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportJson} className="gap-2 text-xs">
              <FileJson className="w-3.5 h-3.5" /> Export Project (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 text-xs">
              <Upload className="w-3.5 h-3.5" /> Import Project (JSON)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        {errorCount > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 ml-1">{errorCount} error{errorCount > 1 ? 's' : ''}</Badge>
        )}
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{currentVp.width}</span>
      </div>
    </div>
  );
}
