import { AwsClient } from "npm:aws4fetch";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from "../_shared/kza-prel.ts";

const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <ID>AllowAllS3</ID>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

Deno.serve(async (req) => {
  return withPrelGateway(req, { functionId: 'set-b2-cors', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders() });
    }

    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return jsonResponse({ error: "Misconfigured" }, 500);
      }

      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", ctx.userId)
        .single();
      if (!profile?.is_admin) {
        return jsonResponse({ error: "Forbidden: admin access required" }, 403);
      }

      const { bucketId } = await req.json().catch(() => ({}));

      let buckets;
      if (bucketId) {
        const { data } = await supabase.from("squidcloud_b2_buckets").select("*").eq("id", bucketId);
        buckets = data;
      } else {
        const { data } = await supabase.from("squidcloud_b2_buckets").select("*").eq("is_enabled", true);
        buckets = data;
      }

      if (!buckets || buckets.length === 0) {
        return jsonResponse({ error: "No buckets found" }, 404);
      }

      const results = [];
      const encoder = new TextEncoder();
      for (const b of buckets) {
        try {
          const client = new AwsClient({
            accessKeyId: b.access_key_id,
            secretAccessKey: b.secret_access_key,
            region: b.bucket_region,
            service: "s3",
          });

          // Use x-amz-checksum-sha256 instead of Content-MD5
          const bodyBytes = encoder.encode(CORS_XML);
          const sha256Hash = await crypto.subtle.digest("SHA-256", bodyBytes);
          const sha256Bytes = new Uint8Array(sha256Hash);
          let binary = "";
          for (let i = 0; i < sha256Bytes.length; i++) {
            binary += String.fromCharCode(sha256Bytes[i]);
          }
          const checksumSha256 = btoa(binary);

          const endpoint = b.bucket_endpoint.startsWith("http") ? b.bucket_endpoint : "https://" + b.bucket_endpoint;
          const url = `${endpoint}/${b.bucket_name}/?cors`;

          const signedReq = await client.sign(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/xml",
              "x-amz-checksum-sha256": checksumSha256,
            },
            body: CORS_XML,
          });

          const headersObj: Record<string, string> = {};
          signedReq.headers.forEach((value: string, key: string) => {
            headersObj[key] = value;
          });
          headersObj["x-amz-checksum-sha256"] = checksumSha256;

          const response = await fetch(signedReq.url, {
            method: "PUT",
            headers: headersObj,
            body: CORS_XML,
          });

          const body = await response.text().catch(() => "");
          results.push({ bucket: b.bucket_name, status: response.status, ok: response.ok, body });
        } catch (e: any) {
          results.push({ bucket: b.bucket_name, error: e.message });
        }
      }

      return jsonResponse({ success: true, results });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  });
});
