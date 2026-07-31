import { test } from "node:test";
import assert from "node:assert/strict";

import { verifyVeilRef } from "../dist/esm/browser.js";
import { VeilRefError } from "../dist/esm/index.js";

test("browser verifyVeilRef sends no auth and returns boolean", async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ success: true, verified: true, secret_name: "prod/db", version_number: 3 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await verifyVeilRef("{\"ref_id\":\"abc\"}", { url: "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api" });
    assert.equal(result.verified, true);
    assert.equal(result.secretName, "prod/db");
    assert.equal(captured.init.headers.get("authorization"), null);
    assert.equal(String(captured.url).endsWith("/v1/veilref/verify"), true);
  } finally {
    globalThis.fetch = original;
  }
});

test("browser verifyVeilRef surfaces CONSUMED as VeilRefError", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "VeilRef consumed (max uses reached)", code: "CONSUMED" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      verifyVeilRef("{\"ref_id\":\"abc\"}", { url: "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api" }),
      (e) => e instanceof VeilRefError && e.code === "CONSUMED",
    );
  } finally {
    globalThis.fetch = original;
  }
});
