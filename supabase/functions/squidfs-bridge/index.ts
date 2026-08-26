import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok = (data: any) => new Response(JSON.stringify(data), { headers: { ...CORS, "Content-Type": "application/json" } });
const err = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateKey(apiKey: string, supabase: any): Promise<string | null> {
  const prefix = apiKey.substring(0, 8);
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, user_id, key_hash, key_salt, is_active")
    .eq("key_prefix", prefix)
    .eq("is_active", true);
  if (!keys) return null;
  const enc = new TextEncoder();
  for (const k of keys) {
    const saltB64 = k.key_salt || "";
    const saltBytes = saltB64 ? Uint8Array.from(atob(saltB64), (c: string) => c.charCodeAt(0)) : new Uint8Array(0);
    const keyBytes = enc.encode(apiKey);
    const combined = new Uint8Array(saltBytes.length + keyBytes.length);
    combined.set(saltBytes);
    combined.set(keyBytes, saltBytes.length);
    const buf = await crypto.subtle.digest("SHA-256", combined);
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex === k.key_hash) {
      supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
      return k.user_id;
    }
  }
  return null;
}

async function loadBuckets(supabase: any) {
  const clusters: any[] = [];
  const seen = new Set<string>();
  const envKey = Deno.env.get("B2_ACCESS_KEY_ID");
  const envSecret = Deno.env.get("B2_SECRET_ACCESS_KEY");
  if (envKey && envSecret) {
    const bucket = Deno.env.get("B2_BUCKET_NAME");
    if (bucket && !seen.has(bucket)) {
      clusters.push({
        client: new AwsClient({ accessKeyId: envKey, secretAccessKey: envSecret, region: Deno.env.get("B2_REGION") || "us-west-000", service: "s3" }),
        endpoint: Deno.env.get("B2_ENDPOINT") || "https://s3.us-west-004.backblazeb2.com",
        bucket, id: "env_main",
      });
      seen.add(bucket);
    }
  }
  const { data: adminBuckets } = await supabase.from("squidcloud_b2_buckets").select("*").eq("is_enabled", true);
  for (const b of adminBuckets || []) {
    if (seen.has(b.bucket_name)) continue;
    clusters.push({
      client: new AwsClient({ accessKeyId: b.access_key_id, secretAccessKey: b.secret_access_key, region: b.bucket_region, service: "s3" }),
      endpoint: b.bucket_endpoint, bucket: b.bucket_name, id: b.id,
    });
    seen.add(b.bucket_name);
  }
  return clusters;
}

async function signUrl(cluster: any, path: string, method: string): Promise<string> {
  const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`);
  const signed = await cluster.client.sign(url.toString(), {
    method,
    headers: method === "PUT" ? { "Content-Type": "application/octet-stream" } : undefined,
    aws: { signQuery: true },
  });
  return signed.url;
}


// ── per-file key vault (same scheme as store-file-key/file-key) ──
async function getMasterKey(serviceKey: string): Promise<Uint8Array> {
  const env = Deno.env.get('SQUIDVEIL_MASTER_KEY');
  if (env && /^[0-9a-f]{64}$/i.test(env)) return Uint8Array.from(atob(b64hex(env)), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('squidveil-master-v1:' + serviceKey));
  return new Uint8Array(digest);
}
function b64hex(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, 2), 16);
  return btoa(String.fromCharCode(...bytes));
}

async function unwrapFileKey(supabase: any, serviceKey: string, fileId: string): Promise<string | null> {
  const { data: row } = await supabase
    .from('file_key_vault')
    .select('wrapped_key, iv')
    .eq('file_id', fileId)
    .maybeSingle();
  if (!row?.wrapped_key || !row?.iv) return null;
  const master = await getMasterKey(serviceKey);
  const kekBytes = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', master, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new TextEncoder().encode('file-key-vault-v1'));
  const rawIv = Uint8Array.from(atob(row.iv), (c) => c.charCodeAt(0));
  const rawCt = Uint8Array.from(atob(row.wrapped_key), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rawIv }, await crypto.subtle.importKey('raw', new Uint8Array(kekBytes), { name: 'AES-GCM' }, false, ['decrypt']), rawCt);
  return new TextDecoder().decode(pt);
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return err("POST required", 405);

  try {
    const body = await req.json();
    const { api_key, action, ...params } = body;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // CLI OAuth session support: Bearer <cli token> → cli_devices lookup.
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ") && !authHeader.includes(".")) {
      const tokenHash = await hashToken(authHeader.slice(7));
      const { data: dev } = await supabase
        .from("cli_devices")
        .select("id, user_id")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (dev?.user_id) userId = dev.user_id;
    }

    if (!userId && api_key) {
      userId = await validateKey(api_key, supabase);
      if (!userId && api_key.startsWith("cb_")) userId = await validateKey(api_key.slice(3), supabase);
    }

    if (!userId) return err("Invalid API key", 401);

    if (action === "file_key") {
      const fileId = params.file_id as string;
      if (!fileId) return err("file_id required");
      const key = await unwrapFileKey(supabase, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, fileId);
      if (!key) return err("File key is not available", 404);
      return ok({ key });
    }

    if (action === "list") {
      const { folder_id } = params;
      let fileQ = supabase.from("files").select("*").eq("user_id", userId).eq("is_deleted", false).order("created_at", { ascending: false });
      let folderQ = supabase.from("folders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (folder_id) {
        fileQ = fileQ.eq("parent_folder", folder_id);
        folderQ = folderQ.eq("parent_folder", folder_id);
      } else {
        fileQ = fileQ.is("parent_folder", null);
        folderQ = folderQ.is("parent_folder", null);
      }
      const [filesRes, foldersRes] = await Promise.all([fileQ, folderQ]);
      return ok({ files: filesRes.data || [], folders: foldersRes.data || [] });
    }

    if (action === "file_meta") {
      const { file_id } = params;
      const { data } = await supabase.from("files").select("*").eq("id", file_id).single();
      return ok({ file: data });
    }

    if (action === "create_folder") {
      const { name, parent_folder } = params;
      const { data, error } = await supabase.from("folders").insert({ name, user_id: userId, parent_folder: parent_folder || null, path: "/" }).select().single();
      if (error) throw error;
      return ok({ folder: data });
    }

    if (action === "rename") {
      const { file_id, name } = params;
      const { error } = await supabase.from("files").update({ name }).eq("id", file_id).eq("user_id", userId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (action === "delete") {
      const { file_id } = params;
      const { error } = await supabase.from("files").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", file_id).eq("user_id", userId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (action === "move") {
      const { file_id, parent_folder } = params;
      const { error } = await supabase.from("files").update({ parent_folder: parent_folder || null }).eq("id", file_id).eq("user_id", userId);
      if (error) throw error;
      return ok({ success: true });
    }

    if (action === "get_upload_urls") {
      const { chunks, total_size } = params;
      const clusters = await loadBuckets(supabase);
      if (clusters.length === 0) return err("No storage buckets", 503);
      const urls = await Promise.all(chunks.map(async (c: any, i: number) => {
        const cluster = clusters[i % clusters.length];
        const uploadUrl = await signUrl(cluster, c.path, "PUT");
        return { path: c.path, index: c.index, uploadUrl, clusterId: cluster.id, bucket: cluster.bucket };
      }));
      return ok({ success: true, urls });
    }

    if (action === "resolve_download") {
      const { chunks } = params;
      const clusters = await loadBuckets(supabase);
      if (clusters.length === 0) return err("No storage buckets", 503);
      const results = await Promise.all(chunks.map(async (c: any, i: number) => {
        let cluster = clusters[0];
        if (c.bucket) cluster = clusters.find((cl: any) => cl.bucket === c.bucket) || cluster;
        const downloadUrl = await signUrl(cluster, c.path, "GET");
        return { index: i, path: c.path, downloadUrl, bucket: cluster.bucket, clusterId: cluster.id };
      }));
      return ok({ success: true, urls: results });
    }

    if (action === "create_file_record") {
      const { name, type, size, storage_path, encrypted, encryption_key, parent_folder, tags } = params;
      const { data, error } = await supabase.from("files").insert({
        name, type: type || "application/octet-stream", size, storage_path,
        encrypted: encrypted || false, encryption_key: encryption_key || "", parent_folder: parent_folder || null,
        user_id: userId, tags: tags || null,
      }).select().single();
      if (error) throw error;
      return ok({ file: data });
    }

    if (action === "get_file_key") {
      const { file_id } = params;
      const { data } = await supabase.from("file_key_vault").select("*").eq("file_id", file_id).eq("user_id", userId).single();
      return ok({ key_data: data });
    }

    return err("Unknown action: " + action);
  } catch (e: any) {
    return err(e.message, 500);
  }
});
