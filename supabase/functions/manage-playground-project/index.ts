import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS restricted to known origins
const ALLOWED_ORIGINS = [
  "https://binarioai-sdk.lovable.app",
  "https://id-preview--af47edef-326b-4b2e-9f3e-9546054449d2.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

// Input validation helpers
const MAX_PROJECT_NAME = 100;
const MAX_FILES_SIZE = 5 * 1024 * 1024; // 5MB
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateProjectName(name: unknown): string | null {
  if (typeof name !== "string") return "name must be a string";
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_PROJECT_NAME) return `name must be 1-${MAX_PROJECT_NAME} chars`;
  if (/[<>"'`;]/.test(trimmed)) return "name contains invalid characters";
  return null;
}

function validateFiles(files: unknown): string | null {
  if (files === undefined || files === null) return null; // optional
  if (typeof files !== "object" || Array.isArray(files)) return "files must be an object";
  const serialized = JSON.stringify(files);
  if (serialized.length > MAX_FILES_SIZE) return `files exceed max size of ${MAX_FILES_SIZE / 1024 / 1024}MB`;
  return null;
}

function validateUUID(id: unknown): string | null {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) return "invalid UUID";
  return null;
}

// Structured logging
function log(level: "info" | "warn" | "error", action: string, userId: string, meta?: Record<string, unknown>) {
  const entry = { level, action, userId, ts: new Date().toISOString(), ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

const CLOUDFLARE_API = "https://binario-api.databin81.workers.dev";

async function validateToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${CLOUDFLARE_API}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  // Authenticate via Cloudflare token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing token" }, 401, corsHeaders);
  }

  const userId = await validateToken(token);
  if (!userId) {
    log("warn", "auth_failed", "unknown", { requestId });
    return json({ error: "Invalid token" }, 401, corsHeaders);
  }

  // Service-role client to bypass RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // LIST projects
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("playground_projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      log("info", "list", userId, { requestId, count: data?.length, durationMs: Date.now() - startTime });
      return json(data, 200, corsHeaders);
    }

    // GET single project
    if (req.method === "GET" && action === "get") {
      const id = url.searchParams.get("id");
      const idErr = validateUUID(id);
      if (idErr) return json({ error: idErr }, 400, corsHeaders);
      const { data, error } = await supabase
        .from("playground_projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      log("info", "get", userId, { requestId, projectId: id, durationMs: Date.now() - startTime });
      return json(data, 200, corsHeaders);
    }

    // CREATE project
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const nameErr = validateProjectName(body.name);
      if (nameErr) return json({ error: nameErr }, 400, corsHeaders);
      const filesErr = validateFiles(body.files);
      if (filesErr) return json({ error: filesErr }, 400, corsHeaders);

      const { data, error } = await supabase
        .from("playground_projects")
        .insert([{ user_id: userId, name: body.name.trim(), files: body.files ?? {} }])
        .select()
        .single();
      if (error) throw error;
      log("info", "create", userId, { requestId, projectId: data?.id, durationMs: Date.now() - startTime });
      return json(data, 200, corsHeaders);
    }

    // UPDATE files
    if (req.method === "PUT" && action === "update-files") {
      const body = await req.json();
      const idErr = validateUUID(body.id);
      if (idErr) return json({ error: idErr }, 400, corsHeaders);
      const filesErr = validateFiles(body.files);
      if (filesErr) return json({ error: filesErr }, 400, corsHeaders);

      const { error } = await supabase
        .from("playground_projects")
        .update({ files: body.files })
        .eq("id", body.id)
        .eq("user_id", userId);
      if (error) throw error;
      log("info", "update-files", userId, { requestId, projectId: body.id, durationMs: Date.now() - startTime });
      return json({ success: true }, 200, corsHeaders);
    }

    // RENAME
    if (req.method === "PUT" && action === "rename") {
      const body = await req.json();
      const idErr = validateUUID(body.id);
      if (idErr) return json({ error: idErr }, 400, corsHeaders);
      const nameErr = validateProjectName(body.name);
      if (nameErr) return json({ error: nameErr }, 400, corsHeaders);

      const { error } = await supabase
        .from("playground_projects")
        .update({ name: body.name.trim() })
        .eq("id", body.id)
        .eq("user_id", userId);
      if (error) throw error;
      log("info", "rename", userId, { requestId, projectId: body.id, durationMs: Date.now() - startTime });
      return json({ success: true }, 200, corsHeaders);
    }

    // DELETE
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const idErr = validateUUID(id);
      if (idErr) return json({ error: idErr }, 400, corsHeaders);

      const { error } = await supabase
        .from("playground_projects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      log("info", "delete", userId, { requestId, projectId: id, durationMs: Date.now() - startTime });
      return json({ success: true }, 200, corsHeaders);
    }

    return json({ error: "Unknown action" }, 400, corsHeaders);
  } catch (e) {
    log("error", action ?? "unknown", userId, { requestId, error: e.message, durationMs: Date.now() - startTime });
    return json({ error: e.message ?? "Internal error" }, 500, corsHeaders);
  }
});

function json(data: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
