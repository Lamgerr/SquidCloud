import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

// Master key: SQUIDVEIL_MASTER_KEY env (64 hex) or derived (same scheme as squidveil-api).
async function getMasterKey(serviceKey: string): Promise<Uint8Array> {
  const env = Deno.env.get('SQUIDVEIL_MASTER_KEY');
  if (env && /^[0-9a-f]{64}$/i.test(env)) return fromHex(env);
  return fromHex(await sha256Hex(encoder.encode('squidveil-master-v1:' + serviceKey)));
}

async function getFileKeyKek(serviceKey: string): Promise<Uint8Array> {
  const master = await getMasterKey(serviceKey);
  return fromHex(await hmacSha256Hex(master, 'file-key-vault-v1'));
}

async function aes256GcmDecrypt(ciphertextB64: string, ivB64: string, key: Uint8Array): Promise<Uint8Array> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64Decode(ivB64) },
    keyObj,
    base64Decode(ciphertextB64),
  );
  return new Uint8Array(pt);
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'file-key', operation: 'default' }, async (ctx: PrelContext) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server configuration error", { status: 500, headers: getCorsHeaders() });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: { fileId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON payload", { status: 400, headers: getCorsHeaders() });
    }

    if (!body.fileId) {
      return jsonResponse({ success: false, error: "fileId is required" }, 400);
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", body.fileId)
      .single();

    if (fileError || !fileRow) {
      return jsonResponse({ success: false, error: "File not found" }, 404);
    }

    if (fileRow.user_id !== ctx.userId) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const { data: vaultRow, error: vaultError } = await supabase
      .from("file_key_vault")
      .select("wrapped_key, iv")
      .eq("file_id", body.fileId)
      .maybeSingle();

    if (vaultError || !vaultRow?.wrapped_key || !vaultRow?.iv) {
      return jsonResponse({ success: false, error: "File key is not available" }, 404);
    }

    try {
      const kek = await getFileKeyKek(supabaseServiceKey);
      const plain = await aes256GcmDecrypt(vaultRow.wrapped_key, vaultRow.iv, kek);
      return jsonResponse({ success: true, key: decoder.decode(plain) });
    } catch {
      return jsonResponse({ success: false, error: "Failed to decrypt file key" }, 500);
    }
  });
});
