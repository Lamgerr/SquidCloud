import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

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

    if (!fileRow.encrypted_key || !fileRow.encrypted_key_nonce) {
      return jsonResponse({ success: false, error: "File key is not available" }, 404);
    }

    const { data: decryptedKey, error: decryptError } = await supabase.rpc("decrypt_keyring_secret", {
      p_key_name: "file_encryption_keys",
      p_ciphertext: fileRow.encrypted_key,
      p_nonce: fileRow.encrypted_key_nonce,
    });

    if (decryptError || !decryptedKey) {
      return jsonResponse({ success: false, error: "Failed to decrypt file key" }, 500);
    }

    return jsonResponse({ success: true, key: decryptedKey });
  });
});
