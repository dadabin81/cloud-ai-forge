
# Fix Build Error + Remaining Inconsistencies

## Build Error (CRITICAL)

The build fails because of a variable hoisting issue in `src/hooks/useBinarioAgent.ts`:

```
Line 330: queueMicrotask(() => performHttpRequest(allMessages, controller));
Line 338: const controller = new AbortController();  // declared AFTER usage
```

TypeScript's strict mode flags `controller` as "used before being assigned" since `const` does not hoist like `var`. The fix is to move `const controller = new AbortController()` BEFORE the `setMessages` call.

Additionally, `performHttpRequest` is missing from `sendHttpFallback`'s `useCallback` dependency array.

## Other Issues Found

### 1. Duplicate useEffect (Playground.tsx lines 205-206)
Two identical `useEffect` calls persist `selectedModel` to localStorage. Remove the duplicate.

### 2. ComparisonSection still claims "Multi-provider support"
Line 16: `{ name: 'Multi-provider support', binario: true, ... }` -- should be changed to reflect Cloudflare-native only (e.g., "Cloudflare-native edge" or mark binario as `'partial'`).

### 3. Backend still returns legacy providers
The deployed worker at `/v1/providers/status` still returns OpenAI, Anthropic, Google, OpenRouter as available. This is a backend code issue in `cloudflare/src/index.ts` that needs to be fixed and re-deployed. However, this is not causing the build failure.

---

## Technical Plan

### Step 1: Fix build error in useBinarioAgent.ts

Move `const controller = new AbortController()` before `setMessages`, and add `performHttpRequest` to the dependency array.

**File:** `src/hooks/useBinarioAgent.ts` (lines 313-340)

Before:
```typescript
setMessages(prev => {
  const allMessages = [...prev, userMessage];
  queueMicrotask(() => {
    performHttpRequest(allMessages, controller);
  });
  return allMessages;
});
setIsLoading(true);
streamingContentRef.current = '';
setStreamingContent('');

const controller = new AbortController();
abortControllerRef.current = controller;
```

After:
```typescript
const controller = new AbortController();
abortControllerRef.current = controller;

setMessages(prev => {
  const allMessages = [...prev, userMessage];
  queueMicrotask(() => {
    performHttpRequest(allMessages, controller);
  });
  return allMessages;
});
setIsLoading(true);
streamingContentRef.current = '';
setStreamingContent('');
```

Also update the dependency array to include `performHttpRequest`.

### Step 2: Remove duplicate useEffect in Playground.tsx

**File:** `src/pages/Playground.tsx` (line 206) -- delete the duplicate line.

### Step 3: Fix ComparisonSection text

**File:** `src/components/ComparisonSection.tsx` (line 16)
- Change `'Multi-provider support'` to `'Cloudflare-native edge'` or similar
- Keep `binario: true`

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useBinarioAgent.ts` | Move controller declaration before setMessages; add performHttpRequest to deps |
| `src/pages/Playground.tsx` | Remove duplicate useEffect on line 206 |
| `src/components/ComparisonSection.tsx` | Update "Multi-provider support" text |

### Order of implementation
1. Fix `useBinarioAgent.ts` (resolves build failure)
2. Fix duplicate useEffect in Playground
3. Update ComparisonSection text
