/**
 * webhook-dispatch — v13.0
 * Industry-standard webhook pipeline.
 * - Delivers JSON events to ANY URL (Discord, Slack, custom servers, ...)
 *   with just a URL — platform detection is automatic.
 * - HMAC-SHA256 signed (X-SquidCloud-Signature) with delivery id + timestamp.
 * - Automatic retries with backoff (5s, 30s, 5min) via DB queue + cron.
 * - SSRF protection: blocks private/loopback/link-local targets.
 * - Actions: dispatch (default), ping (test a webhook), retry_due (cron).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 4; // initial + 3 retries (matches docs: 5s, 30s, 5min)
const REQUEST_TIMEOUT_MS = 6000;
const IN_FUNCTION_BACKOFF_SECONDS = [0, 5, 30]; // waits done inside the function
const CRON_BACKOFF_SECONDS = 300; // 5min — attempt 4 runs out-of-band via cron

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── SSRF protection ──────────────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (a === 10) return true;                    // 10.0.0.0/8
    if (a === 127) return true;                   // loopback
    if (a === 0) return true;                     // 0.0.0.0/8
    if (a === 169 && b === 254) return true;      // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;      // 192.168/16
    if (a >= 224) return true;                    // multicast/reserved
    return false;
  }
  if (ip === "::1" || ip === "::") return true;   // IPv6 loopback/unspecified
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true; // ULA
  if (ip.toLowerCase().startsWith("fe8") || ip.toLowerCase().startsWith("fe9") || ip.toLowerCase().startsWith("fea") || ip.toLowerCase().startsWith("feb")) return true; // link-local
  return false;
}

async function validateWebhookUrl(rawUrl: string): Promise<{ ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http/https URLs are allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home")) {
    return { ok: false, error: "Private hostnames are not allowed" };
  }
  // Resolve DNS (Deno 2: Deno.resolveDns) — reject if any record is private
  try {
    const addresses = await Deno.resolveDns(host, "A");
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { ok: false, error: "URL resolves to a private address" };
      }
    }
  } catch {
    // DNS failure — allow fetch to surface the error
  }
  return { ok: true };
}

// ── Platform-aware payload formatting ────────────────────────────────────────

function truncate(v: unknown, max = 512): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatPayload(url: string, envelope: Record<string, unknown>, data: Record<string, unknown>) {
  // Discord webhooks accept only content/embeds/etc — build an embed
  if (/discord(app)?\.com\/api\/webhooks/i.test(url)) {
    const fields = Object.entries(data)
      .slice(0, 25)
      .map(([name, value]) => ({
        name: name.slice(0, 256),
        value: truncate(value, 1000) || "—",
        inline: true,
      }));
    return {
      username: "SquidCloud",
      embeds: [{
        title: `⚡ ${envelope.event}`,
        description: truncate(data as Record<string, unknown>, 4000) as string,
        color: 0x4FC3F7,
        timestamp: envelope.timestamp,
        fields: fields.length ? fields : undefined,
        footer: { text: `SquidCloud · account ${String(envelope.account_id).slice(0, 8)}` },
      }],
    };
  }
  // Slack-style generic webhooks prefer a plain text field
  if (/hooks\.slack\.com\/services/i.test(url)) {
    return {
      text: `⚡ SquidCloud event: ${envelope.event}`,
      attachments: [{
        color: "#4FC3F7",
        fields: Object.entries(data).slice(0, 25).map(([name, value]) => ({
          title: name.slice(0, 256),
          value: truncate(value, 1000),
          short: true,
        })),
      }],
    };
  }
  // Everything else gets the canonical JSON envelope
  return envelope;
}

// ── HMAC-SHA256 signature ────────────────────────────────────────────────────

async function sign(payloadStr: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payloadStr);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Delivery log helpers ─────────────────────────────────────────────────────

async function getOrCreateLog(
  supabase: any,
  deliveryId: string,
  webhookId: string,
  userId: string,
  eventName: string,
  envelope: Record<string, unknown>
) {
  const { data: existing } = await supabase
    .from("webhook_events_log")
    .select("*")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (existing) return existing;
  const { data: inserted, error } = await supabase
    .from("webhook_events_log")
    .insert({
      delivery_id: deliveryId,
      webhook_id: webhookId,
      user_id: userId,
      event_name: eventName,
      payload: envelope as any,
      event_payload: envelope as any,
      status: "pending",
      attempt_count: 1,
    })
    .select()
    .single();
  return inserted;
}

// ── Delivery attempt (single POST) ───────────────────────────────────────────

async function attemptDelivery(supabase: any, webhook: any, envelope: Record<string, unknown>, eventData: Record<string, unknown>, logRow: any) {
  const payloadStr = JSON.stringify(formatPayload(webhook.url, envelope, eventData));
  const signature = await sign(payloadStr, webhook.secret_key);
  const startedAt = Date.now();
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SquidCloud-Signature": `sha256=${signature}`,
        "X-SquidCloud-Event": String(envelope.event),
        "X-SquidCloud-Delivery": String(envelope.delivery_id),
        "X-SquidCloud-Timestamp": String(envelope.timestamp),
        "User-Agent": "SquidCloud-Webhook/2.0",
      },
      body: payloadStr,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;
    const responseText = await response.text().catch(() => "");
    const ok = response.ok;
    return {
      ok,
      statusCode: response.status,
      durationMs,
      responseBody: (responseText || "").slice(0, 2000),
      error: ok ? null : `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: null,
      durationMs: Date.now() - startedAt,
      responseBody: null,
      error: (err?.name === "TimeoutError" ? "Request timed out" : err?.message) || "Dispatch error",
    };
  }
}

// ── Full delivery flow with retries ──────────────────────────────────────────

async function deliver(supabase: any, webhook: any, eventName: string, eventData: Record<string, unknown>, userId: string, deliveryId: string) {
  const envelope = {
    event: eventName,
    timestamp: new Date().toISOString(),
    account_id: userId,
    delivery_id: deliveryId,
    data: eventData,
  };

  const validation = await validateWebhookUrl(webhook.url);
  if (!validation.ok) {
    await supabase.from("webhook_events_log").insert({
      delivery_id: deliveryId,
      webhook_id: webhook.id,
      user_id: userId,
      event_name: eventName,
      payload: envelope as any,
      event_payload: envelope as any,
      status: "failed",
      attempt_count: 1,
      error_message: `Validation failed: ${validation.error}`,
    });
    await supabase.from("webhooks").update({
      failed_deliveries: (webhook.failed_deliveries || 0) + 1,
      last_status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", webhook.id);
    return { webhookId: webhook.id, status: "failed", statusCode: null, error: validation.error };
  }

  const logRow = await getOrCreateLog(supabase, deliveryId, webhook.id, userId, eventName, envelope);
  let last: Awaited<ReturnType<typeof attemptDelivery>> | null = null;
  let attempt = logRow?.attempt_count || 1;

  // Attempts 1–3 run in-function with 5s/30s waits. Attempt 4 (5min) is
  // scheduled in the DB and processed by the `retry_due` cron driver.
  while (attempt <= MAX_ATTEMPTS) {
    if (attempt > 1) {
      const delay = IN_FUNCTION_BACKOFF_SECONDS[attempt - 1] ?? 0;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay * 1000));
      }
    }
    last = await attemptDelivery(supabase, webhook, envelope, eventData, logRow);

    const nextAttempt = attempt + 1;
    if (last.ok) {
      await supabase.from("webhook_events_log")
        .update({
          status: "success",
          attempt_count: attempt,
          response_status: last.statusCode,
          duration_ms: last.durationMs,
          response_body: last.responseBody,
          next_attempt_at: null,
        })
        .eq("id", logRow.id);
      await supabase.from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          total_deliveries: (webhook.total_deliveries || 0) + 1,
          last_status: "success",
          last_duration_ms: last.durationMs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", webhook.id);
      return { webhookId: webhook.id, status: "success", statusCode: last.statusCode, attempts: attempt, durationMs: last.durationMs };
    }

    // Failure — log the attempt; schedule next retry if attempts remain
    const isLastInFunction = attempt >= IN_FUNCTION_BACKOFF_SECONDS.length;
    const scheduleNext = nextAttempt <= MAX_ATTEMPTS;
    await supabase.from("webhook_events_log")
      .update({
        attempt_count: attempt,
        status: scheduleNext ? "pending" : "failed",
        response_status: last.statusCode,
        error_message: last.error,
        duration_ms: last.durationMs,
        response_body: last.responseBody,
        next_attempt_at: scheduleNext
          ? new Date(Date.now() + (isLastInFunction ? CRON_BACKOFF_SECONDS : IN_FUNCTION_BACKOFF_SECONDS[nextAttempt - 1]) * 1000).toISOString()
          : null,
      })
      .eq("id", logRow.id);
    if (!scheduleNext) {
      await supabase.from("webhooks")
        .update({
          failed_deliveries: (webhook.failed_deliveries || 0) + 1,
          last_status: "failed",
          last_duration_ms: last.durationMs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", webhook.id);
    }
    if (isLastInFunction) break; // hand off to the cron driver
    attempt = nextAttempt;
  }

  return {
    webhookId: webhook.id,
    status: last?.ok ? "success" : "pending",
    statusCode: last?.statusCode ?? null,
    attempts: attempt,
    next_attempt_at: last?.ok ? null : new Date(Date.now() + CRON_BACKOFF_SECONDS * 1000).toISOString(),
    error: last?.ok ? null : last?.error,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.json().catch(() => ({}));
  const authHeader = req.headers.get("Authorization") || "";
  const internalKey = req.headers.get("X-Internal-Key") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let userId: string | null = null;
  let isInternal = false;

  if (internalKey) {
    const { data: config } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "INTERNAL_WEBHOOK_KEY")
      .single();
    if (config?.value === internalKey) {
      userId = (body.userId as string) || null;
      isInternal = true;
    } else {
      return json({ error: "Invalid internal key" }, 401);
    }
  } else if (jwt === SUPABASE_SERVICE_ROLE_KEY) {
    userId = (body.userId as string) || null;
    isInternal = true;
  } else if (jwt) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Invalid token" }, 401);
    userId = user.id;
  } else {
    return json({ error: "Unauthorized" }, 401);
  }

  const action = (body.action as string) || "dispatch";

  // ── Action: ping (UI test button) ───────────────────────────────
  if (action === "ping") {
    const webhookId = body.webhookId as string;
    if (!webhookId) return json({ error: "webhookId required" }, 400);
    const { data: webhook } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .maybeSingle();
    if (!webhook || (webhook.user_id !== userId && !isInternal)) {
      return json({ error: "Webhook not found" }, 404);
    }
    const deliveryId = crypto.randomUUID();
    const envelope = {
      event: "ping",
      timestamp: new Date().toISOString(),
      account_id: webhook.user_id,
      delivery_id: deliveryId,
      data: { ping: true, message: "SquidCloud webhook test ping" },
    };
    const validation = await validateWebhookUrl(webhook.url);
    if (!validation.ok) {
      return json({ ok: false, error: validation.error }, 400);
    }
    const payloadStr = JSON.stringify(formatPayload(webhook.url, envelope, envelope.data as any));
    const signature = await sign(payloadStr, webhook.secret_key);
    const startedAt = Date.now();
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SquidCloud-Signature": `sha256=${signature}`,
          "X-SquidCloud-Event": "ping",
          "X-SquidCloud-Delivery": deliveryId,
          "X-SquidCloud-Timestamp": envelope.timestamp,
          "User-Agent": "SquidCloud-Webhook/2.0",
        },
        body: payloadStr,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const durationMs = Date.now() - startedAt;
      const responseText = await response.text().catch(() => "");
      return json({
        ok: response.ok,
        statusCode: response.status,
        durationMs,
        response: (responseText || "").slice(0, 500),
        deliveryId,
      });
    } catch (err: any) {
      return json({
        ok: false,
        statusCode: null,
        durationMs: Date.now() - startedAt,
        error: (err?.name === "TimeoutError" ? "Request timed out" : err?.message) || "Dispatch error",
        deliveryId,
      });
    }
  }

  // ── Action: retry_due (cron driver) ─────────────────────────────
  if (action === "retry_due") {
    if (!isInternal) return json({ error: "Unauthorized" }, 401);
    const { data: pending } = await supabase
      .from("webhook_events_log")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .limit(50);
    let processed = 0;
    for (const row of pending || []) {
      const { data: webhook } = await supabase
        .from("webhooks")
        .select("*")
        .eq("id", row.webhook_id)
        .maybeSingle();
      if (!webhook) {
        await supabase.from("webhook_events_log").update({ status: "failed", error_message: "Webhook deleted" }).eq("id", row.id);
        continue;
      }
      await deliver(supabase, webhook, row.event_name, row.event_payload?.data || {}, row.user_id, row.delivery_id || crypto.randomUUID());
      processed++;
    }
    return json({ processed });
  }

  // ── Default action: dispatch event ──────────────────────────────
  if (!userId) return json({ error: "userId required" }, 400);
  const eventName = body.event as string;
  const eventData = (body.data as Record<string, unknown>) || {};
  if (!eventName) return json({ error: "event name required" }, 400);

  try {
    const { data: webhooks, error: whError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (whError || !webhooks || webhooks.length === 0) {
      return json({ dispatched: 0, message: "No active webhooks" });
    }

    const matchingWebhooks = webhooks.filter((wh: any) =>
      wh.events.includes(eventName) || wh.events.includes("all") || wh.events.includes("*")
    );

    if (matchingWebhooks.length === 0) {
      return json({ dispatched: 0, message: "No webhooks for this event" });
    }

    const results = await Promise.allSettled(
      matchingWebhooks.map((webhook: any) =>
        deliver(supabase, webhook, eventName, eventData, userId, crypto.randomUUID())
      )
    );

    return json({
      dispatched: results.length,
      results: results.map((r) => r.status === "fulfilled" ? r.value : { status: "failed", error: "unhandled error" }),
    });
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
