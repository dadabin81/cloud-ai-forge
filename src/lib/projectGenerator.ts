/**
 * Project Generator - Parses AI responses into multi-file projects
 */

export interface ProjectFile {
  code: string;
  language: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  language?: string;
}

/**
 * Detect language from file extension
 */
function detectLanguage(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'html', htm: 'html',
    css: 'css', scss: 'css', less: 'css',
    js: 'javascript', mjs: 'javascript',
    jsx: 'jsx', tsx: 'tsx',
    ts: 'typescript',
    json: 'json',
    md: 'markdown',
    svg: 'svg',
    txt: 'text',
  };
  return map[ext] || 'text';
}

/**
 * Parse multiple files from AI markdown response.
 * Supports patterns:
 * - `// filename: path/to/file.ext` before a code block
 * - `<!-- filename: path/to/file.ext -->` before a code block
 * - **`path/to/file.ext`** as a markdown header before a code block
 * - #### path/to/file.ext
 */
export function parseProjectFiles(content: string): Record<string, ProjectFile> {
  const files: Record<string, ProjectFile> = {};

  // Pattern: filename marker followed by a code block
  const regex = /(?:\/\/\s*filename:\s*(.+?)\s*\n|<!--\s*filename:\s*(.+?)\s*-->\s*\n|\*\*`?([^`*\n]+\.\w+)`?\*\*\s*\n|#{1,6}\s*`?([^`\n]+\.\w+)`?\s*\n)```(\w+)?\s*\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const filepath = (match[1] || match[2] || match[3] || match[4]).trim();
    const explicitLang = match[5];
    const code = match[6].trim();
    
    if (filepath && code) {
      files[filepath] = {
        code,
        language: explicitLang || detectLanguage(filepath),
      };
    }
  }

  // Fallback: try inline `// filename:` comments inside code blocks
  if (Object.keys(files).length === 0) {
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let blockMatch;
    while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
      const blockCode = blockMatch[2];
      const filenameInCode = blockCode.match(/^\/\/\s*filename:\s*(.+)/m);
      if (filenameInCode) {
        const filepath = filenameInCode[1].trim();
        const codeWithoutMarker = blockCode.replace(/^\/\/\s*filename:\s*.+\n?/m, '').trim();
        files[filepath] = {
          code: codeWithoutMarker,
          language: blockMatch[1] || detectLanguage(filepath),
        };
      }
    }
  }

  return files;
}

/**
 * Generate a file tree structure from a flat file map
 */
export function generateFileTree(files: Record<string, ProjectFile>): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const paths = Object.keys(files).sort();

  for (const filepath of paths) {
    const parts = filepath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      const existing = current.find(n => n.name === part);
      if (existing) {
        if (existing.children) {
          current = existing.children;
        }
      } else {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          ...(isFile ? { language: files[filepath].language } : { children: [] }),
        };
        current.push(node);
        if (!isFile && node.children) {
          current = node.children;
        }
      }
    }
  }

  // Sort: folders first, then files alphabetically
  const sortTree = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => n.children && sortTree(n.children));
  };
  sortTree(root);

  return root;
}

/**
 * Build a preview HTML document from project files
 */
export function buildProjectPreview(files: Record<string, ProjectFile>): string {
  const entries = Object.entries(files);
  
  const cssFiles = entries.filter(([p]) => p.endsWith('.css')).map(([, f]) => f.code);
  const jsFiles = entries.filter(([p]) => /\.(js|mjs)$/.test(p) && !/\.jsx$/.test(p)).map(([, f]) => f.code);
  const jsxFiles = entries.filter(([p]) => /\.(jsx|tsx)$/.test(p)).map(([, f]) => f.code);
  const htmlFiles = entries.filter(([p]) => /\.html?$/.test(p)).map(([, f]) => f.code);

  const hasJsx = jsxFiles.length > 0;

  // Detect Tailwind usage
  const allCode = entries.map(([, f]) => f.code).join('\n');
  const usesTailwind = /\bclass(?:Name)?=["'][^"']*(?:flex|grid|bg-|text-|p-|m-|w-|h-|rounded|shadow|border|gap-|space-|items-|justify-)/i.test(allCode);

  // Console capture + error capture script
  const consoleCapture = `<script>
(function(){
  var _post = function(type, args) {
    try {
      parent.postMessage({ source: 'preview-console', type: type, message: Array.from(args).map(function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } }).join(' ') }, '*');
    } catch(e) {}
  };
  var _origLog = console.log, _origWarn = console.warn, _origError = console.error, _origInfo = console.info;
  console.log = function() { _origLog.apply(console, arguments); _post('log', arguments); };
  console.warn = function() { _origWarn.apply(console, arguments); _post('warn', arguments); };
  console.error = function() { _origError.apply(console, arguments); _post('error', arguments); };
  console.info = function() { _origInfo.apply(console, arguments); _post('info', arguments); };
  window.onerror = function(msg, src, line, col, err) { _post('error', [msg + ' (line ' + line + ')']); };
  window.onunhandledrejection = function(e) { _post('error', ['Unhandled Promise: ' + (e.reason?.message || e.reason)]); };
})();
</script>`;

  const tailwindScript = usesTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '';

  // If there's a full HTML document, use it and inject CSS/JS
  const fullHtml = htmlFiles.find(h => h.toLowerCase().includes('<!doctype') || h.toLowerCase().includes('<html'));
  if (fullHtml && !hasJsx) {
    let doc = fullHtml;
    doc = doc.replace('<head>', `<head>\n${consoleCapture}`);
    if (usesTailwind) {
      doc = doc.replace('</head>', `${tailwindScript}\n</head>`);
    }
    if (cssFiles.length > 0) {
      const cssTag = `<style>\n${cssFiles.join('\n')}\n</style>`;
      doc = doc.replace('</head>', `${cssTag}\n</head>`);
    }
    if (jsFiles.length > 0) {
      const jsTag = `<script>\n${jsFiles.join('\n')}\n</script>`;
      doc = doc.replace('</body>', `${jsTag}\n</body>`);
    }
    return doc;
  }


  // JSX/React mode - load React from CDN
  if (hasJsx) {
    const jsxCode = jsxFiles.join('\n\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${consoleCapture}
${tailwindScript}
<script src="https://unpkg.com/react@18/umd/react.development.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
${cssFiles.join('\n')}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext } = React;
${jsxCode}

const _names = ['App','Main','Page','Home','Landing','Blog','Component','Hero','Layout'];
for (const _n of _names) {
  try { if (typeof eval(_n)==='function') { ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(eval(_n))); break; } } catch(e) {}
}
</script>
</body>
</html>`;
  }

  // Plain HTML snippets or JS-only: build a complete document
  const bodyContent = htmlFiles.join('\n') || '<div id="root"></div>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${consoleCapture}
${tailwindScript}
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
${cssFiles.join('\n')}
</style>
</head>
<body>
${bodyContent}
${jsFiles.length > 0 ? `<script>\n${jsFiles.join('\n')}\n</script>` : ''}
</body>
</html>`;
}

/**
 * Download project as individual files (no ZIP library needed)
 */
export function downloadProjectFile(filename: string, code: string) {
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download all project files as a single HTML file with all code embedded
 */
export function downloadProjectAsHtml(files: Record<string, ProjectFile>) {
  const preview = buildProjectPreview(files);
  const blob = new Blob([preview], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.html';
  a.click();
  URL.revokeObjectURL(url);
}
