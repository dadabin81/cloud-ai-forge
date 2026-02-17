import { useMemo, useState, useRef, useCallback } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CodeEditorProps {
  filename: string | null;
  code: string;
  language: string;
  onCodeChange?: (filename: string, newCode: string) => void;
}

function highlightCode(code: string, language: string): string {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/(\/\/.*$)/gm, '<span style="color:#6b7280">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6b7280">$1</span>');
  html = html.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#6b7280">$1</span>');

  html = html.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#a5d6a7">$1</span>');
  html = html.replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#a5d6a7">$1</span>');
  html = html.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span style="color:#a5d6a7">$1</span>');

  if (['javascript', 'js', 'jsx', 'tsx', 'typescript'].includes(language)) {
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|new|this|async|await|try|catch|throw)\b/g;
    html = html.replace(keywords, '<span style="color:#c792ea">$1</span>');
  }

  if (['html', 'htm', 'jsx', 'tsx'].includes(language)) {
    html = html.replace(/(&lt;\/?)([\w-]+)/g, '$1<span style="color:#ff7043">$2</span>');
  }

  if (language === 'css') {
    html = html.replace(/([\w-]+)(\s*:)/g, '<span style="color:#80cbc4">$1</span>$2');
  }

  return html;
}

export function CodeEditor({ filename, code, language, onCodeChange }: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const [editableCode, setEditableCode] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use editableCode if user has started editing, otherwise use prop
  const displayCode = editableCode !== null ? editableCode : code;
  const isModified = editableCode !== null && editableCode !== code;
  
  const lines = useMemo(() => displayCode.split('\n'), [displayCode]);
  const highlighted = useMemo(() => highlightCode(displayCode, language), [displayCode, language]);

  // Reset editable state when file changes
  const prevFilenameRef = useRef(filename);
  if (prevFilenameRef.current !== filename) {
    prevFilenameRef.current = filename;
    setEditableCode(null);
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeEdit = useCallback((newCode: string) => {
    setEditableCode(newCode);
    if (filename && onCodeChange) {
      onCodeChange(filename, newCode);
    }
  }, [filename, onCodeChange]);

  if (!filename) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <FileCode className="w-10 h-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select a file to view its code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium truncate">{filename}</span>
          {isModified && <span className="w-2 h-2 rounded-full bg-yellow-400" title="Modified" />}
          <span className="text-xs text-muted-foreground uppercase">{language}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>

      {/* Code area with editable overlay */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5 relative">
        <div className="flex min-w-0">
          {/* Line numbers */}
          <div className="sticky left-0 select-none text-right pr-3 pl-2 py-2 text-muted-foreground/40 bg-background border-r border-border/50 z-10" style={{ minWidth: '3rem' }}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Highlighted code (visual layer) */}
          <pre className="flex-1 py-2 px-3 overflow-x-auto" aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          {/* Editable textarea overlay */}
          {onCodeChange && (
            <textarea
              ref={textareaRef}
              value={displayCode}
              onChange={(e) => handleCodeEdit(e.target.value)}
              className="absolute inset-0 py-2 px-3 font-mono text-xs leading-5 bg-transparent text-transparent caret-foreground resize-none outline-none z-20"
              style={{ marginLeft: '3rem', width: 'calc(100% - 3rem)' }}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          )}
        </div>
      </div>
    </div>
  );
}
