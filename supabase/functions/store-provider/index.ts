import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';
import { wrapProviderCreds } from '../_shared/provider-vault.ts';

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

    // Insert new provider record WITHOUT storing credentials (vault holds them)
    const { data, error } = await supabase
      .from("storage_providers")
      .insert({
        user_id: ctx.userId,
        provider_type: providerType,
        label: payload.label || `${providerType} - ${payload.bucketName}`,
        encrypted_credentials: null,
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

    // Wrap credentials into the server-side vault (never REST-visible).
    const wrapped = await wrapProviderCreds(supabaseServiceKey, JSON.stringify(credentials));
    const { error: vaultErr } = await supabase
      .from("storage_provider_vault")
      .insert({
        provider_id: data.id,
        user_id: ctx.userId,
        wrapped_credentials: wrapped.wrapped,
        iv: wrapped.iv,
        key_version: 1,
      });

    if (vaultErr) {
      // Roll back the provider row so we never orphan it without credentials.
      await supabase.from("storage_providers").delete().eq("id", data.id);
      return jsonResponse({ success: false, error: "Failed to store credentials securely" }, 500);
    }

    return jsonResponse({ success: true, provider: data });
  });
});
