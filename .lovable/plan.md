
# Unleashing Binario's Full Cloudflare Arsenal in the Playground

## The Problem

Right now, the Playground only uses ONE endpoint (`/v1/chat/completions`). Meanwhile, the backend has **8 active Cloudflare bindings** that are completely hidden from users:

| Binding | Status in Playground |
|---------|---------------------|
| env.AI (Workers AI) | Used (chat only) |
| env.BINARIO_AGENT (Durable Object) | WebSocket toggle exists, but not showcased |
| env.SANDBOX_PROJECT (Durable Object) | Completely unused |
| env.DB (D1 Database) | Hidden from users |
| env.KV (KV Namespace) | Hidden from users |
| env.VECTORIZE_INDEX (Vectorize) | Completely unused |
| env.RESEARCH_WORKFLOW (Workflow) | Completely unused |
| env.RAG_WORKFLOW (Workflow) | Completely unused |

## The Solution

Add a **"Binario Cloud" panel** to the Playground that exposes all backend capabilities as interactive features, demonstrating Binario's dominance as a full-stack AI SDK.

## Changes

### 1. New Component: `src/components/CloudPanel.tsx` - Infrastructure Dashboard

A tabbed panel that replaces the empty state in the File Explorer area (or appears as a new sidebar section) showing all available Cloudflare resources:

**Tab: AI Models**
- Show the 6 available models from `/v1/models` with tier badges
- One-click model switching
- Live token/neuron counter

**Tab: RAG (Vectorize)**
- Text input to **ingest documents** via `/v1/rag/ingest`
- Search box to **query documents** via `/v1/rag/query`
- Show embedding info via `/v1/rag/info`
- Display search results with relevance scores
- This demonstrates the Vectorize binding in action

**Tab: Workflows**
- Button to launch **Research Workflow** via `/v1/workflows/research`
- Button to launch **RAG Ingest Workflow** via `/v1/workflows/rag-ingest`
- Status checker via `/v1/workflows/status/:id` with polling
- Shows step-by-step progress of multi-step AI workflows
- This demonstrates the durable Workflows binding

**Tab: Sandbox (Projects)**
- Template selector (react-vite, node-express, vanilla-js, python-flask)
- Create project button via `/v1/projects/` endpoints
- File manager using the SandboxProject DO
- This demonstrates the Durable Object binding for project management

**Tab: Status**
- Live health dashboard from `/health` showing all binding statuses
- Provider status from `/v1/providers/status`
- Visual indicators: AI, D1, KV, Vectorize, Workflows, Durable Objects all green

### 2. Modify: `src/pages/Playground.tsx` - Add Cloud Panel

- Add a new "Cloud" tab/button in the top bar next to "Config"
- When clicked, shows the CloudPanel as a Sheet or as a fourth resizable panel
- The panel connects to all the backend endpoints using the user's API key
- Auto-refresh health status on load

### 3. New Component: `src/components/ResourceBadges.tsx` - Top Bar Indicators

A row of small badges in the Playground top bar showing live status of each binding:
- AI (green) | D1 (green) | KV (green) | Vectorize (green) | Workflows (green) | DO (green)
- Clicking any badge opens the corresponding Cloud Panel tab
- This immediately communicates to users the breadth of Binario's infrastructure

### 4. Modify: System Prompt Enhancement

Update the DEFAULT_SYSTEM_PROMPT to be aware of all Cloudflare capabilities:
- When user asks for a project with data persistence, mention D1
- When user asks for search/knowledge base, mention RAG with Vectorize
- When user asks for complex multi-step tasks, mention Workflows
- This makes the AI assistant itself a demo of the platform's knowledge

### 5. New Utility: `src/lib/cloudflareApi.ts` - API Client for All Endpoints

Centralized API client with typed methods for every backend endpoint:
- `ragIngest(content, metadata)` - Ingest documents
- `ragSearch(query, topK)` - Semantic search
- `ragQuery(query)` - RAG query with AI answer
- `workflowResearch(topic)` - Start research workflow
- `workflowStatus(instanceId)` - Check workflow status
- `projectCreate(name, template)` - Create sandbox project
- `projectFiles(id)` - List project files
- `healthCheck()` - Full health status

## User Experience Flow

```text
1. User opens Playground
   -> Top bar shows: AI | D1 | KV | Vectorize | Workflows | DO - all green
   -> This immediately shows the platform's power

2. User clicks "Cloud" button
   -> Panel opens showing all resources in tabs

3. RAG Demo:
   -> User pastes a document into "Ingest" tab
   -> Clicks "Ingest" -> document is chunked, embedded, stored
   -> User types a question in "Query" -> gets AI answer with sources
   -> User sees: "Powered by Vectorize + Workers AI"

4. Workflow Demo:
   -> User types a research topic
   -> Clicks "Research" -> workflow starts
   -> Live status: "Step 1/4: Analyzing query..." 
   -> Shows final research report with sources

5. Sandbox Demo:
   -> User selects "React Vite" template
   -> Clicks "Create Project"
   -> File Explorer populates with template files
   -> Shows project managed by Durable Object

6. Regular Chat:
   -> All existing chat + code preview + file explorer functionality preserved
```

## Why This Dominates the VibeCoding SDK Market

No other SDK (Vercel AI, LangChain, etc.) offers ALL of these in one playground:
- Real-time WebSocket chat via Durable Objects
- Persistent project management via Durable Objects
- Semantic search via Vectorize embeddings
- Multi-step AI workflows via Cloudflare Workflows
- Persistent storage via D1 + KV
- 6 free AI models via Workers AI
- All running on edge, globally distributed, zero cold start

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/cloudflareApi.ts` | CREATE - Typed API client for all endpoints |
| `src/components/CloudPanel.tsx` | CREATE - Infrastructure dashboard with tabs |
| `src/components/ResourceBadges.tsx` | CREATE - Status badges for top bar |
| `src/pages/Playground.tsx` | MODIFY - Add Cloud button, resource badges, panel integration |

No new dependencies required. Uses existing UI components (Tabs, Badge, Sheet, Button) and the existing API_BASE_URL.
