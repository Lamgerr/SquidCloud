/**
 * serve-site — v12.5 update
 * Now supports custom 404.html pages for folder-based published sites
 * If 404.html exists in root of a published folder, it is served for non-existent routes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const SITES_BUCKET = "squid-sites";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Parse the path: /serve/{ownerId}/{siteSlug}/{...filePath}
  const path = url.pathname.replace(/^\/serve-site\/?/, "");
  const segments = path.split("/").filter(Boolean);

  if (segments.length < 2) {
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  const ownerId = segments[0];
  const siteSlug = segments[1];
  const filePath = segments.slice(2).join("/") || "index.html";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the publication record
  const { data: pub, error: pubError } = await supabase
    .from("site_publications")
    .select("*")
    .eq("site_slug", siteSlug)
    .eq("owner_id", ownerId)
    .eq("status", "live")
    .single();

  if (pubError || !pub) {
    return new Response("Site not found", { status: 404, headers: CORS_HEADERS });
  }

  // If private, redirect to the app's Vercel serve endpoint (existing behavior)
  if (pub.visibility === "private") {
    const vercelUrl = `https://squidcloud.vercel.app/api/serve/${path}`;
    return new Response(null, {
      status: 302,
      headers: { Location: vercelUrl, ...CORS_HEADERS },
    });
  }

  // Try to fetch the requested file from Supabase Storage
  const storagePath = `${siteSlug}/${filePath}`;
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(SITES_BUCKET)
    .download(storagePath);

  if (!downloadError && fileData) {
    // File found — serve it
    const contentType = getContentType(filePath);
    const arrayBuffer = await fileData.arrayBuffer();
    const headers: Record<string, string> = {
      ...CORS_HEADERS,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    };

    return new Response(arrayBuffer, { status: 200, headers });
  }

  // File not found — v12.5: try to serve custom 404.html from folder root
  if (filePath !== "404.html") {
    const notFoundPath = `${siteSlug}/404.html`;
    const { data: notFoundData, error: notFoundError } = await supabase.storage
      .from(SITES_BUCKET)
      .download(notFoundPath);

    if (!notFoundError && notFoundData) {
      const arrayBuffer = await notFoundData.arrayBuffer();
      const headers: Record<string, string> = {
        ...CORS_HEADERS,
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=60",
      };

      return new Response(arrayBuffer, { status: 404, headers });
    }
  }

  return new Response("Not found", { status: 404, headers: CORS_HEADERS });
});

function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    mjs: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    txt: "text/plain",
    md: "text/markdown",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    pdf: "application/pdf",
    wasm: "application/wasm",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
