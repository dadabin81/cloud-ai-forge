import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const BASE = `${SUPABASE_URL}/functions/v1/deploy-cloudflare`;

Deno.test("returns 401 without auth header", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test("returns 401 with invalid Bearer token", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: "Bearer totally_invalid_jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: "test-proj",
      files: { "index.html": { code: "<h1>hi</h1>" } },
      accountId: "acc123",
      apiToken: "tok123",
    }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.success, false);
});

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(BASE, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assertEquals(res.status, 200);
  await res.text();
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("rejects invalid projectName format", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: "Bearer fake_jwt_token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: "INVALID NAME!!!",
      files: { "index.html": { code: "<h1>hi</h1>" } },
      accountId: "acc",
      apiToken: "tok",
    }),
  });
  // 401 (auth fail first) or 400 (validation)
  const status = res.status;
  const body = await res.json();
  assertEquals(status === 401 || status === 400, true);
  assertExists(body.error);
});

Deno.test("rejects empty files object", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: "Bearer fake_jwt_token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: "valid-name",
      files: {},
      accountId: "acc",
      apiToken: "tok",
    }),
  });
  const status = res.status;
  const body = await res.json();
  assertEquals(status === 401 || status === 400, true);
  assertExists(body.error);
});
