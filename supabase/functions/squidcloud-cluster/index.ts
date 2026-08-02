import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch";
import { withPrelGateway } from "../_shared/kza-prel.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-upload-chunkindex, x-upload-chunkcount, x-upload-totalchunks, x-upload-filename, x-upload-filetype, x-upload-totalsize, x-upload-userid, x-upload-path, x-upload-repo, x-upload-nodeid",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const createErrorResponse = (message: string, status = 500, details?: any) => {
  return jsonResponse(
    { error: message, ...(details !== undefined ? { details: JSON.stringify(details) } : {}) },
    status
  );
};

interface B2Cluster {
  id: string;
  client: AwsClient;
  endpoint: string;
  bucket: string;
  displayName: string;
}

async function loadB2Clusters(supabase: any): Promise<B2Cluster[]> {
  const { data: buckets } = await supabase
    .from("squidcloud_b2_buckets")
    .select("*")
    .eq("is_enabled", true);

  if (!buckets || buckets.length === 0) {
    // Fall back to env vars for backwards compatibility
    const keyId = Deno.env.get("B2_ACCESS_KEY_ID");
    const appKey = Deno.env.get("B2_SECRET_ACCESS_KEY");
    if (keyId && appKey) {
      return [{
        id: "legacy",
        client: new AwsClient({
          accessKeyId: keyId,
          secretAccessKey: appKey,
          region: Deno.env.get("B2_REGION")!,
          service: "s3",
        }),
        endpoint: Deno.env.get("B2_ENDPOINT")!,
        bucket: Deno.env.get("B2_BUCKET_NAME")!,
        displayName: "legacy",
      }];
    }
    return [];
  }

  return buckets.map((b: any) => ({
    id: b.id,
    client: new AwsClient({
      accessKeyId: b.access_key_id,
      secretAccessKey: b.secret_access_key,
      region: b.bucket_region,
      service: "s3",
    }),
    endpoint: b.bucket_endpoint,
    bucket: b.bucket_name,
    displayName: b.bucket_name,
  }));
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'squidcloud-cluster', operation: 'default' }, async (ctx) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return createErrorResponse("Supabase configuration not complete.", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const reqUrl = new URL(req.url);

    // GET /?action=get-cluster-info — list cluster info
    if (req.method === "GET" && reqUrl.searchParams.get("action") === "get-cluster-info") {
      const clusters = await loadB2Clusters(supabase);
      return jsonResponse({
        totalNodes: clusters.length,
        nodes: clusters.map(c => ({
          id: c.id,
          bucket: c.bucket,
          endpoint: c.endpoint,
        })),
      });
    }

    // CORS fix trigger
    if (req.method === "GET" && reqUrl.searchParams.get("action") === "fix-cors") {
      const clusters = await loadB2Clusters(supabase);
      const results: any[] = [];

      for (const cluster of clusters) {
        const corsXml = `<CORSConfiguration>
          <CORSRule>
            <AllowedOrigin>https://squidcloud.vercel.app</AllowedOrigin>
            <AllowedOrigin>http://localhost:5173</AllowedOrigin>
            <AllowedOrigin>http://localhost:3000</AllowedOrigin>
            <AllowedMethod>PUT</AllowedMethod>
            <AllowedMethod>POST</AllowedMethod>
            <AllowedMethod>GET</AllowedMethod>
            <AllowedMethod>HEAD</AllowedMethod>
            <AllowedHeader>*</AllowedHeader>
            <MaxAgeSeconds>3000</MaxAgeSeconds>
          </CORSRule>
        </CORSConfiguration>`;

        const xmlBuffer = new TextEncoder().encode(corsXml);
        const hashBuffer = await crypto.subtle.digest("SHA-256", xmlBuffer);
        const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

        const url = new URL(`${cluster.endpoint}/${cluster.bucket}?cors`);
        const signedReq = await cluster.client.sign(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/xml", "x-amz-checksum-sha256": hashBase64 },
          body: corsXml,
        });

        const res = await fetch(signedReq);
        results.push({ bucket: cluster.bucket, status: res.status });
      }

      return new Response(`CORS Fix Results: ${JSON.stringify(results)}`, { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed. Use POST.", 405);
    }

    const clusters = await loadB2Clusters(supabase);
    if (clusters.length === 0) {
      return createErrorResponse("No B2 clusters configured", 503);
    }

    const requestData = await req.json();
    const { action, ...body } = requestData;

    // ===== GET UPLOAD URLS (Round-robin across clusters) =====
    if (action === "get-upload-urls") {
      const { userId, chunks } = body;

      if (!userId || !chunks || !Array.isArray(chunks)) {
        return createErrorResponse("Missing required fields for URL generation", 400);
      }

      const signedUrls = await Promise.all(
        chunks.map(async (chunk: { path: string; index: number }, i: number) => {
          const cluster = clusters[i % clusters.length];
          const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${chunk.path}`);
          const signedReq = await cluster.client.sign(url.toString(), {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            aws: { signQuery: true },
          });
          return {
            path: chunk.path,
            index: chunk.index,
            uploadUrl: signedReq.url,
            clusterId: clusters.length > 1 ? cluster.id : undefined,
          };
        })
      );

      return jsonResponse({ success: true, urls: signedUrls, clusterCount: clusters.length });
    }

    // ===== DOWNLOAD HANDLER =====
    if (action === "download") {
      const { path, repo, clusterId, nodeId, shareId, userId } = body;

      if (shareId) {
        const { data: shareData, error: shareError } = await supabase.rpc("get_shared_file_info", {
          share_id_param: shareId,
        });
        if (shareError || !shareData || !shareData[0]) {
          return createErrorResponse("Invalid or expired share link", 403);
        }
      }

      // Legacy GitHub fallback
      if (repo && repo !== "b2") {
        const GITHUB_TOKENS = [
          Deno.env.get("GITHUB_TOKEN"), Deno.env.get("GITHUB_TOKEN_2"), Deno.env.get("GITHUB_TOKEN_3"),
        ];
        const GITHUB_USERS = [
          Deno.env.get("GITHUB_USERNAME"), Deno.env.get("GITHUB_USERNAME_2"), Deno.env.get("GITHUB_USERNAME_3"),
        ];

        const nodeIndex = Math.min(nodeId || 0, 2);
        const token = GITHUB_TOKENS[nodeIndex] || GITHUB_TOKENS[0];
        const user = GITHUB_USERS[nodeIndex] || GITHUB_USERS[0];

        const fetchUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
        const response = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Squidcloud" },
        });

        if (!response.ok) return createErrorResponse("Legacy GitHub chunk not found", 404);
        const data = await response.json();
        return jsonResponse({ success: true, content: data.content, legacy: true });
      }

      // B2 — pick the right cluster
      let cluster: B2Cluster;
      if (clusterId && clusters.length > 1) {
        const found = clusters.find(c => c.id === clusterId);
        cluster = found || clusters[0];
      } else {
        cluster = clusters[0];
      }

      const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`);
      const signedReq = await cluster.client.sign(url.toString(), {
        method: "GET",
        aws: { signQuery: true },
      });

      return jsonResponse({ success: true, downloadUrl: signedReq.url, legacy: false });
    }

    // ===== DELETE HANDLER =====
    if (action === "delete") {
      const { path, repo, clusterId } = body;

      if (repo !== "b2") return jsonResponse({ success: true, message: "Legacy delete skipped" });

      let cluster: B2Cluster;
      if (clusterId && clusters.length > 1) {
        const found = clusters.find(c => c.id === clusterId);
        cluster = found || clusters[0];
      } else {
        cluster = clusters[0];
      }

      const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`);
      const signedReq = await cluster.client.sign(url.toString(), {
        method: "DELETE",
        aws: { signQuery: true },
      });

      await fetch(signedReq);
      return jsonResponse({ success: true, message: "File deleted" });
    }

    return createErrorResponse("Unknown action", 400);
  } catch (error: any) {
    return createErrorResponse(`Internal server error: ${error.message}`);
  }
  });
});
