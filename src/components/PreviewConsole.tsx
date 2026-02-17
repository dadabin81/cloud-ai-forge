import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ConsoleLog {
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

interface PreviewConsoleProps {
  logs: ConsoleLog[];
  onClear: () => void;
}

const LOG_ICONS: Record<ConsoleLog['type'], typeof Info> = {
  log: Info,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

const LOG_COLORS: Record<ConsoleLog['type'], string> = {
  log: 'text-muted-foreground',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

export function PreviewConsole({ logs, onClear }: PreviewConsoleProps) {
  const [collapsed, setCollapsed] = useState(true);
  const errorCount = logs.filter(l => l.type === 'error').length;
  const warnCount = logs.filter(l => l.type === 'warn').length;

  return (
    <div className="border-t border-border bg-background">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Console</span>
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{errorCount}</Badge>
          )}
          {warnCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-500/10 text-yellow-400">{warnCount}</Badge>
          )}
          {logs.length > 0 && errorCount === 0 && warnCount === 0 && (
            <span className="text-muted-foreground/50">{logs.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && (
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Clear console">
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
          {collapsed ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {/* Logs */}
      {!collapsed && (
        <div className="max-h-[160px] overflow-y-auto font-mono text-xs border-t border-border/50">
          {logs.length === 0 ? (
            <div className="px-3 py-4 text-center text-muted-foreground/50">No console output</div>
          ) : (
            logs.map((log, i) => {
              const Icon = LOG_ICONS[log.type];
              return (
                <div key={i} className={cn('flex items-start gap-2 px-3 py-1 border-b border-border/20 hover:bg-secondary/20', LOG_COLORS[log.type])}>
                  <Icon className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
