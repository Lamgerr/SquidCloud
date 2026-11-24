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
  console.error(`Error: ${message}`, details);
  return jsonResponse(
    { error: message, ...(details !== undefined ? { details: JSON.stringify(details) } : {}) },
    status
  );
};

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'github-storage', operation: 'default' }, async (ctx) => {
  // Handle CORS Preflight requests for the Edge Function
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const reqUrl = new URL(req.url);

    // ==========================================
    // 🛠️ TEMPORARY BUCKET CORS FIX ROUTE
    // Trigger this by visiting: https://[YOUR_PROJECT].supabase.co/functions/v1/github-storage?action=fix-cors
    // ==========================================
    if (req.method === "GET" && reqUrl.searchParams.get("action") === "fix-cors") {
      const b2Client = new AwsClient({
        accessKeyId: Deno.env.get("B2_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("B2_SECRET_ACCESS_KEY")!,
        region: Deno.env.get("B2_REGION")!,
        service: "s3",
      });

      const B2_ENDPOINT = Deno.env.get("B2_ENDPOINT")!;
      const B2_BUCKET = Deno.env.get("B2_BUCKET_NAME")!;

      // Ultra-secure CORS XML
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

      // 🚀 NEW: Calculate SHA-256 Checksum required by Backblaze
      const xmlBuffer = new TextEncoder().encode(corsXml);
      const hashBuffer = await crypto.subtle.digest("SHA-256", xmlBuffer);
      const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

      const url = new URL(`${B2_ENDPOINT}/${B2_BUCKET}?cors`);
      const signedReq = await b2Client.sign(url.toString(), {
        method: "PUT",
        headers: { 
          "Content-Type": "application/xml",
          "x-amz-checksum-sha256": hashBase64 
        },
        body: corsXml,
      });

      const res = await fetch(signedReq);
      return new Response(`CORS Fix Status: ${res.status} - ${await res.text()}`, {
        headers: CORS_HEADERS,
      });
    }

    // ==========================================
    // MAIN API ROUTING (Requires POST)
    // ==========================================
    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed. Use POST.", 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return createErrorResponse("Supabase configuration not complete.", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize Backblaze S3 Client Securely
    const b2Client = new AwsClient({
      accessKeyId: Deno.env.get("B2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("B2_SECRET_ACCESS_KEY")!,
      region: Deno.env.get("B2_REGION")!,
      service: "s3",
    });

    const B2_ENDPOINT = Deno.env.get("B2_ENDPOINT")!;
    const B2_BUCKET = Deno.env.get("B2_BUCKET_NAME")!;

    const requestData = await req.json();
    const { action, ...body } = requestData;

    // ==========================================
    // 1. GET UPLOAD URLS (DIRECT CDN UPLOAD)
    // ==========================================
    if (action === "get-upload-urls") {
      const { userId, chunks } = body;

      if (!userId || !chunks || !Array.isArray(chunks)) {
        return createErrorResponse("Missing required fields for URL generation", 400);
      }

      // Generate signed URLs valid for 15 minutes
      const signedUrls = await Promise.all(
        chunks.map(async (chunk: { path: string; index: number }) => {
          const url = new URL(`${B2_ENDPOINT}/${B2_BUCKET}/${chunk.path}`);
          const signedReq = await b2Client.sign(url.toString(), {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            aws: { signQuery: true },
          });
          return { path: chunk.path, index: chunk.index, uploadUrl: signedReq.url };
        })
      );

      return jsonResponse({ success: true, urls: signedUrls });
    }

    // ==========================================
    // 2. DOWNLOAD HANDLER (B2 + GITHUB FALLBACK)
    // ==========================================
    if (action === "download") {
      const { path, repo, nodeId, shareId, userId } = body;

      // Handle Share validation if a shareId is provided
      if (shareId) {
        const { data: shareData, error: shareError } = await supabase.rpc("get_shared_file_info", {
          share_id_param: shareId,
        });
        if (shareError || !shareData || !shareData[0]) {
          return createErrorResponse("Invalid or expired share link", 403);
        }
      }

      // Legacy GitHub Path — resolve the repo owner at read time (old metadata
      // stored only a name + account index). Dedicated storage account first,
      // then the user's own connection, then the indexed accounts, then public.
      if (repo && repo !== "b2") {
        const candidates: { token?: string; user?: string }[] = [
          { token: Deno.env.get("LEGACY_STORAGE_GITHUB_TOKEN"), user: Deno.env.get("LEGACY_STORAGE_GITHUB_USERNAME") },
        ];
        try {
          const { data: conn } = await supabase
            .from("github_connections")
            .select("github_username, access_token")
            .eq("user_id", userId)
            .limit(1);
          if (conn?.[0]?.github_username) candidates.push({ user: conn[0].github_username, token: conn[0].access_token });
        } catch { /* optional extra route */ }

        const GITHUB_TOKENS = [Deno.env.get("GITHUB_TOKEN"), Deno.env.get("GITHUB_TOKEN_2"), Deno.env.get("GITHUB_TOKEN_3")];
        const GITHUB_USERS = [Deno.env.get("GITHUB_USERNAME"), Deno.env.get("GITHUB_USERNAME_2"), Deno.env.get("GITHUB_USERNAME_3")];
        const nodeIndex = Math.min(nodeId || 0, 2);
        candidates.push({ token: GITHUB_TOKENS[nodeIndex] || GITHUB_TOKENS[0], user: GITHUB_USERS[nodeIndex] || GITHUB_USERS[0] });
        for (let i = 0; i < 3; i++) candidates.push({ token: GITHUB_TOKENS[i], user: GITHUB_USERS[i] });
        candidates.push({});

        let lastStatus = 404;
        for (const c of candidates) {
          if (!c.user) continue;
          const fetchUrl = `https://api.github.com/repos/${encodeURIComponent(c.user)}/${encodeURIComponent(repo)}/contents/${path}`;
          const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json", "User-Agent": "Squidcloud" };
          if (c.token) headers.Authorization = `Bearer ${c.token}`;
          try {
            const response = await fetch(fetchUrl, { headers });
            lastStatus = response.status;
            if (!response.ok) continue;
            const data = await response.json();
            if (!data?.content) continue;
            return jsonResponse({ success: true, content: data.content, legacy: true });
          } catch { /* next account */ }
        }
        return createErrorResponse(`Legacy GitHub chunk not found (last status ${lastStatus})`, 404);
      }

      // New Backblaze B2 Path (Presigned GET URL)
      const url = new URL(`${B2_ENDPOINT}/${B2_BUCKET}/${path}`);
      const signedReq = await b2Client.sign(url.toString(), {
        method: "GET",
        aws: { signQuery: true },
      });

      return jsonResponse({ success: true, downloadUrl: signedReq.url, legacy: false });
    }

    // ==========================================
    // 3. DELETE HANDLER (B2 ONLY)
    // ==========================================
    if (action === "delete") {
      const { path, repo } = body;

      if (repo !== "b2") return jsonResponse({ success: true, message: "Legacy delete skipped" });

      const url = new URL(`${B2_ENDPOINT}/${B2_BUCKET}/${path}`);
      const signedReq = await b2Client.sign(url.toString(), {
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
