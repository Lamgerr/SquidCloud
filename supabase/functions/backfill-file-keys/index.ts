import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SECURITY: never hardcode privileged tokens. Set BACKFILL_TOKEN as a Supabase secret.
const TOKEN = Deno.env.get("BACKFILL_TOKEN") || "";

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

function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
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
  const iv = randomIv();
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, encoder.encode(plaintext));
  return { wrapped: base64Encode(new Uint8Array(ct)), iv: base64Encode(iv) };
}

async function aes256GcmUnwrap(wrapped: string, ivB64: string, key: Uint8Array): Promise<string> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64Decode(ivB64) },
    keyObj,
    base64Decode(wrapped),
  );
  return decoder.decode(pt);
}

const KEY_RE = /"encryptionKey"\s*:\s*"([^"]+)"/;
const KEY_REPLACE = (marker: string) => `"encryptionKey":"${marker}"`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  let body: { token?: string } = {};
  try {
    body = await req.json();
  } catch { /* ignore */ }
  if (!TOKEN || body.token !== TOKEN) {
    return new Response(JSON.stringify({ success: false, error: 'invalid token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const kek = await getFileKeyKek(supabaseServiceKey);

  const stats = { total: 0, wrapped: 0, flipped: 0, skipped: 0, failed: [] as string[] };

  const pageSize = 500;
  let from = 0;
  for (;;) {
    const { data: page, error } = await supabase
      .from('files')
      .select('id, user_id, tags')
      .range(from, from + pageSize - 1);
    if (error) throw new Error('fetch files: ' + error.message);
    if (!page || page.length === 0) break;
    stats.total += page.length;

    for (const f of page) {
      const tagStr = Array.isArray(f.tags) && f.tags.length > 0 ? f.tags[0] : null;
      if (!tagStr) continue;
      const m = tagStr.match(KEY_RE);
      if (!m) continue;
      const current = m[1];
      if (current === 'managed_key') continue;
      if (current.startsWith('v3_') || current.startsWith('v2_')) { stats.skipped++; continue; }

      try {
        const { wrapped, iv } = await aes256GcmWrap(current, kek);
        const check = await aes256GcmUnwrap(wrapped, iv, kek);
        if (check !== current) throw new Error('roundtrip mismatch');

        const { error: upsertErr } = await supabase
          .from('file_key_vault')
          .upsert(
            { file_id: f.id, user_id: f.user_id, wrapped_key: wrapped, iv, key_version: 1 },
            { onConflict: 'file_id' },
          );
        if (upsertErr) throw new Error('upsert vault: ' + upsertErr.message);

        const { error: updErr } = await supabase
          .from('files')
          .update({ tags: [tagStr.replace(KEY_RE, KEY_REPLACE('managed_key'))] })
          .eq('id', f.id);
        if (updErr) throw new Error('update tags: ' + updErr.message);

        stats.wrapped++;
        stats.flipped++;
      } catch (e) {
        stats.failed.push(f.id + ':' + (e as Error).message);
      }
    }
    from += pageSize;
    if (page.length < pageSize) break;
  }

  return new Response(JSON.stringify({ success: true, ...stats }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
