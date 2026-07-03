/**
 * webhook-dispatch — v12.5
 * Sends HTTP POST webhook notifications for account events
 * Called by other edge functions when events occur
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// HMAC signing uses SubtleCrypto (no external import needed)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Read body once
  const body = await req.json().catch(() => ({}));

  // Auth: service role, internal key (from DB triggers), or JWT
  const authHeader = req.headers.get("Authorization") || "";
  const internalKey = req.headers.get("X-Internal-Key") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let userId: string | null = null;

  if (internalKey) {
    // Internal key from system_config (DB trigger calls)
    const { data: config } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "INTERNAL_WEBHOOK_KEY")
      .single();
    if (config?.value === internalKey) {
      userId = body.userId as string;
    } else {
      return json({ error: "Invalid internal key" }, 401);
    }
  } else if (jwt === SUPABASE_SERVICE_ROLE_KEY) {
    userId = body.userId as string;
  } else if (jwt) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Invalid token" }, 401);
    userId = user.id;
  } else {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!userId) {
    return json({ error: "userId required" }, 400);
  }

  const eventName = body.event as string;
  const eventData = body.data as Record<string, unknown> || {};

  if (!eventName) {
    return json({ error: "event name required" }, 400);
  }

  try {
    // Get active webhooks for this user that subscribe to this event
    const { data: webhooks, error: whError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (whError || !webhooks || webhooks.length === 0) {
      return json({ dispatched: 0, message: "No active webhooks" });
    }

    // Filter webhooks that subscribe to this event (or "all")
    const matchingWebhooks = webhooks.filter((wh: any) =>
      wh.events.includes(eventName) || wh.events.includes("all")
    );

    if (matchingWebhooks.length === 0) {
      return json({ dispatched: 0, message: "No webhooks for this event" });
    }

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      account_id: userId,
      data: eventData,
    };

    const results: { webhookId: string; status: string; statusCode?: number }[] = [];

    // Dispatch to all matching webhooks in parallel
    await Promise.allSettled(
      matchingWebhooks.map(async (webhook: any) => {
        try {
          // Generate HMAC signature
          const payloadStr = JSON.stringify(payload);
          const encoder = new TextEncoder();
          const keyData = encoder.encode(webhook.secret_key);
          const msgData = encoder.encode(payloadStr);

          // Use SubtleCrypto for HMAC-SHA256
          const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
          const signature = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SquidCloud-Signature": `sha256=${signature}`,
              "X-SquidCloud-Event": eventName,
              "User-Agent": "SquidCloud-Webhook/1.0",
            },
            body: payloadStr,
            signal: AbortSignal.timeout(10000),
          });

          // Log the event
          await supabase.from("webhook_events_log").insert({
            webhook_id: webhook.id,
            user_id: userId,
            event_name: eventName,
            payload: payload as any,
            status: response.ok ? "success" : "failed",
            response_status: response.status,
          });

          // Update last_triggered_at
          await supabase
            .from("webhooks")
            .update({ last_triggered_at: new Date().toISOString() })
            .eq("id", webhook.id);

          results.push({
            webhookId: webhook.id,
            status: response.ok ? "success" : "failed",
            statusCode: response.status,
          });
        } catch (err: any) {
          // Log the failure
          await supabase.from("webhook_events_log").insert({
            webhook_id: webhook.id,
            user_id: userId,
            event_name: eventName,
            payload: payload as any,
            status: "failed",
            error_message: err.message || "Dispatch error",
          });

          results.push({
            webhookId: webhook.id,
            status: "failed",
          });
        }
      })
    );

    return json({
      dispatched: results.length,
      results,
    });
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
