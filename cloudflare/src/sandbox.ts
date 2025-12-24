/**
 * Binario Sandbox Service
 * Cloudflare Containers SDK integration for isolated code execution
 * Enables AI agents to create, edit, and run projects in secure sandboxes
 */

import { DurableObject } from 'cloudflare:workers';

export interface SandboxEnv {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  SANDBOX: Container;
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

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface FileOperation {
  path: string;
  content?: string;
  action: 'create' | 'update' | 'delete' | 'read';
}

// Project templates with starter files
const TEMPLATES: Record<string, Record<string, string>> = {
  'react-vite': {
    'package.json': JSON.stringify({
      name: 'binario-project',
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0 --port 3000',
        build: 'vite build',
        preview: 'vite preview --host 0.0.0.0 --port 3000',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.1',
        vite: '^5.4.0',
      },
    }, null, 2),
    'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Binario Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
    'src/App.jsx': `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🚀 Welcome to Binario</h1>
      <p>Edit src/App.jsx and save to see changes!</p>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App`,
    'src/index.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}`,
  },
  'node-express': {
    'package.json': JSON.stringify({
      name: 'binario-api',
      type: 'module',
      scripts: {
        start: 'node index.js',
        dev: 'node --watch index.js',
      },
      dependencies: {
        express: '^4.19.2',
      },
    }, null, 2),
    'index.js': `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Binario API!',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
  },
  'python-flask': {
    'requirements.txt': 'flask==3.0.0\ngunicorn==21.2.0',
    'app.py': `from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        'message': 'Welcome to Binario Python API!',
        'timestamp': datetime.now().isoformat(),
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)`,
  },
  'vanilla-js': {
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Binario Project</title>
  <link rel="stylesheet" href="style.css">
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
    'style.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui;
  color: white;
}

.container {
  text-align: center;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

button {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 8px;
  background: white;
  color: #667eea;
  cursor: pointer;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}`,
    'script.js': `let count = 0;
const button = document.getElementById('counter');

button.addEventListener('click', () => {
  count++;
  button.textContent = \`Click me: \${count}\`;
});

console.log('Binario Vanilla JS loaded!');`,
  },
};

/**
 * SandboxProject Durable Object
 * Manages a single project's sandbox lifecycle
 */
export class SandboxProject extends DurableObject<SandboxEnv> {
  private project: Project | null = null;
  private container: any = null;

  constructor(ctx: DurableObjectState, env: SandboxEnv) {
    super(ctx, env);
  }

  private async loadProject(): Promise<Project | null> {
    try {
      const stored = await this.ctx.storage.get<Project>('project');
      if (stored) {
        this.project = stored;
      }
      return this.project;
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  }

  private async saveProject(): Promise<void> {
    if (!this.project) return;
    try {
      this.project.updatedAt = Date.now();
      await this.ctx.storage.put('project', this.project);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'create':
        return this.handleCreate(request);
      case 'status':
        return this.handleStatus();
      case 'files':
        return request.method === 'POST' 
          ? this.handleWriteFiles(request) 
          : this.handleReadFiles(request);
      case 'exec':
        return this.handleExec(request);
      case 'start':
        return this.handleStart();
      case 'stop':
        return this.handleStop();
      case 'preview':
        return this.handlePreview();
      case 'delete':
        return this.handleDelete();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleCreate(request: Request): Promise<Response> {
    const body = await request.json() as {
      userId: string;
      name: string;
      template?: string;
    };

    const template = body.template || 'react-vite';
    const templateFiles = TEMPLATES[template] || TEMPLATES['vanilla-js'];

    this.project = {
      id: this.ctx.id.toString(),
      userId: body.userId,
      name: body.name,
      template,
      status: 'creating',
      files: templateFiles,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveProject();

    // Initialize container with template files
    try {
      // Note: Actual container initialization would happen here
      // For now, we mark as ready since container binding might not be available
      this.project.status = 'ready';
      await this.saveProject();

      return this.jsonResponse({
        success: true,
        project: this.project,
      }, 201);
    } catch (error) {
      this.project.status = 'error';
      await this.saveProject();
      return this.jsonResponse({
        success: false,
        error: (error as Error).message,
      }, 500);
    }
  }

  private async handleStatus(): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }
    return this.jsonResponse({
      id: this.project.id,
      name: this.project.name,
      status: this.project.status,
      template: this.project.template,
      previewUrl: this.project.previewUrl,
      fileCount: Object.keys(this.project.files).length,
      createdAt: this.project.createdAt,
      updatedAt: this.project.updatedAt,
    });
  }

  private async handleReadFiles(request: Request): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    const url = new URL(request.url);
    const path = url.searchParams.get('path');

    if (path) {
      const content = this.project.files[path];
      if (content === undefined) {
        return this.jsonResponse({ error: 'File not found' }, 404);
      }
      return this.jsonResponse({ path, content });
    }

    // Return all files
    return this.jsonResponse({
      files: Object.keys(this.project.files).map(path => ({
        path,
        size: this.project!.files[path].length,
      })),
    });
  }

  private async handleWriteFiles(request: Request): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    const body = await request.json() as {
      operations: FileOperation[];
    };

    const results: { path: string; success: boolean; error?: string }[] = [];

    for (const op of body.operations) {
      try {
        switch (op.action) {
          case 'create':
          case 'update':
            if (op.content !== undefined) {
              this.project.files[op.path] = op.content;
              results.push({ path: op.path, success: true });
            }
            break;
          case 'delete':
            delete this.project.files[op.path];
            results.push({ path: op.path, success: true });
            break;
          case 'read':
            // Already handled in GET
            break;
        }
      } catch (error) {
        results.push({
          path: op.path,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    await this.saveProject();

    return this.jsonResponse({ results });
  }

  private async handleExec(request: Request): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    const body = await request.json() as {
      command: string;
      args?: string[];
      cwd?: string;
      timeout?: number;
    };

    const startTime = Date.now();

    try {
      // Simulate command execution
      // In production, this would use the Container binding
      const result: ExecResult = {
        exitCode: 0,
        stdout: `Executed: ${body.command} ${(body.args || []).join(' ')}`,
        stderr: '',
        duration: Date.now() - startTime,
      };

      return this.jsonResponse(result);
    } catch (error) {
      return this.jsonResponse({
        exitCode: 1,
        stdout: '',
        stderr: (error as Error).message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async handleStart(): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    try {
      // Start the dev server based on template
      this.project.status = 'running';
      this.project.previewUrl = `https://${this.project.id}.binario.preview`;
      await this.saveProject();

      return this.jsonResponse({
        success: true,
        status: this.project.status,
        previewUrl: this.project.previewUrl,
      });
    } catch (error) {
      return this.jsonResponse({
        success: false,
        error: (error as Error).message,
      }, 500);
    }
  }

  private async handleStop(): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    this.project.status = 'stopped';
    this.project.previewUrl = undefined;
    await this.saveProject();

    return this.jsonResponse({
      success: true,
      status: this.project.status,
    });
  }

  private async handlePreview(): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    if (this.project.status !== 'running') {
      return this.jsonResponse({
        error: 'Project is not running',
        status: this.project.status,
      }, 400);
    }

    return this.jsonResponse({
      previewUrl: this.project.previewUrl,
      status: this.project.status,
    });
  }

  private async handleDelete(): Promise<Response> {
    await this.loadProject();
    if (!this.project) {
      return this.jsonResponse({ error: 'Project not found' }, 404);
    }

    // Clean up resources
    await this.ctx.storage.deleteAll();
    this.project = null;

    return this.jsonResponse({ success: true });
  }

  private jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============ Sandbox Service Functions ============

export async function createProject(
  env: SandboxEnv,
  userId: string,
  name: string,
  template = 'react-vite'
): Promise<{ projectId: string; project: Project }> {
  const projectId = crypto.randomUUID();
  
  // Store project metadata in D1
  await env.DB.prepare(`
    INSERT INTO projects (id, user_id, name, template, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'creating', datetime('now'), datetime('now'))
  `).bind(projectId, userId, name, template).run();

  // Initialize Durable Object for this project
  const id = env.KV; // We'll use KV for project registry
  await env.KV.put(`project:${projectId}`, JSON.stringify({
    userId,
    name,
    template,
    createdAt: Date.now(),
  }));

  return {
    projectId,
    project: {
      id: projectId,
      userId,
      name,
      template,
      status: 'ready',
      files: TEMPLATES[template] || TEMPLATES['vanilla-js'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

export async function listUserProjects(
  env: SandboxEnv,
  userId: string
): Promise<Project[]> {
  const result = await env.DB.prepare(`
    SELECT id, user_id, name, template, status, preview_url, created_at, updated_at
    FROM projects
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `).bind(userId).all();

  return result.results.map(row => ({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    template: row.template as string,
    status: row.status as Project['status'],
    previewUrl: row.preview_url as string | undefined,
    files: {},
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  }));
}

export async function getProjectById(
  env: SandboxEnv,
  projectId: string
): Promise<Project | null> {
  const row = await env.DB.prepare(`
    SELECT id, user_id, name, template, status, preview_url, created_at, updated_at
    FROM projects
    WHERE id = ?
  `).bind(projectId).first();

  if (!row) return null;

  // Get files from KV
  const filesJson = await env.KV.get(`project:${projectId}:files`);
  const files = filesJson ? JSON.parse(filesJson) : {};

  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    template: row.template as string,
    status: row.status as Project['status'],
    previewUrl: row.preview_url as string | undefined,
    files,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

export async function deleteProject(
  env: SandboxEnv,
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await env.DB.prepare(`
    DELETE FROM projects
    WHERE id = ? AND user_id = ?
  `).bind(projectId, userId).run();

  if (result.meta.changes > 0) {
    await env.KV.delete(`project:${projectId}`);
    await env.KV.delete(`project:${projectId}:files`);
    return true;
  }

  return false;
}

export function getAvailableTemplates(): { id: string; name: string; description: string }[] {
  return [
    { id: 'react-vite', name: 'React + Vite', description: 'Modern React app with Vite bundler' },
    { id: 'node-express', name: 'Node.js + Express', description: 'REST API with Express.js' },
    { id: 'python-flask', name: 'Python + Flask', description: 'Python web API with Flask' },
    { id: 'vanilla-js', name: 'Vanilla JavaScript', description: 'Simple HTML/CSS/JS project' },
  ];
}
