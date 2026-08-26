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

/** Opaque SquidCloud CLI tokens authenticate via cli_devices.token_hash. */
async function resolveCliUserId(supabase: any, token: string): Promise<string | null> {
  if (!token || token.includes('.')) return null;
  const hash = await sha256Hex(encoder.encode(token));
  const { data: dev } = await supabase
    .from('cli_devices')
    .select('user_id')
    .eq('token_hash', hash)
    .maybeSingle();
  return dev?.user_id ?? null;
}

async function handleForUser(userId: string, fileId: string): Promise<Response> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = { fileId };

  const { data: fileRow, error: fileError } = await supabase
    .from("files")
    .select("*")
    .eq("id", body.fileId)
    .single();

  if (fileError || !fileRow) {
    return jsonResponse({ success: false, error: "File not found" }, 404);
  }

  if (fileRow.user_id !== userId) {
    return jsonResponse({ success: false, error: "Forbidden" }, 403);
  }

  const { data: vaultRow } = await supabase
    .from("file_key_vault")
    .select("wrapped_key, iv")
    .eq("file_id", body.fileId)
    .maybeSingle();

  if (!vaultRow?.wrapped_key || !vaultRow?.iv) {
    return jsonResponse({ success: false, error: "File key is not available" }, 404);
  }

  try {
    const kek = await getFileKeyKek(SERVICE_KEY);
    const plain = await aes256GcmDecrypt(vaultRow.wrapped_key, vaultRow.iv, kek);
    return jsonResponse({ success: true, key: decoder.decode(plain) });
  } catch (e) {
    console.error('[file-key] unwrap failed:', e instanceof Error ? e.message : e);
    return jsonResponse({
      success: false,
      error: 'Failed to decrypt file key',
      diag: { reason: e instanceof Error ? e.message.slice(0, 60) : 'unknown', master_env: !!Deno.env.get('SQUIDVEIL_MASTER_KEY') },
    }, 500);
  }
}

serve(async (req) => {
  // Browser preflight must short-circuit before anything else.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Server configuration error", { status: 500, headers: getCorsHeaders() });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("authorization") || "";
  let userId: string | null = null;
  let fileId = '';
  try { fileId = ((await req.json()) as any)?.fileId ?? ''; } catch {}

  if (!fileId) return jsonResponse({ success: false, error: 'fileId is required' }, 400);

  if (authHeader.startsWith('Bearer ')) {
    const tok = authHeader.slice(7);
    if (!tok.includes('.')) {
      // opaque SquidCloud CLI device token
      userId = await resolveCliUserId(supabase, tok);
    } else {
      // real Supabase JWT from the dashboard — validate directly so the
      // PREL session/f2fa layer can never block key retrieval.
      const { data: { user }, error: uerr } = await supabase.auth.getUser(tok);
      if (!uerr && user) userId = user.id;
    }
  }
  if (!userId) {
    // fall back to PREL/JWT path for web sessions
    const prel = await import('../_shared/kza-prel.ts');
    return prel.withPrelGateway(req, { functionId: 'file-key', operation: 'default' }, async (ctx) => {
      return handleForUser(ctx.userId, fileId);
    });
  }
  return handleForUser(userId, fileId);
});
