import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

const encoder = new TextEncoder();

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64Decode(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', keyObj, encoder.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function getMasterKey(serviceKey: string): Promise<Uint8Array> {
  const env = Deno.env.get('SQUIDVEIL_MASTER_KEY');
  if (env && /^[0-9a-f]{64}$/i.test(env)) return fromHex(env);
  return fromHex(await sha256Hex(encoder.encode('squidveil-master-v1:' + serviceKey)));
}

async function getFileKeyKek(serviceKey: string): Promise<Uint8Array> {
  const master = await getMasterKey(serviceKey);
  return fromHex(await hmacSha256Hex(master, 'file-key-vault-v1'));
}

async function aes256GcmWrap(plaintext: string, key: Uint8Array): Promise<{ wrapped: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, encoder.encode(plaintext));
  return { wrapped: base64Encode(new Uint8Array(ct)), iv: base64Encode(iv) };
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'store-file-key', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders() });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server configuration error", { status: 500, headers: getCorsHeaders() });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: { fileId?: string; key?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON payload" }, 400);
    }

    if (!body.fileId || !body.key) {
      return jsonResponse({ success: false, error: "fileId and key are required" }, 400);
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select("id, user_id")
      .eq("id", body.fileId)
      .single();

    if (fileError || !fileRow) {
      return jsonResponse({ success: false, error: "File not found" }, 404);
    }

    if (fileRow.user_id !== ctx.userId) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    try {
      const kek = await getFileKeyKek(supabaseServiceKey);
      const { wrapped, iv } = await aes256GcmWrap(body.key, kek);

      const { error: vaultErr } = await supabase
        .from("file_key_vault")
        .upsert(
          { file_id: body.fileId, user_id: ctx.userId, wrapped_key: wrapped, iv, key_version: 1 },
          { onConflict: "file_id" },
        );

      if (vaultErr) {
        return jsonResponse({ success: false, error: "Failed to store file key" }, 500);
      }

      return jsonResponse({ success: true });
    } catch {
      return jsonResponse({ success: false, error: "Failed to encrypt file key" }, 500);
    }
  })
});