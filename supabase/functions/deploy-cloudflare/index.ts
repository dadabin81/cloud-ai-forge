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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Input validation
const PROJECT_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;
const MAX_FILES_SIZE = 10 * 1024 * 1024; // 10MB

function validateProjectName(name: unknown): string | null {
  if (typeof name !== "string") return "projectName must be a string";
  if (!PROJECT_NAME_REGEX.test(name)) return "projectName must be lowercase alphanumeric with hyphens (2-60 chars)";
  return null;
}

function validateFiles(files: unknown): string | null {
  if (!files || typeof files !== "object" || Array.isArray(files)) return "files must be a non-empty object";
  if (Object.keys(files as object).length === 0) return "files cannot be empty";
  const serialized = JSON.stringify(files);
  if (serialized.length > MAX_FILES_SIZE) return `files exceed max size of ${MAX_FILES_SIZE / 1024 / 1024}MB`;
  return null;
}

// Structured logging
function log(level: "info" | "warn" | "error", action: string, meta?: Record<string, unknown>) {
  const entry = { level, fn: "deploy-cloudflare", action, ts: new Date().toISOString(), ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      log("warn", "auth_failed", { requestId });
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { files, projectName, accountId, apiToken, playgroundProjectId } = body;

    // Validate inputs
    const nameErr = validateProjectName(projectName);
    if (nameErr) {
      return new Response(JSON.stringify({ success: false, error: nameErr }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filesErr = validateFiles(files);
    if (filesErr) {
      return new Response(JSON.stringify({ success: false, error: filesErr }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accountId || typeof accountId !== "string" || accountId.length > 100) {
      return new Response(JSON.stringify({ success: false, error: "Invalid accountId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiToken || typeof apiToken !== "string" || apiToken.length > 500) {
      return new Response(JSON.stringify({ success: false, error: "Invalid apiToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("info", "deploy_start", { requestId, userId, projectName });

    // Create a deployment record
    let deploymentId: string | null = null;
    if (playgroundProjectId) {
      const { data: depData } = await supabase
        .from("deployments")
        .insert({
          user_id: userId,
          project_id: playgroundProjectId,
          project_name: projectName,
          status: "deploying",
        })
        .select("id")
        .single();
      if (depData) deploymentId = depData.id;
    }

    // Step 1: Ensure Pages project exists
    const projectCheck = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    await projectCheck.text();

    if (!projectCheck.ok) {
      const createRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: "main",
          }),
        }
      );
      const createBody = await createRes.json();
      if (!createRes.ok && !createBody?.errors?.[0]?.message?.includes("already exists")) {
        await updateDeployment(supabase, deploymentId, "failed");
        log("error", "cf_project_create_failed", { requestId, error: createBody?.errors?.[0]?.message });
        return new Response(
          JSON.stringify({ success: false, error: createBody?.errors?.[0]?.message || "Failed to create CF project" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Direct Upload deployment
    const formData = new FormData();
    const manifest: Record<string, string> = {};
    for (const [path, file] of Object.entries(files as Record<string, { code: string }>)) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      manifest[normalizedPath] = path;
      formData.append(path, new Blob([file.code], { type: "text/plain" }), path);
    }
    formData.append("manifest", JSON.stringify(manifest));

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: formData,
      }
    );

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      await updateDeployment(supabase, deploymentId, "failed");
      log("error", "deploy_failed", { requestId, error: deployData?.errors?.[0]?.message, durationMs: Date.now() - startTime });
      return new Response(
        JSON.stringify({ success: false, error: deployData?.errors?.[0]?.message || "Deploy failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deploymentUrl = deployData.result?.url || `https://${projectName}.pages.dev`;
    await updateDeployment(supabase, deploymentId, "success", deploymentUrl);

    log("info", "deploy_success", { requestId, userId, projectName, url: deploymentUrl, durationMs: Date.now() - startTime });

    return new Response(
      JSON.stringify({ success: true, url: deploymentUrl, deploymentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "deploy_exception", { requestId, error: (err as Error).message, durationMs: Date.now() - startTime });
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function updateDeployment(supabase: any, id: string | null, status: string, url?: string) {
  if (!id) return;
  const update: any = { status };
  if (url) update.deployment_url = url;
  await supabase.from("deployments").update(update).eq("id", id);
}
