import { S3Client, HeadBucketCommand, ListBucketsCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

Deno.serve(async (req) => {
  return withPrelGateway(req, { functionId: 'verify-provider', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { accountId, accessKeyId, secretAccessKey, bucketName, providerType } = await req.json();

      // Validate required fields
      if (!accessKeyId || !secretAccessKey || !bucketName) {
        return jsonResponse({ success: false, error: "Missing required fields" }, 400);
      }

      // Set endpoint based on provider type
      let endpoint = undefined;
      if (providerType === 'r2') {
        if (!accountId) {
          return jsonResponse({ success: false, error: "Account ID is required for R2" }, 400);
        }
        endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
      } else if (providerType === 'tebi') {
        endpoint = `https://s3.tebi.io`;
      }

      // Verify that the authenticated user owns this provider
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: existingProvider } = await supabase
        .from("storage_providers")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("provider_type", providerType)
        .maybeSingle();

      if (!existingProvider) {
        return jsonResponse({ success: false, error: "Provider not found for this user" }, 404);
      }

      // Create S3 client with provided credentials
      const s3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Try HeadBucket first (most efficient)
      try {
        await s3Client.send(
          new HeadBucketCommand({ Bucket: bucketName })
        );

        return jsonResponse({ success: true });
      } catch (headError) {
        console.error("HeadBucket error:", headError.message);

        // Fallback to ListBuckets
        try {
          const listResult = await s3Client.send(new ListBucketsCommand({}));
          const bucketExists = listResult.Buckets?.some((b) => b.Name === bucketName);

          if (bucketExists) {
            return jsonResponse({ success: true });
          } else {
            return jsonResponse({ success: false, error: `Bucket ${bucketName} not found` }, 404);
          }
        } catch (listError) {
          console.error("ListBuckets error:", listError.message);
          return jsonResponse({ success: false, error: "Invalid credentials or bucket does not exist" }, 401);
        }
      }
    } catch (error) {
      console.error("Error:", error.message);
      return jsonResponse({ success: false, error: "Internal server error" }, 500);
    }
  });
});