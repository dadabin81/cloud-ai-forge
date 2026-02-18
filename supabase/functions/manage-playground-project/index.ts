import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_API = "https://binario-api.databin81.workers.dev";

/** Validate the Cloudflare auth token and return the user id */
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate via Cloudflare token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = await validateToken(token);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      return json(data);
    }

    // GET single project
    if (req.method === "GET" && action === "get") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);
      const { data, error } = await supabase
        .from("playground_projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return json(data);
    }

    // CREATE project
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { data, error } = await supabase
        .from("playground_projects")
        .insert([{ user_id: userId, name: body.name, files: body.files ?? {} }])
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    // UPDATE files
    if (req.method === "PUT" && action === "update-files") {
      const body = await req.json();
      if (!body.id) return json({ error: "Missing id" }, 400);
      const { error } = await supabase
        .from("playground_projects")
        .update({ files: body.files })
        .eq("id", body.id)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ success: true });
    }

    // RENAME
    if (req.method === "PUT" && action === "rename") {
      const body = await req.json();
      if (!body.id || !body.name) return json({ error: "Missing id/name" }, 400);
      const { error } = await supabase
        .from("playground_projects")
        .update({ name: body.name })
        .eq("id", body.id)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ success: true });
    }

    // DELETE
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);
      const { error } = await supabase
        .from("playground_projects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-playground-project error:", e);
    return json({ error: e.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
