// Chat Action System
// Automatically detects intent from AI responses and executes Cloudflare APIs
// The AI outputs [ACTION:type:params] markers, this module parses and executes them

import { createCloudflareApi, type RAGSearchResult, type WorkflowInstance } from '@/lib/cloudflareApi';

export interface ChatAction {
  type: 'rag_search' | 'rag_ingest' | 'rag_query' | 'workflow_research' | 'workflow_rag_ingest' | 'workflow_status' | 'project_create';
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
    try {
      params = JSON.parse(match[2]);
    } catch {
      // Simple string param
      params = { value: match[2] };
    }
    actions.push({ type: match[1] as ChatAction['type'], params, raw: match[0] });
  }

  // Remove action markers from visible text
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
            : '🔍 No matching documents found in the knowledge base.',
          data: results,
        };
      }

      case 'rag_query': {
        const res = await api.ragQuery(action.params.query || action.params.value);
        return {
          action, success: true,
          summary: `📚 **RAG Answer:**\n${res.answer}\n\n*Sources: ${res.sources?.length || 0} documents used*`,
          data: res,
        };
      }

      case 'rag_ingest': {
        const res = await api.ragIngest(action.params.content || action.params.value);
        return {
          action, success: true,
          summary: `✅ Document ingested successfully! Created ${res.chunks} vector chunks. Document ID: \`${res.documentId}\``,
          data: res,
        };
      }

      case 'workflow_research': {
        const res = await api.workflowResearch(action.params.topic || action.params.value);
        return {
          action, success: true,
          summary: `🔬 Research workflow started! Tracking ID: \`${res.instanceId}\`\n⏳ The workflow is running in the background (analyze → search → synthesize → report).`,
          data: res,
        };
      }

      case 'workflow_rag_ingest': {
        const res = await api.workflowRAGIngest(action.params.url || action.params.value);
        return {
          action, success: true,
          summary: `📥 RAG ingest workflow started for URL! Tracking ID: \`${res.instanceId}\`\n⏳ Processing: fetch → extract → chunk → embed → index.`,
          data: res,
        };
      }

      case 'workflow_status': {
        const res = await api.workflowStatus(action.params.instanceId || action.params.value);
        const statusEmoji = res.status === 'complete' ? '✅' : res.status === 'running' ? '⏳' : res.status === 'errored' ? '❌' : '🕐';
        let summary = `${statusEmoji} Workflow status: **${res.status}**`;
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
        const res = await api.projectCreate(
          action.params.name || 'my-project',
          action.params.template || 'react-vite'
        );
        return {
          action, success: true,
          summary: `🚀 Sandbox project "${res.name}" created!\nTemplate: ${res.template} | ID: \`${res.id}\`\nManaged by Durable Objects on the edge.`,
          data: res,
        };
      }

      default:
        return { action, success: false, summary: `Unknown action: ${action.type}` };
    }
  } catch (error) {
    return {
      action, success: false,
      summary: `⚠️ Action failed: ${(error as Error).message}`,
    };
  }
}

// Execute all actions and return combined results
export async function executeAllActions(actions: ChatAction[], apiKey: string): Promise<ActionResult[]> {
  return Promise.all(actions.map(a => executeAction(a, apiKey)));
}

// Pre-chat RAG enrichment: search knowledge base for context before sending to AI
export async function enrichWithRAG(userMessage: string, apiKey: string): Promise<string | null> {
  try {
    const api = createCloudflareApi(apiKey);
    const res = await api.ragSearch(userMessage, 3);
    if (res.results && res.results.length > 0 && res.results[0].score > 0.7) {
      return `[Relevant context from knowledge base]\n${res.results.map((r: RAGSearchResult) => r.content).join('\n---\n')}\n[End context]`;
    }
  } catch {
    // RAG not available, continue without
  }
  return null;
}
