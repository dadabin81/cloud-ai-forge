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
  // Supports: // filename: path, <!-- filename: path -->, **path.ext**, #### path.ext, [NEW_FILE: path], [EDIT_FILE: path]
  // Supports: // filename: path, // name.ext: path, <!-- filename: path -->, **path.ext**, #### path.ext, [NEW_FILE: path], [EDIT_FILE: path]
  const regex = /(?:\/\/\s*filename:\s*(.+?)\s*\n|\/\/\s*[\w.-]+:\s*(.+?)\s*\n|<!--\s*filename:\s*(.+?)\s*-->\s*\n|\*\*`?([^`*\n]+\.\w+)`?\*\*\s*\n|#{1,6}\s*`?([^`\n]+\.\w+)`?\s*\n|\[(?:NEW_FILE|EDIT_FILE):\s*(.+?)\]\s*\n)```(\w+)?\s*\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const filepath = (match[1] || match[2] || match[3] || match[4] || match[5] || match[6]).trim();
    const explicitLang = match[7];
    const code = match[8].trim();
    
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
 * Strip import/export statements and ReactDOM.createRoot calls from JSX code.
 * Babel Standalone in the browser does NOT support ES module syntax.
 */
export function stripModuleSyntax(code: string): string {
  return code
    // Remove import ... from '...' (single or multi-line)
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Remove side-effect imports: import '...'
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    // export default function/class -> keep declaration
    .replace(/^\s*export\s+default\s+(function|class)\s/gm, '$1 ')
    // export default <expr> -> remove (the auto-render will find it)
    .replace(/^\s*export\s+default\s+/gm, '')
    // export { ... } -> remove
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
    // export const/let/var/function/class -> keep declaration
    .replace(/^\s*export\s+(const|let|var|function|class)\s/gm, '$1 ')
    // Remove ReactDOM.createRoot(...).render(...) calls (the engine adds its own)
    .replace(/^\s*ReactDOM\.createRoot\s*\([\s\S]*?\)\.render\s*\([\s\S]*?\);?\s*$/gm, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Lightweight hash router injected into preview for multi-page navigation.
 */
const HASH_ROUTER_CODE = `
function useHashRouter() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

function Route({ path, component: Comp, children }) {
  const route = useHashRouter();
  const match = route === path || (path === '/' && route === '');
  if (!match) return null;
  return Comp ? React.createElement(Comp) : children;
}

function Link({ to, children, className, ...props }) {
  return React.createElement('a', {
    href: '#' + to,
    className: className,
    onClick: function(e) { e.preventDefault(); window.location.hash = to; },
    ...props
  }, children);
}

function Router({ children }) {
  return children;
}

function Switch({ children }) {
  const route = useHashRouter();
  const arr = React.Children.toArray(children);
  for (const child of arr) {
    if (child && child.props && (child.props.path === route || (child.props.path === '/' && (route === '' || route === '/')))) {
      return child;
    }
  }
  return arr[0] || null;
}
`;

/**
 * Build a preview HTML document from project files
 */
export function buildProjectPreview(files: Record<string, ProjectFile>): string {
  const entries = Object.entries(files);
  
  const cssFiles = entries.filter(([p]) => p.endsWith('.css')).map(([, f]) => f.code);
  const jsFiles = entries.filter(([p]) => /\.(js|mjs)$/.test(p) && !/\.jsx$/.test(p)).map(([, f]) => f.code);
  const jsxFiles = entries.filter(([p]) => /\.(jsx|tsx)$/.test(p));
  const htmlFiles = entries.filter(([p]) => /\.html?$/.test(p)).map(([, f]) => f.code);

  const hasJsx = jsxFiles.length > 0;

  // Detect Tailwind usage (class names or explicit mention)
  const allCode = entries.map(([, f]) => f.code).join('\n');
  const usesTailwind = /\bclass(?:Name)?=["'][^"']*(?:flex|grid|bg-|text-|p-|m-|w-|h-|rounded|shadow|border|gap-|space-|items-|justify-)/i.test(allCode)
    || /tailwindcss|tailwind\.config/i.test(allCode);

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

  // If there's a full HTML document, strip dead local references and use it
  const fullHtml = htmlFiles.find(h => h.toLowerCase().includes('<!doctype') || h.toLowerCase().includes('<html'));
  if (fullHtml && !hasJsx) {
    let doc = fullHtml;
    // Strip dead local file references (link/script pointing to project files)
    doc = doc.replace(/<link\s[^>]*href=["'](?!https?:\/\/)[^"']*["'][^>]*\/?>/gi, '');
    doc = doc.replace(/<script\s[^>]*src=["'](?!https?:\/\/)[^"']*["'][^>]*><\/script>/gi, '');
    doc = doc.replace('<head>', `<head>\n${consoleCapture}`);
    if (usesTailwind && !doc.includes('tailwindcss.com')) {
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

  // JSX/React mode - concatenate all JSX in dependency order (components first, App last)
  if (hasJsx) {
    const sortedJsx = [...jsxFiles].sort(([pathA], [pathB]) => {
      const isCompA = pathA.includes('/components/');
      const isCompB = pathB.includes('/components/');
      const isAppA = pathA.toLowerCase().includes('app.');
      const isAppB = pathB.toLowerCase().includes('app.');
      if (isCompA && !isCompB) return -1;
      if (!isCompA && isCompB) return 1;
      if (isAppA && !isAppB) return 1;
      if (!isAppA && isAppB) return -1;
      return pathA.localeCompare(pathB);
    });
    // Strip module syntax from each JSX file before concatenation
    const jsxCode = sortedJsx.map(([, f]) => stripModuleSyntax(f.code)).join('\n\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${consoleCapture}
${tailwindScript}
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
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
${HASH_ROUTER_CODE}
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
