import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch";
import { withPrelGateway } from "../_shared/kza-prel.ts";
import { getProviderCredentials } from "../_shared/provider-vault.ts";

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
  kind: "env" | "admin" | "user";
}

// ============================================================
// BUCKET LOADING — env bucket + admin buckets + user buckets
// ============================================================

function getEndpointForProvider(providerType: string, customEndpoint?: string): string {
  if (customEndpoint) return customEndpoint;
  switch (providerType) {
    case 'tebi': return 'https://s3.tebi.io';
    case 'backblaze':
    case 'b2': return 'https://s3.us-east-0.backblazeb2.com';
    case 'wasabi': return 'https://s3.us-east-2.wasabisys.com';
    default: return '';
  }
}

async function loadAllBuckets(
  supabase: any,
  userId?: string
): Promise<B2Cluster[]> {
  const clusters: B2Cluster[] = [];
  const seen = new Set<string>();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // 1. Env-main bucket (always available, backwards compatible)
  const envKeyId = Deno.env.get("B2_ACCESS_KEY_ID");
  const envAppKey = Deno.env.get("B2_SECRET_ACCESS_KEY");
  if (envKeyId && envAppKey) {
    const bucketName = Deno.env.get("B2_BUCKET_NAME");
    if (bucketName && !seen.has(bucketName)) {
      clusters.push({
        id: "env_main",
        client: new AwsClient({
          accessKeyId: envKeyId,
          secretAccessKey: envAppKey,
          region: Deno.env.get("B2_REGION") ?? "us-west-000",
          service: "s3",
        }),
        endpoint: Deno.env.get("B2_ENDPOINT")!,
        bucket: bucketName,
        displayName: bucketName,
        kind: "env",
      });
      seen.add(bucketName);
    }
  }

  // 2. Admin-managed buckets
  const { data: adminBuckets } = await supabase
    .from("squidcloud_b2_buckets")
    .select("*")
    .eq("is_enabled", true);

  for (const b of adminBuckets || []) {
    if (seen.has(b.bucket_name)) continue;
    clusters.push({
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
      kind: "admin",
    });
    seen.add(b.bucket_name);
  }

  // 3. User-owned + public buckets (decentralized / shared pool)
  try {
    let providersQuery = supabase
      .from("storage_providers")
      .select("*")
      .eq("is_enabled", true);

    if (userId) {
      providersQuery = providersQuery.or(`user_id.eq.${userId},is_public.eq.true`);
    } else {
      providersQuery = providersQuery.eq("is_public", true);
    }
    providersQuery = providersQuery.limit(100);

    const { data: providers } = await providersQuery;
    for (const p of providers || []) {
      if (seen.has(p.bucket_name)) continue;
      try {
        const creds = await getProviderCredentials(supabase, serviceKey, p);
        const endpoint = p.bucket_endpoint || getEndpointForProvider(p.provider_type, creds?.accountId);
        const bucketName = p.bucket_name || creds?.bucketName;
        if (!bucketName || !creds?.accessKeyId || !creds?.secretAccessKey) continue;
        clusters.push({
          id: p.id,
          client: new AwsClient({
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            region: p.bucket_region || "auto",
            service: "s3",
          }),
          endpoint,
          bucket: bucketName,
          displayName: bucketName,
          kind: "user",
        });
        seen.add(bucketName);
      } catch (err: any) {
        console.error(`[cluster] skip provider ${p?.id} (${p?.bucket_name}):`, err?.message || err);
      }
    }
  } catch (err) {
    console.error("[cluster] failed to load user buckets:", err);
  }

  return clusters;
}

function resolveBucketCount(fileSize: number, available: number): number {
  if (available <= 0) return 0;
  if (available === 1) return 1;
  const mb = fileSize / (1024 * 1024);
  if (fileSize <= 0) return 1;
  if (mb < 5) return 1;
  if (mb < 50) return 2;
  return Math.min(4, available); // hidden cap: 4 buckets
}

async function signUrl(
  cluster: B2Cluster,
  path: string,
  method: string
): Promise<string> {
  const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`);
  const signedReq = await cluster.client.sign(url.toString(), {
    method,
    headers: method === "PUT" ? { "Content-Type": "application/octet-stream" } : undefined,
    aws: { signQuery: true },
  });
  return signedReq.url;
}

async function resolveClusterByBucket(
  clusters: B2Cluster[],
  bucket?: string,
  clusterId?: string
): Promise<B2Cluster | undefined> {
  if (bucket) {
    const found = clusters.find(c => c.bucket === bucket);
    if (found) return found;
  }
  if (clusterId && clusters.length > 1) {
    return clusters.find(c => c.id === clusterId);
  }
  return undefined;
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
      const clusters = await loadAllBuckets(supabase, ctx.userId !== 'anonymous' ? ctx.userId : undefined);
      return jsonResponse({
        totalNodes: clusters.length,
        nodes: clusters.map(c => ({
          id: c.id,
          bucket: c.bucket,
          endpoint: c.endpoint,
          kind: c.kind,
        })),
      });
    }

    // CORS fix trigger
    if (req.method === "GET" && reqUrl.searchParams.get("action") === "fix-cors") {
      const clusters = await loadAllBuckets(supabase);
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

    const requestData = await req.json();
    const { action, ...body } = requestData;

    // ===== GET UPLOAD URLS (smart round-robin across buckets) =====
    if (action === "get-upload-urls") {
      const { userId, chunks, totalSize, preferBucket } = body;

      if (!userId || !chunks || !Array.isArray(chunks)) {
        return createErrorResponse("Missing required fields for URL generation", 400);
      }

      const fileSize = typeof totalSize === "number" ? totalSize : 0;
      const clusters = await loadAllBuckets(supabase, userId);
      if (clusters.length === 0) {
        return createErrorResponse("No storage buckets configured", 503);
      }

      const bucketCount = resolveBucketCount(fileSize, clusters.length);

      // Deterministic-ish rotation so the first bucket isn't always identical
      const rotationOffset = Math.floor(Math.random() * clusters.length);
      const selected: B2Cluster[] = [];
      for (let b = 0; b < bucketCount; b++) {
        const cluster = clusters[(rotationOffset + b) % clusters.length];
        selected.push(cluster);
      }

      // If a specific bucket is preferred, honor it.
      const preferred = preferBucket
        ? clusters.find(c => c.bucket === preferBucket)
        : undefined;

      const signedUrls = await Promise.all(
        chunks.map(async (chunk: { path: string; index: number }, i: number) => {
          let cluster: B2Cluster;
          if (preferred) {
            cluster = preferred;
          } else if (selected.length === 1) {
            cluster = selected[0];
          } else {
            cluster = selected[i % selected.length];
          }
          const uploadUrl = await signUrl(cluster, chunk.path, "PUT");
          return {
            path: chunk.path,
            index: chunk.index,
            uploadUrl,
            clusterId: cluster.id,
            bucket: cluster.bucket,
            kind: cluster.kind,
          };
        })
      );

      return jsonResponse({
        success: true,
        urls: signedUrls,
        clusterCount: bucketCount,
        bucketAssignments: Object.fromEntries(
          signedUrls.map(u => [u.index, u.bucket] as [number, string])
        ),
      });
    }

    // ===== RESOLVE DOWNLOAD URLS (per-chunk bucket-aware) =====
    if (action === "resolve-download") {
      const { userId, chunks } = body;

      if (!Array.isArray(chunks) || chunks.length === 0) {
        return createErrorResponse("chunks array is required", 400);
      }

      const clusters = await loadAllBuckets(supabase, userId);
      if (clusters.length === 0) {
        return createErrorResponse("No storage buckets configured", 503);
      }

      console.log(`[cluster] resolve-download: ${clusters.length} clusters, buckets: ${clusters.map(c => c.bucket).join(', ')}`);

      const results = await Promise.all(
        chunks.map(async (chunk: { path: string; index: number; bucket?: string; clusterId?: string }, i: number) => {
          const cluster =
            (await resolveClusterByBucket(clusters, chunk.bucket, chunk.clusterId)) ||
            clusters[0];
          if (!cluster) {
            throw new Error(`No cluster found for bucket=${chunk.bucket} clusterId=${chunk.clusterId}`);
          }
          console.log(`[cluster] resolve chunk ${i}: path=${chunk.path} bucket=${cluster.bucket} endpoint=${cluster.endpoint}`);
          const downloadUrl = await signUrl(cluster, chunk.path, "GET");
          return {
            index: typeof chunk.index === "number" ? chunk.index : i,
            path: chunk.path,
            downloadUrl,
            bucket: cluster.bucket,
            clusterId: cluster.id,
          };
        })
      );

      return jsonResponse({ success: true, urls: results });
    }

    // ===== DOWNLOAD HANDLER =====
    if (action === "download") {
      const { path, repo, clusterId, nodeId, shareId, userId, bucket } = body;

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

      // B2 — pick a cluster by bucket name, clusterId, or fallback
      const clusters = await loadAllBuckets(supabase, userId);
      if (clusters.length === 0) {
        return createErrorResponse("No storage buckets configured", 503);
      }
      const cluster =
        (await resolveClusterByBucket(clusters, bucket, clusterId)) ||
        clusters[0];

      const downloadUrl = await signUrl(cluster, path, "GET");
      return jsonResponse({ success: true, downloadUrl, bucket: cluster.bucket, legacy: false });
    }

    // ===== DELETE HANDLER =====
    if (action === "delete") {
      const { path, repo, clusterId, bucket, userId } = body;

      if (repo !== "b2") return jsonResponse({ success: true, message: "Legacy delete skipped" });

      const clusters = await loadAllBuckets(supabase, userId);
      if (clusters.length === 0) {
        return createErrorResponse("No storage buckets configured", 503);
      }
      const cluster =
        (await resolveClusterByBucket(clusters, bucket, clusterId)) ||
        clusters[0];

      const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`);
      const signedReq = await cluster.client.sign(url.toString(), {
        method: "DELETE",
        aws: { signQuery: true },
      });

      await fetch(signedReq);
      return jsonResponse({ success: true, message: "File deleted", bucket: cluster.bucket });
    }

    return createErrorResponse("Unknown action", 400);
  } catch (error: any) {
    console.error('[cluster] error:', error);
    return createErrorResponse(`Internal server error: ${error.message}`);
  }
  });
});