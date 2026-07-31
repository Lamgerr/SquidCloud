import { test } from "node:test";
import assert from "node:assert/strict";

import { SquidVeilClient } from "../dist/esm/index.js";
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  PermissionError,
  RateLimitedError,
  VeilRefError,
} from "../dist/esm/index.js";

function mockFetch(handler) {
  const original = globalThis.fetch;
  let calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeClient(overrides = {}) {
  return new SquidVeilClient({
    url: "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api",
    token: "sv_testtoken",
    maxRetries: 2,
    ...overrides,
  });
}

test("sends bearer token and user agent", async () => {
  const mock = mockFetch(() => jsonResponse(200, { ok: true, service: "squidveil-api", version: 9 }));
  try {
    const client = makeClient();
    await client.health();
    assert.equal(mock.calls.length, 1);
    const init = mock.calls[0].init;
    assert.equal(init.headers.get("authorization"), "Bearer sv_testtoken");
    assert.match(init.headers.get("user-agent"), /@squidveil\/js/);
  } finally {
    mock.restore();
  }
});

test("401 maps to AuthenticationError", async () => {
  const mock = mockFetch(() => jsonResponse(401, { error: "Invalid access token", code: "INVALID_TOKEN" }));
  try {
    await assert.rejects(makeClient().health(), (e) => e instanceof AuthenticationError && e.code === "INVALID_TOKEN");
  } finally {
    mock.restore();
  }
});

test("403 maps to PermissionError", async () => {
  const mock = mockFetch(() => jsonResponse(403, { error: "Token cannot read", code: "FORBIDDEN" }));
  try {
    await assert.rejects(makeClient().health(), (e) => e instanceof PermissionError && e.status === 403);
  } finally {
    mock.restore();
  }
});

test("CONSUMED maps to VeilRefError", async () => {
  const mock = mockFetch(() => jsonResponse(401, { error: "VeilRef consumed (max uses reached)", code: "CONSUMED" }));
  try {
    await assert.rejects(makeClient().health(), (e) => e instanceof VeilRefError && e.code === "CONSUMED");
  } finally {
    mock.restore();
  }
});

test("429 maps to RateLimitedError with retry-after", async () => {
  const mock = mockFetch(() => jsonResponse(429, { error: "Too many requests", code: "RATE_LIMITED" }, { "retry-after": "2" }));
  try {
    await assert.rejects(makeClient().health(), (e) => e instanceof RateLimitedError && e.retryAfterMs === 2000);
  } finally {
    mock.restore();
  }
});

test("5xx retried then succeeds", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n += 1;
    if (n < 3) return jsonResponse(503, { error: "boom", code: "SERVER_ERROR" });
    return jsonResponse(200, { ok: true, service: "squidveil-api", version: 9 });
  });
  try {
    const health = await makeClient().health();
    assert.equal(health.ok, true);
    assert.equal(n, 3);
  } finally {
    mock.restore();
  }
});

test("network failure surfaces as NetworkError after retries", async () => {
  const mock = mockFetch(() => {
    throw new TypeError("fetch failed");
  });
  try {
    await assert.rejects(makeClient().health(), NetworkError);
  } finally {
    mock.restore();
  }
});

test("getSecret parses and caches", async () => {
  const body = { success: true, name: "prod/db", value: "s3cret", version: 3, secret_type: "opaque" };
  let n = 0;
  const mock = mockFetch(() => {
    n += 1;
    return jsonResponse(200, body);
  });
  try {
    const client = makeClient({ cacheTtlMs: 60_000 });
    const first = await client.getSecret("prod/db");
    const second = await client.getSecret("prod/db");
    assert.equal(first.value, "s3cret");
    assert.equal(second.value, "s3cret");
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }
});

test("getSecret URL-encodes name and version", async () => {
  const mock = mockFetch((url) => {
    assert.match(String(url), /\/v1\/secrets\/prod%2Fdb\?version=2$/);
    return jsonResponse(200, { success: true, name: "prod/db", value: "v", version: 2, secret_type: "opaque" });
  });
  try {
    await makeClient().getSecret("prod/db", 2);
  } finally {
    mock.restore();
  }
});

test("issueVeilRef parses the signed blob", async () => {
  const refJson = JSON.stringify({
    ref_id: "abc123",
    secret_name: "prod/db",
    version_number: 2,
    device_bound: "",
    issued_at: "t0",
    expires_at: "t1",
    use_count_max: 1,
    use_count_used: 0,
    ops_allowed: ["resolve"],
    hmac: "deadbeef",
  });
  const mock = mockFetch(() => jsonResponse(201, { success: true, veil_ref_json: refJson, ref_id: "abc123" }));
  try {
    const ref = await makeClient().issueVeilRef("prod/db", { maxUses: 1, refTtl: 300 });
    assert.equal(ref.refId, "abc123");
    assert.equal(ref.versionNumber, 2);
    assert.match(ref.json, /deadbeef/);
  } finally {
    mock.restore();
  }
});

test("missing token raises ConfigurationError", () => {
  const oldEnv = { ...process.env };
  delete process.env.SQUIDVEIL_TOKEN;
  try {
    assert.throws(
      () => new SquidVeilClient({ url: "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api" }),
      /SQUIDVEIL_TOKEN/,
    );
  } finally {
    process.env = { ...oldEnv };
  }
});

test("toString redacts token", () => {
  const client = makeClient();
  assert.equal(String(client), "<SquidVeilClient url=https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api token=***>");
});
