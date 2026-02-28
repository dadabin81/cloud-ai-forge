

# Comparative Analysis: Lovable vs BLACKBOXAI vs Binario

## 1. Architecture Comparison

```text
┌─────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Dimension    │ Lovable          │ BLACKBOXAI       │ Binario (current)│
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Execution   │ Parallel tools   │ Sequential       │ Sequential HTTP  │
│             │ (batch calls)    │ (1 tool/msg)     │ or WS streaming  │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Edit Method │ Search-replace   │ SEARCH/REPLACE   │ Full file write  │
│             │ (line-based)     │ (diff blocks)    │ (// filename:)   │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Preview     │ Live iframe      │ Puppeteer 900x600│ srcdoc iframe    │
│             │ (hot reload)     │ (screenshots)    │ (manual refresh) │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Backend     │ Supabase native  │ CLI commands     │ Cloudflare D1/KV │
│             │ + Edge Functions │ (user's machine) │ + Workers AI     │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Planning    │ Discussion-first │ brainstorm_plan  │ None (direct gen)│
│             │ then implement   │ then user approve│                  │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Design Sys  │ Strict tokens    │ None specified   │ None enforced    │
│             │ (HSL, semantic)  │                  │                  │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ State Mgmt  │ Context window   │ Step-by-step     │ WS reactive +   │
│             │ + useful-context │ user confirms    │ localStorage     │
└─────────────┴──────────────────┴──────────────────┴──────────────────┘
```

## 2. Key Patterns Worth Adopting for Binario

### A. Discussion-First Mode (from Lovable)
Lovable defaults to **planning mode** unless the user uses action words ("implement", "build", "create"). Binario currently generates code immediately on any message. This causes the "descriptive text instead of code" problem we already fixed.

**Recommendation**: Add intent detection to the system prompt. If the user says "quiero una landing page", discuss first. If they say "crea una landing page", generate code.

### B. Design System Enforcement (from Lovable)
Lovable strictly prohibits inline colors (`text-white`, `bg-black`) and mandates semantic tokens from `index.css` + `tailwind.config.ts`. Binario has no design system enforcement, which leads to inconsistent generated code.

**Recommendation**: Add design system rules to Binario's system prompt so generated projects use semantic tokens from the start.

### C. Incremental Edits (from both Lovable & BLACKBOXAI)
Both competitors use **search-replace** patterns for edits rather than regenerating entire files. Binario currently regenerates full files with `// filename:` markers, which is wasteful and error-prone for large projects.

**Recommendation**: Implement an `[EDIT_FILE:path]` marker format that uses diff-style edits for existing files, keeping `// filename:` only for new file creation.

### D. Context Efficiency (from Lovable)
Lovable's "NEVER READ FILES ALREADY IN CONTEXT" rule and `useful-context` section prevent redundant file reads. Binario has no context management - it re-reads or re-generates everything.

**Recommendation**: When syncing projects, pass the current file tree as context to the AI so it knows what already exists and can make targeted edits.

## 3. What Binario Does Better

| Aspect | Binario Advantage |
|--------|-------------------|
| Backend | Cloudflare Workers AI is serverless + edge-native, no separate account needed |
| Agent Tools | Native tool calling (image gen, translation, RAG) built into the agent |
| Streaming | WebSocket reactive state synced to all clients via Agents SDK |
| Cost | Workers AI free tier with neuron-based pricing vs Supabase usage-based |

## 4. Critical Gaps to Address

### Gap 1: No Planning Phase
Binario jumps straight to code generation. Both Lovable and BLACKBOXAI enforce a planning/discussion step.

### Gap 2: No Design System in Generated Code
Generated projects use hardcoded colors and styles. Lovable mandates HSL tokens and semantic variables.

### Gap 3: No Incremental Edit Support
Every change regenerates full files. Both competitors support targeted search-replace edits.

### Gap 4: No Context Awareness
The AI doesn't know what files already exist in the project when generating updates.

## 5. Implementation Plan

### Phase 1: Enhance System Prompt (immediate)
**File: `src/pages/Playground.tsx`**
- Add intent detection rules (discuss vs generate)
- Add design system generation rules (mandate HSL tokens, semantic classes)
- Add context injection: include current file list in the prompt when files exist

### Phase 2: Add Edit Mode Support
**File: `src/hooks/useProjectSync.ts`**
- Parse `[EDIT_FILE:path]` markers with SEARCH/REPLACE blocks
- Apply diffs to existing files instead of overwriting
- Keep `// filename:` for new file creation only

### Phase 3: Context Injection
**File: `src/pages/Playground.tsx`**
- When `projectFiles` is non-empty, append a "Current Project Files" section to the system prompt listing all filenames
- This tells the AI what exists so it can make targeted edits

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Playground.tsx` | Intent detection rules, design system rules, context injection |
| `src/hooks/useProjectSync.ts` | Parse EDIT_FILE markers with diff blocks |
| `src/lib/codeExtractor.ts` | Add diff/edit block parsing utilities |

