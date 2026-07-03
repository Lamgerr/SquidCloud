import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

type ProviderPayload = {
  providerType: string;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
};

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'store-provider', operation: 'default' }, async (ctx: PrelContext) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payload: ProviderPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const providerType = payload.providerType?.trim();
    if (!providerType) {
      return jsonResponse({ success: false, error: "Provider type is required" }, 400);
    }

    if (!payload.accessKeyId || !payload.secretAccessKey || !payload.bucketName) {
      return jsonResponse({ success: false, error: "Missing provider credentials" }, 400);
    }

    if (providerType === "r2" && !payload.accountId) {
      return jsonResponse({ success: false, error: "Account ID is required for R2" }, 400);
    }

    const credentials = {
      accountId: payload.accountId,
      accessKeyId: payload.accessKeyId,
      secretAccessKey: payload.secretAccessKey,
      bucketName: payload.bucketName,
    };

    const { data: encryptedData, error: encryptError } = await supabase.rpc(
      "encrypt_keyring_secret",
      {
        p_key_name: "storage_provider_credentials",
        p_plaintext: JSON.stringify(credentials),
      }
    );

    if (encryptError || !Array.isArray(encryptedData) || encryptedData.length === 0) {
      return jsonResponse({ success: false, error: "Failed to encrypt credentials" }, 500);
    }

    const [encryptedEntry] = encryptedData;
    if (!encryptedEntry?.ciphertext || !encryptedEntry?.nonce) {
      return jsonResponse({ success: false, error: "Failed to encrypt credentials" }, 500);
    }

    const encryptedPayload = JSON.stringify({
      ciphertext: encryptedEntry.ciphertext,
      nonce: encryptedEntry.nonce,
      version: 1,
    });

    const { data: existingProvider } = await supabase
      .from("storage_providers")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("provider_type", providerType)
      .maybeSingle();

    let storedProvider;
    if (existingProvider?.id) {
      const { data, error } = await supabase
        .from("storage_providers")
        .update({
          encrypted_credentials: encryptedPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProvider.id)
        .select("id, provider_type")
        .single();

      if (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
      storedProvider = data;
    } else {
      const { data, error } = await supabase
        .from("storage_providers")
        .insert({
          user_id: ctx.userId,
          provider_type: providerType,
          encrypted_credentials: encryptedPayload,
          is_default: false,
        })
        .select("id, provider_type")
        .single();

      if (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
      storedProvider = data;
    }

    return jsonResponse({ success: true, provider: storedProvider });
  });
});
