// Chat Action System
// Automatically detects intent from AI responses and executes Cloudflare APIs

import { createCloudflareApi, type RAGSearchResult, type WorkflowInstance } from '@/lib/cloudflareApi';
import { sandboxService } from '@/lib/sandboxService';

export interface ChatAction {
  type: 'rag_search' | 'rag_ingest' | 'rag_query' | 'workflow_research' | 'workflow_rag_ingest' | 'workflow_status' | 'project_create'
    | 'sandbox_create' | 'sandbox_deploy' | 'sandbox_exec' | 'sandbox_start' | 'sandbox_stop'
    | 'template_select' | 'blueprint_generate' | 'rag_learn' | 'project_rename' | 'project_export';
  params: Record<string, string>;
  raw: string;
}

export interface ActionResult {
  action: ChatAction;
  success: boolean;
  summary: string;
  data?: unknown;
}

// Parse [ACTION:type:json_params] markers from AI text
export function parseActions(text: string): { cleanText: string; actions: ChatAction[] } {
  const actionRegex = /\[ACTION:(\w+):([^\]]+)\]/g;
  const actions: ChatAction[] = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    let params: Record<string, string> = {};
    try { params = JSON.parse(match[2]); } catch { params = { value: match[2] }; }
    actions.push({ type: match[1] as ChatAction['type'], params, raw: match[0] });
  }

  const cleanText = text.replace(actionRegex, '').trim();
  return { cleanText, actions };
}

// Execute a single action
export async function executeAction(action: ChatAction, apiKey: string): Promise<ActionResult> {
  const api = createCloudflareApi(apiKey);

  try {
    switch (action.type) {
      case 'rag_search': {
        const res = await api.ragSearch(action.params.query || action.params.value, 5);
        const results = res.results || [];
        return {
          action, success: true,
          summary: results.length > 0
            ? `🔍 Found ${results.length} relevant documents:\n${results.map((r: RAGSearchResult, i: number) => `  ${i + 1}. (${(r.score * 100).toFixed(0)}% match) ${r.content.slice(0, 100)}...`).join('\n')}`
            : '🔍 No matching documents found.',
          data: results,
        };
      }

      case 'rag_query': {
        const res = await api.ragQuery(action.params.query || action.params.value);
        return { action, success: true, summary: `📚 **RAG Answer:**\n${res.answer}\n\n*Sources: ${res.sources?.length || 0} documents*`, data: res };
      }

      case 'rag_ingest': {
        const res = await api.ragIngest(action.params.content || action.params.value);
        return { action, success: true, summary: `✅ Document ingested! ${res.chunks} chunks. ID: \`${res.documentId}\``, data: res };
      }

      case 'rag_learn': {
        const content = action.params.content || action.params.url || action.params.value;
        try {
          const res = await api.ragIngest(content);
          return { action, success: true, summary: `🧠 Learned! Ingested ${res.chunks} chunks into knowledge base. ID: \`${res.documentId}\``, data: res };
        } catch (e) {
          return { action, success: false, summary: `⚠️ Failed to learn: ${(e as Error).message}` };
        }
      }

      case 'workflow_research': {
        const res = await api.workflowResearch(action.params.topic || action.params.value);
        return { action, success: true, summary: `🔬 Research workflow started! ID: \`${res.instanceId}\`\n⏳ Running: analyze → search → synthesize → report.`, data: res };
      }

      case 'workflow_rag_ingest': {
        const res = await api.workflowRAGIngest(action.params.url || action.params.value);
        return { action, success: true, summary: `📥 RAG ingest workflow started! ID: \`${res.instanceId}\`\n⏳ Processing: fetch → extract → chunk → embed → index.`, data: res };
      }

      case 'workflow_status': {
        const res = await api.workflowStatus(action.params.instanceId || action.params.value);
        const emoji = res.status === 'complete' ? '✅' : res.status === 'running' ? '⏳' : res.status === 'errored' ? '❌' : '🕐';
        let summary = `${emoji} Workflow: **${res.status}**`;
        if (res.steps) {
          summary += '\n' + res.steps.map((s: WorkflowInstance['steps'] extends (infer T)[] | undefined ? T : never) => {
            const icon = s.status === 'complete' ? '✓' : s.status === 'running' ? '⟳' : s.status === 'errored' ? '✗' : '○';
            return `  ${icon} ${s.name}`;
          }).join('\n');
        }
        if (res.status === 'complete' && res.output) {
          summary += `\n\n**Result:**\n${typeof res.output === 'string' ? res.output : JSON.stringify(res.output, null, 2)}`;
        }
        return { action, success: true, summary, data: res };
      }

      case 'project_create': {
        const res = await api.projectCreate(action.params.name || 'my-project', action.params.template || 'react-vite');
        return { action, success: true, summary: `🚀 Project "${res.name}" created! Template: ${res.template} | ID: \`${res.id}\``, data: res };
      }

      // --- Sandbox actions ---
      case 'sandbox_create': {
        const res = await sandboxService.createProject(
          action.params.name || 'my-sandbox',
          action.params.template || 'react-vite',
          apiKey,
        );
        return { action, success: true, summary: `☁️ Sandbox "${res.name}" created! Status: ${res.status} | ID: \`${res.id}\``, data: res };
      }

      case 'sandbox_deploy': {
        const res = await sandboxService.deploy(action.params.projectId || action.params.value, apiKey);
        return { action, success: true, summary: `🚀 Deployed! URL: ${res.url}\nDeploy ID: \`${res.deployId}\``, data: res };
      }

      case 'sandbox_exec': {
        const res = await sandboxService.execCommand(action.params.projectId || action.params.value, action.params.command || 'echo "hello"', apiKey);
        return { action, success: true, summary: `💻 Command output (exit ${res.exitCode}):\n\`\`\`\n${res.output}\n\`\`\``, data: res };
      }

      case 'sandbox_start': {
        const res = await sandboxService.startDevServer(action.params.projectId || action.params.value, apiKey);
        return { action, success: true, summary: `▶️ Dev server started! Preview: ${res.previewUrl}`, data: res };
      }

      case 'sandbox_stop': {
        await sandboxService.stopDevServer(action.params.projectId || action.params.value, apiKey);
        return { action, success: true, summary: '⏹️ Dev server stopped.' };
      }

      // --- Template/Blueprint/Project management actions ---
      case 'template_select':
        return { action, success: true, summary: `📋 Template "${action.params.templateId || action.params.value}" selected.`, data: { templateId: action.params.templateId || action.params.value } };

      case 'blueprint_generate':
        return { action, success: true, summary: `🏗️ Blueprint generated with options: ${JSON.stringify(action.params)}`, data: action.params };

      case 'project_rename':
        return { action, success: true, summary: `✏️ Project renamed to "${action.params.name || action.params.value}".`, data: { name: action.params.name || action.params.value } };

      case 'project_export':
        return { action, success: true, summary: `📦 Export requested: format=${action.params.format || 'zip'}`, data: { format: action.params.format || 'zip' } };

      default:
        return { action, success: false, summary: `Unknown action: ${action.type}` };
    }
  } catch (error) {
    return { action, success: false, summary: `⚠️ Action failed: ${(error as Error).message}` };
  }
}

// Execute all actions
export async function executeAllActions(actions: ChatAction[], apiKey: string): Promise<ActionResult[]> {
  return Promise.all(actions.map(a => executeAction(a, apiKey)));
}

// Pre-chat RAG enrichment
export async function enrichWithRAG(userMessage: string, apiKey: string): Promise<string | null> {
  try {
    const api = createCloudflareApi(apiKey);
    const res = await api.ragSearch(userMessage, 3);
    if (res.results && res.results.length > 0 && res.results[0].score > 0.7) {
      return `[Relevant context from knowledge base]\n${res.results.map((r: RAGSearchResult) => r.content).join('\n---\n')}\n[End context]`;
    }
  } catch { /* RAG not available */ }
  return null;
}
