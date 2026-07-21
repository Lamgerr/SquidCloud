import { S3Client, HeadBucketCommand, ListBucketsCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

Deno.serve(async (req) => {
  return withPrelGateway(req, { functionId: 'verify-provider', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { accountId, accessKeyId, secretAccessKey, bucketName, providerType, endpoint, region } = await req.json();

      if (!accessKeyId || !secretAccessKey || !bucketName) {
        return jsonResponse({ success: false, error: "Missing required fields" }, 400);
      }

      // Determine endpoint based on provider type
      let resolvedEndpoint = endpoint;
      if (!resolvedEndpoint) {
        switch (providerType) {
          case 'r2':
            if (!accountId) return jsonResponse({ success: false, error: "Account ID is required for R2" }, 400);
            resolvedEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
            break;
          case 'tebi':
            resolvedEndpoint = 'https://s3.tebi.io';
            break;
          case 'wasabi':
            resolvedEndpoint = `https://s3.${region || 'us-east-2'}.wasabisys.com`;
            break;
          case 'backblaze':
          case 'b2':
            resolvedEndpoint = `https://s3.${region || 'us-east-0'}.backblazeb2.com`;
            break;
          default:
            return jsonResponse({ success: false, error: "Unknown provider type. Provide a custom endpoint." }, 400);
        }
      }

      const s3Client = new S3Client({
        region: region || "auto",
        endpoint: resolvedEndpoint,
        credentials: { accessKeyId, secretAccessKey },
      });

      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return jsonResponse({
          success: true,
          provider: providerType,
          bucket: bucketName,
          endpoint: resolvedEndpoint,
        });
      } catch (headError: any) {
        try {
          const listResult = await s3Client.send(new ListBucketsCommand({}));
          const bucketExists = listResult.Buckets?.some((b) => b.Name === bucketName);

          if (bucketExists) {
            return jsonResponse({
              success: true,
              provider: providerType,
              bucket: bucketName,
              endpoint: resolvedEndpoint,
            });
          }

          return jsonResponse({ success: false, error: `Bucket "${bucketName}" not found` }, 404);
        } catch (listError: any) {
          return jsonResponse({ success: false, error: "Invalid credentials or bucket does not exist" }, 401);
        }
      }
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  });
});
