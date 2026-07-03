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

let cachedFileColumns: Set<string> | null = null;
let fileColumnsChecked = false;

const getFileColumns = async (supabase: ReturnType<typeof createClient>) => {
  if (fileColumnsChecked) return cachedFileColumns;
  fileColumnsChecked = true;

  const { data: columnsData, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "files");

  if (error || !Array.isArray(columnsData)) {
    return null;
  }

  cachedFileColumns = new Set(columnsData.map((col: any) => col.column_name));
  return cachedFileColumns;
};

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

    let encryptedKey: string | null = null;
    let encryptedKeyNonce: string | null = null;

    if (payload.encryptionKey) {
      const { data: encryptedData, error: encryptError } = await supabase.rpc(
        "encrypt_keyring_secret",
        {
          p_key_name: "file_encryption_keys",
          p_plaintext: payload.encryptionKey,
        }
      );

      if (encryptError || !Array.isArray(encryptedData) || encryptedData.length === 0) {
        return jsonResponse({ success: false, error: "Failed to encrypt file key" }, 500);
      }

      const [encryptedEntry] = encryptedData;
      encryptedKey = encryptedEntry?.ciphertext ?? null;
      encryptedKeyNonce = encryptedEntry?.nonce ?? null;
      if (!encryptedKey || !encryptedKeyNonce) {
        return jsonResponse({ success: false, error: "Failed to encrypt file key" }, 500);
      }
    }

    const columnSet = await getFileColumns(supabase);
    const hasColumn = (columnName: string) => columnSet?.has(columnName) ?? false;

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

    if (hasColumn("workspace_id")) {
      insertPayload.workspace_id = resolvedWorkspaceId;
    }
    if (hasColumn("parent_folder")) {
      insertPayload.parent_folder = payload.parentFolder ?? null;
    }
    if (hasColumn("storage_provider_id")) {
      insertPayload.storage_provider_id = payload.storageProviderId ?? null;
    }
    if (hasColumn("external_object_key")) {
      insertPayload.external_object_key = payload.externalObjectKey ?? null;
    }
    if (payload.processor && hasColumn("processor")) {
      insertPayload.processor = payload.processor;
    }
    if (encryptedKey && hasColumn("encrypted_key")) {
      insertPayload.encrypted_key = encryptedKey;
    }
    if (encryptedKeyNonce && hasColumn("encrypted_key_nonce")) {
      insertPayload.encrypted_key_nonce = encryptedKeyNonce;
    }

    const { data: fileData, error: insertError } = await supabase
      .from("files")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !fileData) {
      return jsonResponse({ success: false, error: insertError?.message || "Failed to save file" }, 500);
    }

    return jsonResponse({ success: true, file: fileData });
  })
});
