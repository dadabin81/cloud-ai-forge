import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { files, projectName, accountId, apiToken, playgroundProjectId } = await req.json();

    if (!files || !projectName || !accountId || !apiToken) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const projectCheckBody = await projectCheck.text();

    if (!projectCheck.ok) {
      // Create project
      const createRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
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
        return new Response(
          JSON.stringify({ success: false, error: createBody?.errors?.[0]?.message || "Failed to create CF project" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Direct Upload deployment
    const formData = new FormData();

    // Build manifest
    const manifest: Record<string, string> = {};
    for (const [path, file] of Object.entries(files as Record<string, { code: string }>)) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      manifest[normalizedPath] = path;
      formData.append(path, new Blob([file.code], { type: "text/plain" }), path);
    }
    formData.append("manifest", JSON.stringify(manifest));

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: formData,
      }
    );

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      await updateDeployment(supabase, deploymentId, "failed");
      return new Response(
        JSON.stringify({ success: false, error: deployData?.errors?.[0]?.message || "Deploy failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deploymentUrl = deployData.result?.url || `https://${projectName}.pages.dev`;

    // Update deployment record
    await updateDeployment(supabase, deploymentId, "success", deploymentUrl);

    return new Response(
      JSON.stringify({ success: true, url: deploymentUrl, deploymentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
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
