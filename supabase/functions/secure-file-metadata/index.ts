import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

type SecureFilePayload = {
  name: string;
  type: string;
  size: number;
  storagePath: string;
  encrypted: boolean;
  encryptionKeyLabel: string;
  metadata?: string | null;
  parentFolder?: string | null;
  workspaceId?: string | null;
  storageProviderId?: string | null;
  externalObjectKey?: string | null;
  processor?: string | null;
  encryptionKey?: string | null;
};

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
  return withPrelGateway(req, { functionId: 'secure-file-metadata', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders() });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server configuration error", { status: 500, headers: getCorsHeaders() });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userId = ctx.userId;

    let payload: SecureFilePayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON payload" }, 400);
    }

    if (!payload?.name || !payload?.type || !payload?.storagePath || !Number.isFinite(payload?.size)) {
      return jsonResponse({ success: false, error: "Invalid file metadata" }, 400);
    }

    const workspaceId = payload.workspaceId || null;
    let resolvedWorkspaceId = workspaceId;

    if (!resolvedWorkspaceId) {
      const { data: defaultWorkspace, error: workspaceError } = await supabase.rpc(
        "get_or_create_default_workspace",
        { p_user_id: userId }
      );
      if (workspaceError) {
        return jsonResponse({ success: false, error: workspaceError.message }, 500);
      }
      resolvedWorkspaceId = defaultWorkspace as string;
    } else {
      const { data: hasAccess, error: accessError } = await supabase.rpc("has_workspace_role", {
        p_workspace_id: resolvedWorkspaceId,
        p_user_id: userId,
        p_min_role: "editor",
      });

      if (accessError || !hasAccess) {
        return jsonResponse({ success: false, error: "Insufficient workspace access" }, 403);
      }
    }

    let wrappedVault: { wrapped_key: string; iv: string } | null = null;

    if (payload.encryptionKey && payload.encryptionKeyLabel === 'managed_key') {
      try {
        const kek = await getFileKeyKek(supabaseServiceKey);
        wrappedVault = await aes256GcmWrap(payload.encryptionKey, kek);
      } catch {
        return jsonResponse({ success: false, error: "Failed to encrypt file key" }, 500);
      }
    }

    const insertPayload: Record<string, unknown> = {
      name: payload.name,
      type: payload.type,
      size: payload.size,
      storage_path: payload.storagePath,
      user_id: userId,
      encrypted: payload.encrypted,
      shared: false,
      encryption_key: payload.encryptionKeyLabel,
      tags: payload.metadata ? [payload.metadata] : null,
    };

    if (payload.workspaceId !== undefined) {
      insertPayload.workspace_id = resolvedWorkspaceId;
    }
    if (payload.parentFolder) {
      insertPayload.parent_folder = payload.parentFolder;
    }
    if (payload.storageProviderId) {
      insertPayload.storage_provider_id = payload.storageProviderId;
    }
    if (payload.externalObjectKey) {
      insertPayload.external_object_key = payload.externalObjectKey;
    }
    if (payload.processor) {
      insertPayload.processor = payload.processor;
    }
    // S-Hawk provenance (stored when the uploader screened the manifest).
    if (payload.swkManifestHash && payload.swkManifest) {
      insertPayload.swk_manifest_hash = payload.swkManifestHash;
      insertPayload.swk_manifest = payload.swkManifest;
      insertPayload.swk_decision = payload.swkDecision || 'allow';
      insertPayload.swk_scanned_at = new Date().toISOString();
    }

    const { data: fileData, error: insertError } = await supabase
      .from("files")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !fileData) {
      return jsonResponse({ success: false, error: insertError?.message || "Failed to save file" }, 500);
    }

    if (wrappedVault) {
      const { error: vaultErr } = await supabase
        .from("file_key_vault")
        .upsert(
          {
            file_id: fileData.id,
            user_id: userId,
            wrapped_key: wrappedVault.wrapped_key,
            iv: wrappedVault.iv,
            key_version: 1,
          },
          { onConflict: "file_id" },
        );
      if (vaultErr) {
        return jsonResponse({ success: false, error: "Failed to store file key" }, 500);
      }
    }

    return jsonResponse({ success: true, file: fileData });
  })
});