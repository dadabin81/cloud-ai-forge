

# Investigation: Where User Projects Are Stored (and Why They Don't Save)

## Finding: Dual Auth System Conflict (ROOT CAUSE)

The system has **two separate authentication systems** that don't talk to each other:

1. **Cloudflare Worker Auth** (`AuthContext.tsx`): Users log in via `binario-api.databin81.workers.dev/v1/auth/login`. This sets a `binario_token` in localStorage and provides `isAuthenticated = true` to the app.

2. **Lovable Cloud Auth** (`supabase.auth`): The database has a `playground_projects` table with RLS policies requiring `auth.uid() = user_id`. The `usePlaygroundProject` hook calls `supabase.auth.getUser()` to get the user ID.

**The problem**: When a user logs in via Cloudflare, they are NOT logged into Lovable Cloud. So `supabase.auth.getUser()` always returns `null`. The `createProject` function sees no user and shows "Login required to save projects" -- but this toast may be missed. Projects are never inserted into the database.

**Proof**: The `playground_projects` table has **0 rows** -- no project has ever been saved.

## Current Data Flow (Broken)

```text
User logs in via Cloudflare Worker Auth
        |
        v
isAuthenticated = true (Cloudflare token in localStorage)
        |
        v
User generates code in Playground
        |
        v
usePlaygroundProject.createProject() called
        |
        v
supabase.auth.getUser() --> returns NULL (user not in Supabase Auth)
        |
        v
"Login required" --> project NOT saved --> files lost on refresh
```

## Solution: Unify Auth for Project Persistence

There are two approaches:

### Option A: Use Supabase Auth for Everything (Recommended)
- Replace the Cloudflare Worker auth (`/v1/auth/login`, `/v1/auth/signup`) with Supabase Auth
- This way `supabase.auth.getUser()` works, RLS policies work, and projects save correctly
- The Cloudflare worker would validate Supabase JWT tokens instead of its own session tokens

### Option B: Bypass Supabase Auth in the Hook (Quick Fix)
- Modify `usePlaygroundProject` to use the Cloudflare user ID (from `AuthContext`) instead of `supabase.auth.getUser()`
- Disable RLS on `playground_projects` or use a service-role edge function to insert/update
- This keeps both auth systems but adds complexity

## Recommended Implementation (Option B - Quick Fix for Now)

### Step 1: Pass Cloudflare user ID to the hook
Modify `usePlaygroundProject` to accept a `userId` parameter from `AuthContext` instead of calling `supabase.auth.getUser()`.

### Step 2: Create a backend function for project CRUD
Since RLS requires `auth.uid()`, and the user isn't in Supabase Auth, create a backend function (`manage-playground-project`) that uses the service role to bypass RLS and perform CRUD operations on `playground_projects`. The function validates the Cloudflare auth token before proceeding.

### Step 3: Update RLS policies (alternative to Step 2)
Alternatively, add a simpler RLS policy that allows operations when a custom header or claim matches the `user_id` column. However, the edge function approach is more secure.

### Step 4: Verify save and load flow
- On project creation: call the edge function with the Cloudflare user ID and files
- On project load: query via the edge function filtered by user ID
- On auto-save: debounced call to the edge function

## Technical Details

### Files to modify:
- `src/hooks/usePlaygroundProject.ts` -- accept userId param, call edge function instead of direct Supabase
- `src/pages/Playground.tsx` -- pass `user?.id` from AuthContext to the hook
- New edge function: `supabase/functions/manage-playground-project/index.ts`

### Edge function responsibilities:
- Validate Cloudflare auth token (call `binario-api.databin81.workers.dev/v1/auth/me`)
- CRUD on `playground_projects` using service role client
- Return project data to the frontend

### Database: No schema changes needed
The `playground_projects` table already has the correct structure. Only the auth flow for accessing it needs fixing.

