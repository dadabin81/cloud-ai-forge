

# Fase 10: Sync Projects to Cloudflare for Real Fullstack VibeCoding

## Problem Analysis

Currently there are **two disconnected project storage systems**:

1. **Supabase** (`playground_projects` table): Where projects actually get saved. Files stored as JSONB. Works for persistence but provides zero execution capability.

2. **Cloudflare Durable Object** (`SandboxProject`): Has templates, file operations, exec simulation, start/stop commands. But it's **never called from the frontend**. The `sandboxService.ts` client exists but is never imported in `Playground.tsx`.

The result: Projects are "saved" but only rendered client-side via Babel-in-browser. There's no real dev server, no npm install, no fullstack capability. The Cloudflare Container SDK binding is commented out (`// SANDBOX: Container`), and `handleExec` just returns a simulated string.

## What's Actually Possible Today

Cloudflare Containers SDK is still in beta and not broadly available. However, we CAN leverage what's already deployed and working:

- **D1 Database**: For structured project metadata, version history
- **KV**: For fast file content caching and sharing
- **Durable Objects**: For real-time collaboration state (already deployed as `SandboxProject`)
- **Workers AI**: Already working for chat/code generation
- **R2** (not yet bound): Could store larger project assets

## Solution: Hybrid Storage with Cloudflare Sync

### Part A: Sync projects to Cloudflare KV for fast access

When a project is created/updated in Supabase, also push the files to Cloudflare KV. This gives:
- Fast edge-cached file access for the AI (context window)
- Shareable preview URLs via Cloudflare Workers
- Foundation for future container-based execution

**Changes:**
- Modify `usePlaygroundProject.ts`: After saving to Supabase, also call `POST /v1/projects/{id}/sync` on the Cloudflare worker
- Add endpoint in `cloudflare/src/index.ts`: `/v1/projects/:id/sync` that stores files in KV under `project:{id}:files`
- Add endpoint: `/v1/projects/:id/preview` that serves a built preview HTML directly from the worker (no iframe srcDoc needed)

### Part B: Cloudflare-hosted preview URLs

Instead of building preview HTML client-side and injecting via `srcDoc`, generate a real URL:
`https://binario-api.databin81.workers.dev/v1/projects/{id}/preview`

This worker endpoint:
1. Reads files from KV
2. Runs `buildProjectPreview()` server-side (move the logic to the worker)
3. Returns a full HTML document

Benefits:
- Shareable preview links
- No Babel download on every page load (can be cached)
- Foundation for SSR/edge rendering later

### Part C: Project versioning via D1

Add a `project_versions` table in D1 to track file changes:

```
CREATE TABLE project_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  files_hash TEXT NOT NULL,
  changed_files TEXT, -- JSON array of changed paths
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

This enables:
- Undo/redo of AI changes
- Version history visible in the chat ("v3: added contact page")
- Rollback if AI breaks something

### Part D: AI context from Cloudflare KV

When the user sends a chat message, the system prompt currently builds file context from local state. Enhance this:
- Store a compact project summary in KV: `project:{id}:summary` (file list, component names, routes detected)
- The AI gets better context without sending full file contents every time
- Reduces token usage significantly for large projects

### Part E: Clean up unused sandbox simulation

- Remove the simulated `handleExec`, `handleStart`, `handleStop` from `cloudflare/src/sandbox.ts` (they return fake data)
- Replace with real endpoints: `sync`, `preview`, `versions`
- Keep the Durable Object structure for future container integration
- Remove `sandbox_id`, `sandbox_status`, `preview_url` columns from Supabase `playground_projects` (they're never populated)

## Files to Modify

| File | Change |
|------|--------|
| `cloudflare/src/index.ts` | Add routes: `/v1/projects/:id/sync`, `/v1/projects/:id/preview`, `/v1/projects/:id/versions` |
| `cloudflare/src/sandbox.ts` | Replace simulated exec with real sync/preview/versions handlers using KV and D1 |
| `src/hooks/usePlaygroundProject.ts` | After Supabase save, sync files to Cloudflare KV via API call |
| `src/lib/projectGenerator.ts` | Extract `buildProjectPreview` logic into a shared function usable both client and server side |
| `src/components/CodePreview.tsx` | Add option to use Cloudflare-hosted preview URL instead of srcDoc |
| `src/lib/sandboxService.ts` | Update to use new real endpoints (sync, preview, versions) instead of fake sandbox ones |

## Database Migration (Cloudflare D1)

```sql
CREATE TABLE IF NOT EXISTS project_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  files_hash TEXT NOT NULL,
  changed_files TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions(project_id);
```

## Supabase Migration

Remove unused columns from `playground_projects`:
```sql
ALTER TABLE playground_projects DROP COLUMN IF EXISTS sandbox_id;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS sandbox_status;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS preview_url;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS template_id;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS design_options;
```

## No new dependencies needed

## Expected Result

- Projects auto-sync to Cloudflare on every save (background, non-blocking)
- Each project gets a shareable preview URL: `https://binario-api.../v1/projects/{id}/preview`
- Version history tracks what the AI changed
- AI gets compact project context from KV instead of full file dumps
- Dead sandbox simulation code is replaced with real functionality
- Unused Supabase columns cleaned up

