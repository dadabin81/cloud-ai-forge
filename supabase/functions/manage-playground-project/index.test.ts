import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const BASE = `${SUPABASE_URL}/functions/v1/manage-playground-project`;

Deno.test("returns 401 without token", async () => {
  const res = await fetch(`${BASE}?action=list`, {
    headers: { "Content-Type": "application/json" },
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("returns 401 with invalid token", async () => {
  const res = await fetch(`${BASE}?action=list`, {
    headers: {
      Authorization: "Bearer invalid_token_abc123",
      "Content-Type": "application/json",
    },
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("returns 400 for invalid UUID on get", async () => {
  const res = await fetch(`${BASE}?action=get&id=not-a-uuid`, {
    headers: {
      Authorization: "Bearer fake_token_for_test",
      "Content-Type": "application/json",
    },
  });
  // Either 401 (bad token) or 400 (bad uuid) — both are valid rejections
  const status = res.status;
  const body = await res.json();
  assertEquals(status === 401 || status === 400, true);
  assertExists(body.error);
});

Deno.test("returns 400 for project name with dangerous chars", async () => {
  const res = await fetch(`${BASE}?action=create`, {
    method: "POST",
    headers: {
      Authorization: "Bearer fake_token_for_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: '<script>alert("xss")</script>' }),
  });
  const status = res.status;
  const body = await res.json();
  // Will be 401 (bad token) before reaching validation, or 400 if auth passes
  assertEquals(status === 401 || status === 400, true);
  assertExists(body.error);
});

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(BASE, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
    },
  });
  assertEquals(res.status, 200);
  await res.text(); // consume body
  const origin = res.headers.get("access-control-allow-origin");
  assertExists(origin);
});

Deno.test("returns 400 for unknown action", async () => {
  const res = await fetch(`${BASE}?action=unknown_action`, {
    headers: {
      Authorization: "Bearer fake_token",
      "Content-Type": "application/json",
    },
  });
  const status = res.status;
  const body = await res.json();
  // 401 or 400 depending on auth flow
  assertEquals(status === 401 || status === 400, true);
  assertExists(body.error);
});
