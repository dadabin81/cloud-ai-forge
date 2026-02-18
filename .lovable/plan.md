

# Binario IDE Playground - Complete System Overhaul

## Root Cause Analysis

After investigating the full code flow (Playground.tsx, codeExtractor, projectGenerator, sandboxService, CodePreview, and the Cloudflare worker), I identified **6 critical root causes** why projects don't generate, don't save, and don't preview:

### Problem 1: System Prompt is Stale (CRITICAL)
The system prompt is loaded from `localStorage` first (line 114 of Playground.tsx). Users who visited the page before the recent prompt upgrade still have the old `"You are a helpful AI assistant."` stored. This is confirmed in the network request logs -- the API calls send `"You are a helpful AI assistant."` as the system prompt, causing the AI to generate Python/Flask code instead of web apps.

### Problem 2: Default Model Too Weak
The default model is `@cf/meta/llama-3.1-8b-instruct` (line 109). This 8B parameter model cannot reliably follow the complex file format instructions. The 70B model (`llama-3.3-70b-instruct-fp8-fast`) produces much better results, as seen in the network responses.

### Problem 3: Preview Uses Remote URL Instead of Local Render (CRITICAL)
Line 1108: when a project exists in the database, the preview iframe loads from `https://binario-api.databin81.workers.dev/v1/projects/{id}/preview` (remote hosted URL) instead of rendering locally via `srcDoc`. The Cloudflare sync is async and may not have completed -- or the Durable Object may not have the files yet -- so the preview shows "Project not found" or nothing.

### Problem 4: Multiple Parallel HTTP Requests
The network logs show 3-4 identical simultaneous POST requests to `/v1/chat/completions`. This happens because the suggestion chip handler (`handleSuggestionClick`) triggers `sendHttp` multiple times through a `setTimeout` pattern. This causes 429 rate limiting.

### Problem 5: File Parser Misses AI Output Formats
The AI returns file markers like `// index.html: public/index.html` and `// App.js: src/App.js` (format: `// name: path`), but the parser regex only matches `// filename: path`. The generated code never gets parsed into project files.

### Problem 6: Project Auto-Save Race Condition
When a project is created (line 329-331), the `createProject` call is async and sets the project state. But the `saveFiles` call on the same render cycle uses the old `project` (null), so files aren't saved to the database.

---

## Implementation Plan

### Step 1: Fix System Prompt Versioning
**File: `src/pages/Playground.tsx`**
- Add a version constant to the system prompt (e.g., `PROMPT_VERSION = 3`)
- On component mount, check if stored version matches; if not, reset to `DEFAULT_SYSTEM_PROMPT`
- This ensures all users get the upgraded prompt automatically

### Step 2: Upgrade Default Model
**File: `src/pages/Playground.tsx`**
- Change default model from `@cf/meta/llama-3.1-8b-instruct` to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- The 70B model reliably produces proper React/JSX code with correct file markers

### Step 3: Fix Preview to Use Local Render (Priority)
**File: `src/pages/Playground.tsx`**
- Remove `hostedPreviewUrl` prop from CodePreview when there are local `projectFiles`
- Only use hosted preview when explicitly requested (e.g., "share" button)
- Local `srcDoc` rendering is instant and always works; hosted preview is a bonus for sharing

### Step 4: Fix Duplicate Request Bug
**File: `src/pages/Playground.tsx`**
- Rewrite `handleSuggestionClick` to call `sendHttp` exactly once
- Remove the `setTimeout` + double-call pattern
- Add a guard (`isStreamingOrLoading` check) to prevent concurrent requests

### Step 5: Expand File Parser to Match All AI Formats
**File: `src/lib/projectGenerator.ts`**
- Add regex pattern for `// name.ext: path/to/file.ext` format (what the AI actually produces)
- Add regex for `// name: path` format
- This ensures code blocks are correctly extracted into project files regardless of AI formatting variations

### Step 6: Fix Project Save Race Condition
**File: `src/pages/Playground.tsx`**
- In the file detection effect, when `createProject` returns the new project, call `saveFiles` with the returned project instead of relying on stale state
- Ensure files are persisted to the database on first generation

### Step 7: Make Cloudflare Sync Non-Blocking and Resilient
**File: `src/hooks/usePlaygroundProject.ts`**
- Keep `sandboxService.syncProject` as background-only (already is)
- Add retry logic with exponential backoff for sync failures
- The preview should never depend on sync completing

---

## Technical Details

### System Prompt Versioning (Step 1)
```text
const PROMPT_VERSION = 3;
const PROMPT_VERSION_KEY = 'binario_prompt_version';

// On mount: if stored version !== PROMPT_VERSION, reset prompt
useEffect(() => {
  const storedVersion = localStorage.getItem(PROMPT_VERSION_KEY);
  if (storedVersion !== String(PROMPT_VERSION)) {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    localStorage.setItem(PROMPT_VERSION_KEY, String(PROMPT_VERSION));
    localStorage.setItem(STORAGE_KEYS.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  }
}, []);
```

### Preview Fix (Step 3)
```text
// Before (broken):
hostedPreviewUrl={project ? sandboxService.getPreviewUrl(project.id) : undefined}

// After (working):
// Remove hostedPreviewUrl entirely - always use local srcDoc render
<CodePreview
  files={projectFiles}
  onErrors={handlePreviewErrors}
  onImportProject={handleImportProject}
  projectName={project?.name}
/>
```

### Suggestion Click Fix (Step 4)
```text
const handleSuggestionClick = (suggestion: string) => {
  if (isStreamingOrLoading) return;
  if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
    sendWebSocket(suggestion);
  } else {
    sendHttp(suggestion);
  }
};
```

### Parser Expansion (Step 5)
Add this pattern to the regex in `parseProjectFiles`:
```text
// Match: // name.ext: path/name.ext  (before a code block)
/\/\/\s*[\w.-]+:\s*(.+?)\s*\n/
```

### Save Race Condition Fix (Step 6)
```text
// In the file detection effect, after createProject:
const newProject = await createProject(firstUserMessageRef.current, mergedFiles);
// Files are already passed to createProject, so they're saved with the project
```

---

## Expected Outcome

After these changes:
1. Every user gets the professional system prompt (no more Python generation)
2. The 70B model produces correct React/JSX with proper file markers
3. Preview renders instantly from local files (no dependency on Cloudflare sync)
4. No duplicate API calls or 429 rate limiting
5. All AI output formats are correctly parsed into project files
6. Projects are properly saved to the database on first creation

