import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketCorsCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';
import { swkCheckUploadBan, swkVerifyToken } from '../_shared/swk-verify.ts';

const MAX_PROXY_UPLOAD_BYTES = 20 * 1024 * 1024;

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function tryConfigureBucketCors(s3Client: S3Client, bucketName: string): Promise<boolean> {
  try {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    }));
    return true;
  } catch (error) {
    console.warn("Bucket CORS update skipped:", error?.message ?? error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  return withPrelGateway(req, { functionId: 'api-file-upload-tebi', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { action, fileName, fileType, path, fileBase64, providerId, swkToken, swkManifestHash, totalSize } = await req.json();
      if (!providerId) {
        return jsonResponse({ success: false, error: "Provider ID is required" }, 400);
      }

      // S-Hawk gate for upload-shaped actions (user-owned bucket path included).
      if (action === "upload" || action === "upload-proxy") {
        const ban = await swkCheckUploadBan(supabase, ctx.userId);
        if (!ban.ok) return jsonResponse({ success: false, error: ban.error }, ban.status);
        const gate = await swkVerifyToken(supabase, {
          userId: ctx.userId,
          token: String(swkToken || ""),
          manifestHash: String(swkManifestHash || ""),
          sizeBytes: typeof totalSize === "number" ? totalSize : 0,
        });
        if (!gate.ok) return jsonResponse({ success: false, error: gate.error }, gate.status);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: "Server configuration error" }, 500);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: providerRow, error: providerError } = await supabase
        .from("storage_providers")
        .select("encrypted_credentials")
        .eq("id", providerId)
        .eq("user_id", ctx.userId)
        .single();

      if (providerError || !providerRow) {
        return jsonResponse({ success: false, error: "Provider credentials not found" }, 404);
      }

      let decryptedCredentials;
      try {
        const parsed = JSON.parse(providerRow.encrypted_credentials);
        const { ciphertext, nonce } = parsed || {};
        if (!ciphertext || !nonce) throw new Error("Invalid encrypted payload");

        const { data: decrypted, error: decryptError } = await supabase.rpc("decrypt_keyring_secret", {
          p_key_name: "storage_provider_credentials",
          p_ciphertext: ciphertext,
          p_nonce: nonce,
        });

        if (decryptError || !decrypted) throw new Error("Decrypt failed");
        decryptedCredentials = JSON.parse(decrypted as string);
      } catch {
        return jsonResponse({ success: false, error: "Provider credentials are invalid. Please reconfigure provider." }, 400);
      }

      const { accessKeyId, secretAccessKey, bucketName } = decryptedCredentials || {};

      if (!accessKeyId || !secretAccessKey || !bucketName) {
        return jsonResponse({ success: false, error: "Missing provider credentials" }, 400);
      }

      const objectKey = path || fileName;

      if (!objectKey) {
        return jsonResponse({ success: false, error: "Missing object path or file name" }, 400);
      }

      const s3Client = new S3Client({
        region: "auto",
        endpoint: "https://s3.tebi.io",
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      if (action === "upload") {
        const corsConfigured = await tryConfigureBucketCors(s3Client, bucketName);

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          ContentType: fileType || "application/octet-stream",
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return jsonResponse({ success: true, uploadUrl, objectKey, corsConfigured });
      } else if (action === "upload-proxy") {
        if (!fileBase64) {
          return jsonResponse({ success: false, error: "Missing file payload" }, 400);
        }

        const fileBytes = decodeBase64ToUint8Array(fileBase64);
        if (fileBytes.byteLength > MAX_PROXY_UPLOAD_BYTES) {
          return jsonResponse({
            success: false,
            error: `Proxy upload size limit exceeded (${MAX_PROXY_UPLOAD_BYTES} bytes max)`,
            code: "PAYLOAD_TOO_LARGE",
          }, 413);
        }

        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: fileBytes,
          ContentType: fileType || "application/octet-stream",
        }));

        return jsonResponse({ success: true, proxied: true, objectKey });
      } else if (action === "download") {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        });

        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return jsonResponse({ success: true, downloadUrl, objectKey });
      }

      return jsonResponse({ success: false, error: "Invalid action" }, 400);
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  });
});
