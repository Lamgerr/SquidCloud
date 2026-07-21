import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

type ProviderPayload = {
  providerType: string;
  label?: string;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  bucketRegion?: string;
  bucketEndpoint?: string;
  isPublic?: boolean;
  storageLimitBytes?: number;
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

    // Check bucket limit
    const { count: bucketCount } = await supabase
      .from("storage_providers")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", ctx.userId)
      .eq("is_enabled", true);

    if (bucketCount && bucketCount >= 20) {
      return jsonResponse({ success: false, error: "Maximum 20 buckets allowed" }, 400);
    }

    const credentials: Record<string, string> = {
      accountId: payload.accountId || '',
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

    // Insert new provider record (no longer unique constraint, each call = new bucket)
    const { data, error } = await supabase
      .from("storage_providers")
      .insert({
        user_id: ctx.userId,
        provider_type: providerType,
        label: payload.label || `${providerType} - ${payload.bucketName}`,
        encrypted_credentials: encryptedPayload,
        bucket_name: payload.bucketName,
        bucket_region: payload.bucketRegion || 'auto',
        bucket_endpoint: payload.bucketEndpoint || null,
        is_default: false,
        is_enabled: true,
        is_public: payload.isPublic || false,
        storage_limit_bytes: payload.storageLimitBytes || null,
      })
      .select("id, provider_type, label")
      .single();

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    return jsonResponse({ success: true, provider: data });
  });
});
