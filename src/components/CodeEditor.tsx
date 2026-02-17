import { useMemo } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface CodeEditorProps {
  filename: string | null;
  code: string;
  language: string;
}

/**
 * Basic syntax highlight using inline styles (required for dangerouslySetInnerHTML)
 */
function highlightCode(code: string, language: string): string {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments
  html = html.replace(/(\/\/.*$)/gm, '<span style="color:#6b7280">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6b7280">$1</span>');
  html = html.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#6b7280">$1</span>');

  // Strings
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

export function CodeEditor({ filename, code, language }: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  
  const lines = useMemo(() => code.split('\n'), [code]);
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

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
          <span className="text-xs text-muted-foreground uppercase">{language}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        <div className="flex min-w-0">
          {/* Line numbers */}
          <div className="sticky left-0 select-none text-right pr-3 pl-2 py-2 text-muted-foreground/40 bg-background border-r border-border/50" style={{ minWidth: '3rem' }}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 py-2 px-3 overflow-x-auto">
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        </div>
      </div>
    </div>
  );
}
