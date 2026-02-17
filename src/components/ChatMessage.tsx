import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { FileCode, FilePlus, Trash2 } from 'lucide-react';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  className?: string;
}

/**
 * Renders a chat message with professional markdown formatting.
 * Separates explanatory text from code blocks, showing file operations as compact badges.
 */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(({ content, role, className }, ref) => {
  if (role === 'user') {
    return <span ref={ref as React.Ref<HTMLSpanElement>} className="text-[13px] leading-relaxed">{content}</span>;
  }

  const segments = parseMessageContent(content);

  return (
    <div ref={ref} className={cn('text-[13px] leading-relaxed space-y-2', className)}>
      {segments.map((seg, i) => {
        if (seg.type === 'file-badge') {
          return (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-xs">
              {seg.action === 'delete' ? (
                <Trash2 className="w-3 h-3 text-destructive" />
              ) : seg.action === 'new' ? (
                <FilePlus className="w-3 h-3 text-green-500" />
              ) : (
                <FileCode className="w-3 h-3 text-primary" />
              )}
              <span className="font-mono text-foreground/80">{seg.path}</span>
              <span className="text-muted-foreground">
                {seg.action === 'delete' ? 'eliminado' : seg.action === 'new' ? 'creado' : 'actualizado'}
              </span>
            </div>
          );
        }

        if (seg.type === 'code') {
          return (
            <div key={i} className="rounded-lg overflow-hidden border border-border/40 bg-background/50">
              {seg.lang && (
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30 bg-muted/30">
                  {seg.lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-xs font-mono text-foreground/90">
                <code>{seg.text}</code>
              </pre>
            </div>
          );
        }

        // Markdown text
        return (
          <div key={i} className="markdown-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }} />
        );
      })}
    </div>
  );
});




type Segment =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'file-badge'; path: string; action: 'new' | 'edit' | 'delete' };

function parseMessageContent(content: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = content;

  // Regex to match code blocks and file markers
  const pattern = /(\[(?:NEW_FILE|EDIT_FILE):\s*([^\]]+)\]\s*\n```\w*\s*\n[\s\S]*?```|\[DELETE_FILE:\s*([^\]]+)\]|```(\w*)\s*\n([\s\S]*?)```)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(remaining)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      const text = remaining.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', text });
    }

    const full = match[0];

    // Check for file operation markers
    if (full.startsWith('[NEW_FILE:') || full.startsWith('[EDIT_FILE:')) {
      const pathMatch = full.match(/\[(NEW_FILE|EDIT_FILE):\s*([^\]]+)\]/);
      if (pathMatch) {
        segments.push({
          type: 'file-badge',
          path: pathMatch[2].trim(),
          action: pathMatch[1] === 'NEW_FILE' ? 'new' : 'edit',
        });
      }
    } else if (full.startsWith('[DELETE_FILE:')) {
      const delMatch = full.match(/\[DELETE_FILE:\s*([^\]]+)\]/);
      if (delMatch) {
        segments.push({ type: 'file-badge', path: delMatch[1].trim(), action: 'delete' });
      }
    } else if (full.startsWith('```')) {
      // Check if this is a project file code block (has // filename: marker)
      const codeContent = match[5] || '';
      const filenameMatch = codeContent.match(/^\/\/\s*filename:\s*(.+)/m);
      if (filenameMatch) {
        segments.push({
          type: 'file-badge',
          path: filenameMatch[1].trim(),
          action: 'edit',
        });
      } else {
        // Regular code block - show it
        segments.push({ type: 'code', text: codeContent.trim(), lang: match[4] || undefined });
      }
    }

    lastIndex = match.index + full.length;
  }

  // Remaining text
  if (lastIndex < remaining.length) {
    const text = remaining.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', text });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text: content }];
}

/**
 * Simple markdown renderer - no external dependencies.
 * Converts markdown to HTML with proper styling using Tailwind classes.
 */
function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-foreground mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-foreground mt-3 mb-1.5">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-foreground mt-2 mb-1.5">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-foreground/90 text-xs font-mono">$1</code>');

  // Unordered lists
  html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li class="ml-4 text-foreground/80 list-disc">$1</li>');
  // Wrap consecutive <li> into <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="space-y-0.5 my-1">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 text-foreground/80 list-decimal">$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-border/30 my-3" />');

  // Line breaks - convert double newlines to paragraphs
  html = html.replace(/\n\n+/g, '</p><p class="my-1.5">');
  html = `<p class="my-0.5">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="[^"]*">\s*<\/p>/g, '');
  // Don't wrap block elements in <p>
  html = html.replace(/<p class="[^"]*">\s*(<(?:h[1-4]|ul|ol|hr|li|div)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h[1-4]|ul|ol|hr|li|div)>)\s*<\/p>/g, '$1');

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
