import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

const syntaxHighlight = (code: string, language: string): string => {
  // Simple syntax highlighting
  const keywords = ['import', 'export', 'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'try', 'catch', 'throw', 'from', 'type', 'interface'];
  const types = ['string', 'number', 'boolean', 'void', 'null', 'undefined', 'any', 'unknown', 'never', 'Promise', 'Message', 'ChatResponse', 'NexusAI'];
  
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Strings
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, '<span style="color: #34d399">$&</span>');
  
  // Comments
  highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span style="color: #6b7280">$&</span>');
  highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #6b7280">$&</span>');
  
  // Keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span style="color: #a78bfa">$1</span>');
  });
  
  // Types
  types.forEach(type => {
    const regex = new RegExp(`\\b(${type})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span style="color: #22d3ee">$1</span>');
  });
  
  // Numbers
  highlighted = highlighted.replace(/\b(\d+)\b/g, '<span style="color: #fbbf24">$1</span>');
  
  // Function calls
  highlighted = highlighted.replace(/(\w+)(?=\()/g, '<span style="color: #60a5fa">$1</span>');
  
  return highlighted;
};

export function CodeBlock({ code, language = 'typescript', filename, showLineNumbers = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lines = code.split('\n');
  const highlightedCode = syntaxHighlight(code, language);
  
  return (
    <div className={cn('relative group rounded-xl overflow-hidden border border-border/50', className)}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border/50">
          <span className="text-sm text-muted-foreground font-mono">{filename}</span>
          <span className="text-xs text-muted-foreground/60 uppercase">{language}</span>
        </div>
      )}
      
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 p-2 rounded-lg bg-secondary/80 hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        <div className="overflow-x-auto p-4 bg-[hsl(222,47%,5%)]">
          <pre className="text-sm font-mono leading-relaxed">
            <code>
              {showLineNumbers ? (
                <table className="border-collapse">
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i}>
                        <td className="pr-4 text-muted-foreground/40 text-right select-none align-top">
                          {i + 1}
                        </td>
                        <td 
                          className="whitespace-pre"
                          dangerouslySetInnerHTML={{ 
                            __html: syntaxHighlight(line, language) || ' ' 
                          }}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              )}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
