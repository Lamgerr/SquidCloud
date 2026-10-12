import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, DeleteObjectCommand, PutBucketCorsCommand } from "https://esm.sh/@aws-sdk/client-s3";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';
import { getProviderCredentials } from '../_shared/provider-vault.ts';
import { swkCheckUploadBan, swkVerifyToken } from '../_shared/swk-verify.ts';

function getEndpointForProvider(providerType: string, accountId?: string, customEndpoint?: string): string {
  if (customEndpoint) return customEndpoint;
  switch (providerType) {
    case 'tebi': return 'https://s3.tebi.io';
    case 'r2': return `https://${accountId || 'placeholder'}.r2.cloudflarestorage.com`;
    case 'backblaze': case 'b2': return 'https://s3.us-east-0.backblazeb2.com';
    case 'wasabi': return 'https://s3.us-east-2.wasabisys.com';
    case 'azure': return 'https://<storage-account>.blob.core.windows.net';
    default: return '';
  }
}

async function tryConfigureBucketCors(s3Client: S3Client, bucketName: string): Promise<boolean> {
  try {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
          MaxAgeSeconds: 86400,
        }],
      },
    }));
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  return withPrelGateway(req, { functionId: 's3-storage', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { action, providerId, chunks, path, fileName, fileType, fileBase64, swkToken, swkManifestHash, totalSize } = await req.json();

      if (!providerId) {
        return jsonResponse({ success: false, error: "Provider ID is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: "Server configuration error" }, 500);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch provider row (supports both user storage_providers and admin squidcloud_b2_buckets)
      let providerRow: any = null;
      let isSquidcloudBucket = false;

      // Try squidcloud_b2_buckets first for bucket IDs starting with 'sc-'
      if (providerId.startsWith('sc-')) {
        const { data } = await supabase
          .from("squidcloud_b2_buckets")
          .select("*")
          .eq("id", providerId.replace('sc-', ''))
          .single();
        if (data) {
          providerRow = data;
          isSquidcloudBucket = true;
        }
      }

      if (!providerRow) {
        const { data, error } = await supabase
          .from("storage_providers")
          .select("*")
          .eq("id", providerId)
          .eq("user_id", ctx.userId)
          .single();

        if (error || !data) {
          return jsonResponse({ success: false, error: "Provider not found" }, 404);
        }
        providerRow = data;
      }

      let credentials: any;
      if (isSquidcloudBucket) {
        credentials = {
          accessKeyId: providerRow.access_key_id,
          secretAccessKey: providerRow.secret_access_key,
          bucketName: providerRow.bucket_name,
          endpoint: providerRow.bucket_endpoint,
          region: providerRow.bucket_region,
        };
      } else {
        try {
          credentials = await getProviderCredentials(supabase, supabaseServiceKey, providerRow);
        } catch {
          return jsonResponse({ success: false, error: "Provider credentials are invalid. Please reconfigure provider." }, 400);
        }

        credentials.bucketName = providerRow.bucket_name || credentials.bucketName;
        credentials.region = providerRow.bucket_region || credentials.region || 'auto';
        credentials.endpoint = providerRow.bucket_endpoint || getEndpointForProvider(
          providerRow.provider_type, credentials.accountId
        );
      }

      if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.bucketName) {
        return jsonResponse({ success: false, error: "Missing provider credentials" }, 400);
      }

      let s3Client = new S3Client({
        region: credentials.region || "auto",
        endpoint: credentials.endpoint || undefined,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
        requestHandler: undefined,
      });

      let bucketName = credentials.bucketName;

      // Permission checks for user-managed providers (not squidcloud admin buckets)
      const checkRead = () => {
        if (!isSquidcloudBucket && providerRow.read_enabled === false) {
          return jsonResponse({ success: false, error: "Read access is disabled for this bucket. Enable it in Storage Provider settings." }, 403);
        }
        return null;
      };
      const checkWrite = () => {
        if (!isSquidcloudBucket && providerRow.write_enabled === false) {
          return jsonResponse({ success: false, error: "Write access is disabled for this bucket. Enable it in Storage Provider settings." }, 403);
        }
        return null;
      };

      // ===== ACTIONS =====

      if (action === "get-upload-urls") {
        const writeCheck = checkWrite();
        if (writeCheck) return writeCheck;

        if (!chunks || !Array.isArray(chunks)) {
          return jsonResponse({ success: false, error: "chunks array required" }, 400);
        }

        // ===== S-HAWK GATE (same screening as the cluster path) =====
        {
          const gateUser = (ctx.userId && ctx.userId !== 'anonymous') ? ctx.userId : String(providerRow.user_id || '');
          const ban = await swkCheckUploadBan(supabase, gateUser);
          if (!ban.ok) return jsonResponse({ success: false, error: ban.error }, ban.status);
          const gate = await swkVerifyToken(supabase, {
            userId: gateUser,
            token: String(swkToken || ""),
            manifestHash: String(swkManifestHash || ""),
            sizeBytes: typeof totalSize === "number" ? totalSize : 0,
          });
          if (!gate.ok) return jsonResponse({ success: false, error: gate.error }, gate.status);
        }

        // ===== CAPACITY GATE + SIBLING FAILOVER =====
        // Never hand out upload URLs for a bucket that is already at quota.
        // storage_used_bytes / storage_limit_bytes are maintained by the
        // usage tracker; a NULL limit means unlimited. When the requested
        // bucket is full, transparently fail over to a sibling provider of
        // the same owner with room, and report the effective provider id so
        // the client records metadata against the bucket that holds the data.
        // (Failover stays within user-owned providers; admin sc-buckets are
        // gated but never silently swapped, since file rows FK to
        // storage_providers.)
        let failoverFrom: string | null = null;
        let failoverTo: string | null = null;
        {
          const needBytes = typeof totalSize === "number" && totalSize > 0 ? totalSize : 0;
          const hasRoom = (row: any, need: number) => {
            if (row.storage_limit_bytes == null) return true;
            const used = Number(row.storage_used_bytes) || 0;
            return need > 0 ? used + need <= row.storage_limit_bytes : used < row.storage_limit_bytes;
          };
          const freeBytes = (row: any) =>
            row.storage_limit_bytes == null ? Number.MAX_SAFE_INTEGER : Math.max(0, row.storage_limit_bytes - (Number(row.storage_used_bytes) || 0));

          if (!isSquidcloudBucket && !hasRoom(providerRow, needBytes)) {
            const { data: siblings } = await supabase
              .from("storage_providers")
              .select("id, bucket_name, storage_used_bytes, storage_limit_bytes, write_enabled")
              .eq("user_id", ctx.userId)
              .neq("id", providerRow.id);
            const candidate = (siblings || [])
              .filter((s: any) => s.write_enabled !== false && hasRoom(s, needBytes))
              .sort((a: any, b: any) => freeBytes(b) - freeBytes(a))[0];
            if (!candidate) {
              return jsonResponse({
                success: false,
                error: "Storage bucket is full and no other bucket with free space was found. Free up space or add another provider.",
                code: "BUCKET_FULL",
              }, 409);
            }
            // Swap the active row + client to the sibling bucket.
            const { data: fullRow } = await supabase
              .from("storage_providers")
              .select("*")
              .eq("id", candidate.id)
              .eq("user_id", ctx.userId)
              .single();
            if (!fullRow) {
              return jsonResponse({ success: false, error: "Storage bucket is full and failover failed. Try again." }, 409);
            }
            providerRow = fullRow;
            failoverFrom = providerId;
            failoverTo = fullRow.id;
            try {
              credentials = await getProviderCredentials(supabase, supabaseServiceKey, providerRow);
            } catch {
              return jsonResponse({ success: false, error: "Provider credentials are invalid. Please reconfigure provider." }, 400);
            }
            credentials.bucketName = providerRow.bucket_name || credentials.bucketName;
            credentials.region = providerRow.bucket_region || credentials.region || 'auto';
            credentials.endpoint = providerRow.bucket_endpoint || getEndpointForProvider(
              providerRow.provider_type, credentials.accountId
            );
            if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.bucketName) {
              return jsonResponse({ success: false, error: "Missing provider credentials" }, 400);
            }
            s3Client = new S3Client({
              region: credentials.region || "auto",
              endpoint: credentials.endpoint || undefined,
              credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
              },
              requestHandler: undefined,
            });
            bucketName = credentials.bucketName;
          } else if (isSquidcloudBucket && !hasRoom(providerRow, needBytes)) {
            return jsonResponse({
              success: false,
              error: "Storage bucket is full. Free up space and try again.",
              code: "BUCKET_FULL",
            }, 409);
          }
        }

        const signedUrls = await Promise.all(
          chunks.map(async (chunk: { path: string; index: number }) => {
            const command = new PutObjectCommand({
              Bucket: bucketName,
              Key: chunk.path,
              ContentType: "application/octet-stream",
            });
            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
            return { path: chunk.path, index: chunk.index, uploadUrl };
          })
        );

        return jsonResponse({
          success: true,
          urls: signedUrls,
          providerId: failoverTo || providerId,
          failover: failoverTo !== null,
          ...(failoverTo ? { failoverFrom } : {}),
        });
      }

      if (action === "get-download-url") {
        const readCheck = checkRead();
        if (readCheck) return readCheck;

        if (!path) {
          return jsonResponse({ success: false, error: "path is required" }, 400);
        }

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: path,
        });
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return jsonResponse({ success: true, downloadUrl });
      }

      if (action === "delete") {
        const writeCheck = checkWrite();
        if (writeCheck) return writeCheck;

        if (!path) {
          return jsonResponse({ success: false, error: "path is required" }, 400);
        }

        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: path,
        }));

        return jsonResponse({ success: true, message: "Object deleted" });
      }

      if (action === "head-bucket") {
        try {
          await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
          return jsonResponse({ success: true, bucket: bucketName, status: "accessible" });
        } catch (error: any) {
          return jsonResponse({ success: false, error: `Bucket not accessible: ${error.message}` }, 403);
        }
      }

      if (action === "get-usage") {
        try {
          let totalSize = 0;
          let isTruncated = true;
          let continuationToken: string | undefined;

          while (isTruncated) {
            const listCommand = new ListObjectsV2Command({
              Bucket: bucketName,
              ContinuationToken: continuationToken,
              MaxKeys: 1000,
            });
            const response = await s3Client.send(listCommand);
            
            if (response.Contents) {
              for (const obj of response.Contents) {
                totalSize += obj.Size || 0;
              }
            }

            isTruncated = response.IsTruncated || false;
            continuationToken = response.NextContinuationToken;
          }

          return jsonResponse({
            success: true,
            storageUsedBytes: totalSize,
            bucket: bucketName,
          });
        } catch (error: any) {
          return jsonResponse({ success: false, error: `Failed to get usage: ${error.message}` }, 500);
        }
      }

      if (action === "fix-cors") {
        const corsOk = await tryConfigureBucketCors(s3Client, bucketName);
        return jsonResponse({ success: true, corsConfigured: corsOk });
      }

      if (action === "upload-proxy") {
        const writeCheck = checkWrite();
        if (writeCheck) return writeCheck;

        if (!path || !fileBase64) {
          return jsonResponse({ success: false, error: "path and fileBase64 required" }, 400);
        }

        const binary = atob(fileBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        if (bytes.byteLength > 10 * 1024 * 1024) {
          return jsonResponse({ success: false, error: "Proxy upload limited to 10MB" }, 413);
        }

        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: path,
          Body: bytes,
          ContentType: fileType || "application/octet-stream",
        }));

        return jsonResponse({ success: true, proxied: true, objectKey: path });
      }

      return jsonResponse({ success: false, error: "Invalid action" }, 400);
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  });
});
