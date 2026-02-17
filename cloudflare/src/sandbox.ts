/**
 * Binario Sandbox Service
 * Real project sync, preview serving, and versioning via KV + D1
 */

import { DurableObject } from 'cloudflare:workers';

export interface SandboxEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  BINARIO_AGENT?: DurableObjectNamespace;
  SANDBOX_PROJECT?: DurableObjectNamespace;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  template: string;
  status: 'creating' | 'ready' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  files: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectVersion {
  id: number;
  projectId: string;
  userId: string;
  filesHash: string;
  changedFiles: string[];
  message?: string;
  createdAt: string;
}

export interface ProjectSummary {
  fileCount: number;
  filePaths: string[];
  components: string[];
  routes: string[];
  hasCSS: boolean;
  hasTailwind: boolean;
  totalSize: number;
}

// Project templates with starter files
const TEMPLATES: Record<string, Record<string, string>> = {
  'react-vite': {
    'src/App.jsx': `function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🚀 Welcome to Binario</h1>
      <p>Edit src/App.jsx and save to see changes!</p>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}`,
    'src/index.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; }`,
  },
  'vanilla-js': {
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Binario Project</title>
</head>
<body>
  <div class="container">
    <h1>🚀 Binario Vanilla JS</h1>
    <p>Edit the files and see changes instantly!</p>
    <button id="counter">Click me: 0</button>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    'style.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-family: system-ui; color: white; }
.container { text-align: center; }
h1 { font-size: 3rem; margin-bottom: 1rem; }
button { padding: 1rem 2rem; font-size: 1.2rem; border: none; border-radius: 8px; background: white; color: #667eea; cursor: pointer; }`,
    'script.js': `let count = 0;
const button = document.getElementById('counter');
button.addEventListener('click', () => { count++; button.textContent = 'Click me: ' + count; });`,
  },
};

// ============ Utility: Generate project summary for AI context ============

function generateProjectSummary(files: Record<string, string>): ProjectSummary {
  const filePaths = Object.keys(files);
  const allCode = Object.values(files).join('\n');
  
  // Extract component names from JSX files
  const components: string[] = [];
  const compRegex = /(?:function|const|class)\s+([A-Z][A-Za-z0-9]+)/g;
  let m;
  while ((m = compRegex.exec(allCode)) !== null) {
    if (!components.includes(m[1])) components.push(m[1]);
  }

  // Detect routes
  const routes: string[] = [];
  const routeRegex = /path=["']([^"']+)["']/g;
  while ((m = routeRegex.exec(allCode)) !== null) {
    if (!routes.includes(m[1])) routes.push(m[1]);
  }

  const hasTailwind = /\bclass(?:Name)?=["'][^"']*(?:flex|grid|bg-|text-|p-|m-|rounded)/i.test(allCode)
    || /tailwindcss/i.test(allCode);

  return {
    fileCount: filePaths.length,
    filePaths,
    components,
    routes,
    hasCSS: filePaths.some(p => p.endsWith('.css')),
    hasTailwind,
    totalSize: allCode.length,
  };
}

// Simple hash for files content
async function hashFiles(files: Record<string, string>): Promise<string> {
  const content = JSON.stringify(files);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function detectChangedFiles(oldFiles: Record<string, string>, newFiles: Record<string, string>): string[] {
  const changed: string[] = [];
  for (const [path, content] of Object.entries(newFiles)) {
    if (oldFiles[path] !== content) changed.push(path);
  }
  for (const path of Object.keys(oldFiles)) {
    if (!(path in newFiles)) changed.push(path);
  }
  return changed;
}

// ============ Preview Builder (server-side, mirrors client logic) ============

function buildPreviewHtml(files: Record<string, string>): string {
  const entries = Object.entries(files);
  const cssFiles = entries.filter(([p]) => p.endsWith('.css')).map(([, c]) => c);
  const jsFiles = entries.filter(([p]) => /\.(js|mjs)$/.test(p) && !/\.jsx$/.test(p)).map(([, c]) => c);
  const jsxFiles = entries.filter(([p]) => /\.(jsx|tsx)$/.test(p));
  const htmlFiles = entries.filter(([p]) => /\.html?$/.test(p)).map(([, c]) => c);
  const hasJsx = jsxFiles.length > 0;
  const allCode = entries.map(([, c]) => c).join('\n');
  const usesTailwind = /\bclass(?:Name)?=["'][^"']*(?:flex|grid|bg-|text-|p-|m-|rounded)/i.test(allCode)
    || /tailwindcss/i.test(allCode);
  const tailwindTag = usesTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '';

  const consoleCapture = `<script>
(function(){
  var _post = function(type, args) {
    try { parent.postMessage({ source: 'preview-console', type: type, message: Array.from(args).map(function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } }).join(' ') }, '*'); } catch(e) {}
  };
  var _origLog=console.log,_origWarn=console.warn,_origError=console.error,_origInfo=console.info;
  console.log=function(){_origLog.apply(console,arguments);_post('log',arguments);};
  console.warn=function(){_origWarn.apply(console,arguments);_post('warn',arguments);};
  console.error=function(){_origError.apply(console,arguments);_post('error',arguments);};
  console.info=function(){_origInfo.apply(console,arguments);_post('info',arguments);};
  window.onerror=function(msg,src,line){_post('error',[msg+' (line '+line+')']);};
  window.onunhandledrejection=function(e){_post('error',['Unhandled Promise: '+(e.reason?.message||e.reason)]);};
})();
</script>`;

  // Full HTML document mode
  const fullHtml = htmlFiles.find(h => h.toLowerCase().includes('<!doctype') || h.toLowerCase().includes('<html'));
  if (fullHtml && !hasJsx) {
    let doc = fullHtml;
    doc = doc.replace(/<link\s[^>]*href=["'](?!https?:\/\/)[^"']*["'][^>]*\/?>/gi, '');
    doc = doc.replace(/<script\s[^>]*src=["'](?!https?:\/\/)[^"']*["'][^>]*><\/script>/gi, '');
    doc = doc.replace('<head>', `<head>\n${consoleCapture}`);
    if (usesTailwind && !doc.includes('tailwindcss.com')) doc = doc.replace('</head>', `${tailwindTag}\n</head>`);
    if (cssFiles.length > 0) doc = doc.replace('</head>', `<style>\n${cssFiles.join('\n')}\n</style>\n</head>`);
    if (jsFiles.length > 0) doc = doc.replace('</body>', `<script>\n${jsFiles.join('\n')}\n</script>\n</body>`);
    return doc;
  }

  // JSX/React mode
  if (hasJsx) {
    const stripModuleSyntax = (code: string) => code
      .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+default\s+(function|class)\s/gm, '$1 ')
      .replace(/^\s*export\s+default\s+/gm, '')
      .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
      .replace(/^\s*export\s+(const|let|var|function|class)\s/gm, '$1 ')
      .replace(/^\s*ReactDOM\.createRoot\s*\([\s\S]*?\)\.render\s*\([\s\S]*?\);?\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n').trim();

    const sorted = [...jsxFiles].sort(([a], [b]) => {
      const cA = a.includes('/components/'), cB = b.includes('/components/');
      const aA = a.toLowerCase().includes('app.'), aB = b.toLowerCase().includes('app.');
      if (cA && !cB) return -1; if (!cA && cB) return 1;
      if (aA && !aB) return 1; if (!aA && aB) return -1;
      return a.localeCompare(b);
    });
    const jsxCode = sorted.map(([, c]) => stripModuleSyntax(c)).join('\n\n');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
${consoleCapture}${tailwindTag}
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
${cssFiles.join('\n')}</style></head><body><div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useRef,useMemo,useCallback,useReducer,useContext,createContext}=React;
function useHashRouter(){const[r,s]=useState(window.location.hash.slice(1)||'/');useEffect(()=>{const h=()=>s(window.location.hash.slice(1)||'/');window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[]);return r}
function Route({path,component:C,children}){const r=useHashRouter();if(r!==path&&!(path==='/'&&r===''))return null;return C?React.createElement(C):children}
function Link({to,children,className,...p}){return React.createElement('a',{href:'#'+to,className,onClick:function(e){e.preventDefault();window.location.hash=to},...p},children)}
function Router({children}){return children}
function Switch({children}){const r=useHashRouter();const a=React.Children.toArray(children);for(const c of a){if(c&&c.props&&(c.props.path===r||(c.props.path==='/'&&(r===''||r==='/'))))return c}return a[0]||null}
${jsxCode}
const _names=['App','Main','Page','Home','Landing','Blog','Component','Hero','Layout'];
for(const _n of _names){try{if(typeof eval(_n)==='function'){ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(eval(_n)));break}}catch(e){}}
</script></body></html>`;
  }

  // Plain HTML/JS
  const body = htmlFiles.join('\n') || '<div id="root"></div>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
${consoleCapture}${tailwindTag}
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
${cssFiles.join('\n')}</style></head><body>${body}
${jsFiles.length > 0 ? `<script>\n${jsFiles.join('\n')}\n</script>` : ''}
</body></html>`;
}

// ============ SandboxProject Durable Object ============

export class SandboxProject extends DurableObject<SandboxEnv> {
  private project: Project | null = null;

  constructor(ctx: DurableObjectState, env: SandboxEnv) {
    super(ctx, env);
  }

  private async loadProject(): Promise<Project | null> {
    try {
      const stored = await this.ctx.storage.get<Project>('project');
      if (stored) this.project = stored;
      return this.project;
    } catch { return null; }
  }

  private async saveProject(): Promise<void> {
    if (!this.project) return;
    this.project.updatedAt = Date.now();
    await this.ctx.storage.put('project', this.project);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const action = parts[parts.length - 1];

    switch (action) {
      case 'create': return this.handleCreate(request);
      case 'status': return this.handleStatus();
      case 'files': return request.method === 'POST' ? this.handleWriteFiles(request) : this.handleReadFiles(request);
      case 'sync': return this.handleSync(request);
      case 'preview': return this.handleServePreview();
      case 'versions': return request.method === 'GET' ? this.handleGetVersions(request) : this.handleCreateVersion(request);
      case 'summary': return this.handleGetSummary();
      case 'delete': return this.handleDelete();
      default: return new Response('Not found', { status: 404 });
    }
  }

  private async handleCreate(request: Request): Promise<Response> {
    const body = await request.json() as { userId: string; name: string; template?: string };
    const template = body.template || 'react-vite';
    const templateFiles = TEMPLATES[template] || TEMPLATES['vanilla-js'];

    this.project = {
      id: this.ctx.id.toString(),
      userId: body.userId,
      name: body.name,
      template,
      status: 'ready',
      files: templateFiles,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.saveProject();

    // Also cache in KV for fast access
    await this.env.KV.put(`project:${this.project.id}:files`, JSON.stringify(templateFiles));
    const summary = generateProjectSummary(templateFiles);
    await this.env.KV.put(`project:${this.project.id}:summary`, JSON.stringify(summary));

    return this.json({ success: true, project: this.project }, 201);
  }

  private async handleStatus(): Promise<Response> {
    await this.loadProject();
    if (!this.project) return this.json({ error: 'Project not found' }, 404);
    return this.json({
      id: this.project.id,
      name: this.project.name,
      status: this.project.status,
      template: this.project.template,
      fileCount: Object.keys(this.project.files).length,
      createdAt: this.project.createdAt,
      updatedAt: this.project.updatedAt,
    });
  }

  private async handleReadFiles(request: Request): Promise<Response> {
    await this.loadProject();
    if (!this.project) return this.json({ error: 'Project not found' }, 404);
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (path) {
      const content = this.project.files[path];
      if (content === undefined) return this.json({ error: 'File not found' }, 404);
      return this.json({ path, content });
    }
    return this.json({ files: Object.keys(this.project.files).map(p => ({ path: p, size: this.project!.files[p].length })) });
  }

  private async handleWriteFiles(request: Request): Promise<Response> {
    await this.loadProject();
    if (!this.project) return this.json({ error: 'Project not found' }, 404);
    const body = await request.json() as { operations: { path: string; content?: string; action: string }[] };
    for (const op of body.operations) {
      if ((op.action === 'create' || op.action === 'update') && op.content !== undefined) {
        this.project.files[op.path] = op.content;
      } else if (op.action === 'delete') {
        delete this.project.files[op.path];
      }
    }
    await this.saveProject();
    // Sync to KV
    await this.env.KV.put(`project:${this.project.id}:files`, JSON.stringify(this.project.files));
    const summary = generateProjectSummary(this.project.files);
    await this.env.KV.put(`project:${this.project.id}:summary`, JSON.stringify(summary));
    return this.json({ success: true });
  }

  /** Sync files from Supabase into KV + DO storage + create version */
  private async handleSync(request: Request): Promise<Response> {
    const body = await request.json() as {
      projectId: string;
      userId: string;
      name?: string;
      files: Record<string, string>;
      message?: string;
    };

    const oldFiles = this.project?.files || {};
    
    // Update DO state
    if (!this.project) {
      this.project = {
        id: body.projectId,
        userId: body.userId,
        name: body.name || 'Synced Project',
        template: 'custom',
        status: 'ready',
        files: body.files,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      this.project.files = body.files;
      if (body.name) this.project.name = body.name;
    }
    await this.saveProject();

    // Cache files in KV
    await this.env.KV.put(`project:${body.projectId}:files`, JSON.stringify(body.files));

    // Generate and cache summary
    const summary = generateProjectSummary(body.files);
    await this.env.KV.put(`project:${body.projectId}:summary`, JSON.stringify(summary));

    // Create version in D1
    const filesHash = await hashFiles(body.files);
    const changedFiles = detectChangedFiles(oldFiles, body.files);
    
    try {
      await this.env.DB.prepare(`
        INSERT INTO project_versions (project_id, user_id, files_hash, changed_files, message, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(body.projectId, body.userId, filesHash, JSON.stringify(changedFiles), body.message || null).run();
    } catch (e) {
      // D1 table might not exist yet - non-blocking
      console.error('Version tracking failed:', e);
    }

    return this.json({
      success: true,
      summary,
      version: filesHash,
      changedFiles,
      previewUrl: `https://binario-api.databin81.workers.dev/v1/projects/${body.projectId}/preview`,
    });
  }

  /** Serve a built preview HTML directly from the worker */
  private async handleServePreview(): Promise<Response> {
    // Try DO storage first, then KV
    await this.loadProject();
    let files = this.project?.files;

    if (!files || Object.keys(files).length === 0) {
      // Fallback to KV
      const kvKey = this.ctx.id.toString();
      const kvFiles = await this.env.KV.get(`project:${kvKey}:files`);
      if (kvFiles) files = JSON.parse(kvFiles);
    }

    if (!files || Object.keys(files).length === 0) {
      return new Response('<html><body><h1>Project not found</h1></body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const html = buildPreviewHtml(files);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handleGetVersions(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') || this.ctx.id.toString();
    try {
      const result = await this.env.DB.prepare(`
        SELECT id, project_id, user_id, files_hash, changed_files, message, created_at
        FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20
      `).bind(projectId).all();
      return this.json({ versions: result.results });
    } catch {
      return this.json({ versions: [], error: 'Version table not available' });
    }
  }

  private async handleCreateVersion(request: Request): Promise<Response> {
    const body = await request.json() as { projectId: string; userId: string; filesHash: string; changedFiles: string[]; message?: string };
    try {
      await this.env.DB.prepare(`
        INSERT INTO project_versions (project_id, user_id, files_hash, changed_files, message, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(body.projectId, body.userId, body.filesHash, JSON.stringify(body.changedFiles), body.message || null).run();
      return this.json({ success: true }, 201);
    } catch (e) {
      return this.json({ error: 'Failed to create version', details: String(e) }, 500);
    }
  }

  private async handleGetSummary(): Promise<Response> {
    await this.loadProject();
    if (!this.project) return this.json({ error: 'Project not found' }, 404);
    const summary = generateProjectSummary(this.project.files);
    return this.json(summary);
  }

  private async handleDelete(): Promise<Response> {
    await this.loadProject();
    if (!this.project) return this.json({ error: 'Project not found' }, 404);
    const pid = this.project.id;
    await this.ctx.storage.deleteAll();
    await this.env.KV.delete(`project:${pid}:files`);
    await this.env.KV.delete(`project:${pid}:summary`);
    this.project = null;
    return this.json({ success: true });
  }

  private json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

// ============ Sandbox Service Functions ============

export async function createProject(env: SandboxEnv, userId: string, name: string, template = 'react-vite'): Promise<{ projectId: string; project: Project }> {
  const projectId = crypto.randomUUID();
  const templateFiles = TEMPLATES[template] || TEMPLATES['vanilla-js'];

  await env.KV.put(`project:${projectId}`, JSON.stringify({ userId, name, template, createdAt: Date.now() }));
  await env.KV.put(`project:${projectId}:files`, JSON.stringify(templateFiles));
  
  const summary = generateProjectSummary(templateFiles);
  await env.KV.put(`project:${projectId}:summary`, JSON.stringify(summary));

  return {
    projectId,
    project: { id: projectId, userId, name, template, status: 'ready', files: templateFiles, createdAt: Date.now(), updatedAt: Date.now() },
  };
}

export async function listUserProjects(env: SandboxEnv, userId: string): Promise<Project[]> {
  // List from KV prefix scan (limited but functional)
  const list = await env.KV.list({ prefix: 'project:', limit: 100 });
  const projects: Project[] = [];
  for (const key of list.keys) {
    if (key.name.includes(':files') || key.name.includes(':summary')) continue;
    const data = await env.KV.get(key.name);
    if (data) {
      try {
        const meta = JSON.parse(data);
        if (meta.userId === userId) {
          const pid = key.name.replace('project:', '');
          projects.push({ id: pid, userId, name: meta.name, template: meta.template, status: 'ready', files: {}, createdAt: meta.createdAt, updatedAt: meta.createdAt });
        }
      } catch {}
    }
  }
  return projects;
}

export async function getProjectById(env: SandboxEnv, projectId: string): Promise<Project | null> {
  const meta = await env.KV.get(`project:${projectId}`);
  if (!meta) return null;
  const parsed = JSON.parse(meta);
  const filesJson = await env.KV.get(`project:${projectId}:files`);
  const files = filesJson ? JSON.parse(filesJson) : {};
  return { id: projectId, userId: parsed.userId, name: parsed.name, template: parsed.template, status: 'ready', files, createdAt: parsed.createdAt, updatedAt: parsed.createdAt };
}

export async function deleteProject(env: SandboxEnv, projectId: string, userId: string): Promise<boolean> {
  const meta = await env.KV.get(`project:${projectId}`);
  if (!meta) return false;
  const parsed = JSON.parse(meta);
  if (parsed.userId !== userId) return false;
  await env.KV.delete(`project:${projectId}`);
  await env.KV.delete(`project:${projectId}:files`);
  await env.KV.delete(`project:${projectId}:summary`);
  return true;
}

export function getAvailableTemplates(): { id: string; name: string; description: string }[] {
  return [
    { id: 'react-vite', name: 'React + Vite', description: 'Modern React app with Vite bundler' },
    { id: 'vanilla-js', name: 'Vanilla JavaScript', description: 'Simple HTML/CSS/JS project' },
  ];
}
