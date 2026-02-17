

# Fase 9: Fix Preview Rendering, Navigation, and Visual Quality

## Root Causes Found

### 1. Preview breaks with "Cannot use import statement outside a module"
The AI generates JSX files with `import` and `export` statements (e.g., `import React from 'react'`). The preview engine (`buildProjectPreview` in `projectGenerator.ts`) concatenates all JSX into a single `<script type="text/babel">` block. Babel Standalone in the browser does NOT support `import/export` — it only transpiles JSX syntax. The `import` line causes the SyntaxError that kills the entire preview.

### 2. Template `index.html` has dead references
The templates' `index.html` includes `<link rel="stylesheet" href="src/styles/globals.css" />` — but inside an iframe with `srcDoc`, there's no filesystem. These `<link>` and `<script src="...">` tags pointing to project files simply fail silently or produce errors. The preview engine's JSX path correctly injects CSS inline, but the HTML path doesn't strip these dead references.

### 3. No navigation between pages
The preview is a single iframe with `srcDoc`. There's no routing support. If the AI generates multi-page components (e.g., Home, About, Contact with navigation links), clicking links does nothing or breaks the preview.

### 4. Double `ReactDOM.createRoot`
Templates' `App.jsx` includes `ReactDOM.createRoot(document.getElementById('root')).render(<App />);` AND the preview engine adds its own auto-detect render loop. This causes double rendering attempts.

---

## Solution

### Part A: Strip import/export from JSX before preview

Modify `buildProjectPreview()` in `src/lib/projectGenerator.ts`:

Add a `stripModuleSyntax()` function that removes:
- `import ... from '...'` statements
- `import '...'` (side-effect imports)
- `export default ...` -> keep the declaration
- `export { ... }` -> remove
- `export const/function` -> keep as `const/function`

Also strip `ReactDOM.createRoot(...)...render(...)` calls from individual files (the engine adds its own).

Apply this to all JSX code before concatenation into `<script type="text/babel">`.

### Part B: Add a lightweight hash router to the preview

Inject a minimal hash-based router into the preview HTML so multi-page apps work:

```text
// Injected into preview:
function useHashRouter() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

function Route({ path, children }) { ... }
function Link({ to, children, ...props }) { ... }
```

This gets injected alongside the React hooks destructuring in the preview template, so AI-generated code can use `<Link to="/about">` and `<Route path="/about">` without importing anything.

### Part C: Fix template index.html

Update templates in `src/lib/templates.ts`:
- Remove `<link rel="stylesheet">` and `<script src="...">` tags pointing to project files — these never work in `srcDoc` mode
- Remove `ReactDOM.createRoot(...).render(...)` from App.jsx templates — the engine handles this
- The `index.html` in templates becomes a simple metadata placeholder (the engine builds the actual document)

### Part D: Improve Tailwind detection and CDN loading

Currently Tailwind is detected by regex on class names. Improve to also check for explicit `tailwindcss` mentions in code. Also upgrade from `react.development.min.js` to `react.production.min.js` consistently (currently mixed: development for React, production for ReactDOM).

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/projectGenerator.ts` | Add `stripModuleSyntax()`, inject hash router helpers, fix React CDN URLs, strip dead `ReactDOM.createRoot` from templates |
| `src/lib/templates.ts` | Remove dead `<link>`/`<script src>` from index.html, remove `ReactDOM.createRoot` from App.jsx |
| `src/lib/codeExtractor.ts` | Apply same `stripModuleSyntax()` in `buildReactDocument()` |

No new files. No new dependencies. No database changes.

---

## Expected Result

- AI-generated projects with `import/export` statements render correctly in the preview
- Templates load instantly without SyntaxError
- Multi-page apps can navigate between routes using hash-based routing
- CSS is always properly injected inline
- No more double-render warnings
- Preview shows professional, working applications immediately

