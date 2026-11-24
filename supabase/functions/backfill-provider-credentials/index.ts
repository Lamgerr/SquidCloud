import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const DECODER = new TextDecoder();
// SECURITY: never hardcode privileged tokens. Set PROVIDER_BACKFILL_TOKEN as a Supabase secret.
const TOKEN = Deno.env.get("PROVIDER_BACKFILL_TOKEN") || "";

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const keyObj = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", keyObj, encoder.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getMasterKey(serviceKey: string): Promise<Uint8Array> {
  const env = Deno.env.get("SQUIDVEIL_MASTER_KEY");
  if (env && /^[0-9a-f]{64}$/i.test(env)) return fromHex(env);
  return fromHex(await sha256Hex(encoder.encode("squidveil-master-v1:" + serviceKey)));
}

async function getProviderKek(serviceKey: string): Promise<Uint8Array> {
  const master = await getMasterKey(serviceKey);
  return fromHex(await hmacSha256Hex(master, "provider-cred-vault-v1"));
}

async function wrapProviderCreds(serviceKey: string, plaintext: string): Promise<{ wrapped: string; iv: string }> {
  const kek = await getProviderKek(serviceKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyObj = await crypto.subtle.importKey("raw", kek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, encoder.encode(plaintext));
  return { wrapped: base64Encode(new Uint8Array(ct)), iv: base64Encode(iv) };
}

serve(async (req) => {
  const token = req.headers.get("x-backfill-token");
  if (!TOKEN || token !== TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Server configuration error", { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: providers, error } = await supabase
    .from("storage_providers")
    .select("id, user_id, encrypted_credentials")
    .not("encrypted_credentials", "is", null)
    .not("encrypted_credentials", "eq", "");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const rows = (providers ?? []).filter((p: any) => p.encrypted_credentials && p.encrypted_credentials.trim().length > 0);
  let wrapped = 0, skipped = 0, failed = 0;
  const failures: string[] = [];

  for (const p of rows) {
    try {
      let isLegacyBlob = false;
      try {
        const parsed = JSON.parse(p.encrypted_credentials);
        isLegacyBlob = typeof parsed?.nonce === "string";
      } catch { /* not JSON -> plaintext */ }

      if (isLegacyBlob) {
        const { error: nullErr } = await supabase
          .from("storage_providers")
          .update({ encrypted_credentials: null })
          .eq("id", p.id);
        if (nullErr) throw nullErr;
        skipped++;
        continue;
      }

      const { wrapped: wrappedB64, iv } = await wrapProviderCreds(supabaseServiceKey, p.encrypted_credentials);
      const { error: vaultErr } = await supabase
        .from("storage_provider_vault")
        .upsert(
          { provider_id: p.id, user_id: p.user_id, wrapped_credentials: wrappedB64, iv, key_version: 1 },
          { onConflict: "provider_id" }
        );
      if (vaultErr) throw vaultErr;
      const { error: nullErr } = await supabase
        .from("storage_providers")
        .update({ encrypted_credentials: null })
        .eq("id", p.id);
      if (nullErr) throw nullErr;
      wrapped++;
    } catch (e: any) {
      failed++;
      failures.push(`${p.id}: ${e.message}`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, total: rows.length, wrapped, skipped, failed, failures }),
    { headers: { "Content-Type": "application/json" } }
  );
});
