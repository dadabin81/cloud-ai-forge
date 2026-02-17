// Chat Action System - Simplified for Chat-First architecture
// Only keeps actions that actually work (RAG + workflows)

import { createCloudflareApi, type RAGSearchResult, type WorkflowInstance } from '@/lib/cloudflareApi';

export interface ChatAction {
  type: 'rag_search' | 'rag_ingest' | 'rag_query' | 'workflow_research' | 'workflow_rag_ingest' | 'workflow_status';
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

      case 'workflow_research': {
        const res = await api.workflowResearch(action.params.topic || action.params.value);
        return { action, success: true, summary: `🔬 Research workflow started! ID: \`${res.instanceId}\``, data: res };
      }

      case 'workflow_rag_ingest': {
        const res = await api.workflowRAGIngest(action.params.url || action.params.value);
        return { action, success: true, summary: `📥 RAG ingest workflow started! ID: \`${res.instanceId}\``, data: res };
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

/**
 * Detect user intent from chat message for automatic orchestration.
 * Returns detected intents so the Playground can act accordingly.
 */
export type UserIntent = 'new_project' | 'modify' | 'deploy' | 'export' | 'general';

export function detectUserIntent(message: string, hasExistingFiles: boolean): UserIntent {
  const lower = message.toLowerCase();

  // Deploy intent
  if (/\b(deploy|deploya|publica|publish|sube|subir|hostear|host)\b/.test(lower)) {
    return 'deploy';
  }

  // Export intent
  if (/\b(export|exporta|descarga|download|zip|descargar)\b/.test(lower)) {
    return 'export';
  }

  // New project intent (only if no existing files)
  if (!hasExistingFiles) {
    const newPatterns = [
      /\b(crea|create|build|make|genera|develop|diseña|design|haz|hazme|construye)\b/i,
      /\b(quiero|want|necesito|need)\b.*\b(una?|an?)\b/i,
    ];
    if (newPatterns.some(p => p.test(lower))) return 'new_project';
  }

  // Modify intent (if files exist and user asks for changes)
  if (hasExistingFiles) {
    const modifyPatterns = [
      /\b(agrega|add|cambia|change|modifica|modify|actualiza|update|mejora|improve|arregla|fix|quita|remove|elimina|delete)\b/i,
    ];
    if (modifyPatterns.some(p => p.test(lower))) return 'modify';
  }

  return hasExistingFiles ? 'modify' : 'new_project';
}
