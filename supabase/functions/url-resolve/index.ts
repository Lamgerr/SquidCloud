import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

const MEDIA_TYPES = new Set([
  "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/x-flv", "video/mpeg", "video/3gpp", "video/MP2T",
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/flac", "audio/aac",
  "audio/mp4",
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
  "application/zip", "application/x-7z-compressed", "application/x-rar-compressed",
  "application/octet-stream",
  "text/plain", "text/html", "text/csv", "text/markdown",
  "application/json", "application/javascript", "text/javascript",
  "font/woff", "font/woff2", "application/font-sfnt",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "ogg", "ogv", "mov", "avi", "mkv", "flv", "m4v",
  "3gp", "3g2", "ts", "mts", "m2ts", "wmv", "mpg", "mpeg", "vob",
]);
const AUDIO_EXTENSIONS = new Set([
  "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus",
]);
const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff",
]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);
const DOC_EXTENSIONS = new Set(["pdf", "txt", "md", "csv", "json", "js", "ts", "html", "css"]);

function extFromPath(pathname: string): string {
  const parts = pathname.split("/").pop() || "";
  const dot = parts.lastIndexOf(".");
  return dot > 0 ? parts.slice(dot + 1).toLowerCase() : "";
}

function guessTypeByExt(ext: string): string {
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archive";
  if (DOC_EXTENSIONS.has(ext)) return "document";
  return "file";
}

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
    mov: "video/quicktime", avi: "video/x-msvideo", flv: "video/x-flv",
    mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac",
    ogg: "audio/ogg", m4a: "audio/mp4",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", zip: "application/zip",
    txt: "text/plain", json: "application/json",
  };
  return map[ext] || "application/octet-stream";
}

function extractFilename(urlStr: string, contentType: string | null): string {
  try {
    const url = new URL(urlStr);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";
    if (lastPart && lastPart.includes(".")) {
      return decodeURIComponent(lastPart.split("?")[0]);
    }
  } catch {}
  const ext = contentType?.includes("/")
    ? contentType.split("/")[1]?.replace("jpeg", "jpg") || "bin"
    : "bin";
  return `download.${ext}`;
}

function extractVideoSources(html: string, pageUrl: string): Array<{
  url: string;
  type: string;
  label: string;
  format?: string;
}> {
  const sources: Array<{ url: string; type: string; label: string; format?: string }> = [];
  const seen = new Set<string>();
  const base = new URL(pageUrl);

  const resolve = (raw: string): string | null => {
    try { return new URL(raw, base).href; } catch { return null; }
  };

  const add = (src: string, type: string, label: string, format?: string) => {
    const resolved = resolve(src);
    if (!resolved || seen.has(resolved)) return;
    if (resolved.startsWith("blob:") || resolved.startsWith("data:")) return;
    seen.add(resolved);
    const ext = extFromPath(new URL(resolved).pathname);
    sources.push({ url: resolved, type, label, format: format || ext || undefined });
  };

  // <video src="..."> and <video><source src="..." type="..."></video>
  const videoTagRe = /<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = videoTagRe.exec(html)) !== null) add(m[1], "video", "Video");

  const sourceInVideoRe = /<video\b[\s\S]*?<\/video>/gi;
  let vm: RegExpExecArray | null;
  while ((vm = sourceInVideoRe.exec(html)) !== null) {
    const block = vm[0];
    const sourceRe = /<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*/gi;
    let sm: RegExpExecArray | null;
    while ((sm = sourceRe.exec(block)) !== null) {
      const typeMatch = block.slice(sm.index, sm.index + sm[0].length).match(/type=["']([^"']+)["']/);
      add(sm[1], "video", "Video", typeMatch?.[1]);
    }
  }

  // Standalone <source> tags (outside video)
  const sourceRe = /<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*/gi;
  while ((m = sourceRe.exec(html)) !== null) {
    const typeMatch = html.slice(m.index, m.index + m[0].length).match(/type=["']([^"']+)["']/);
    add(m[1], "media", "Media", typeMatch?.[1]);
  }

  // <audio src="...">
  const audioRe = /<audio\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  while ((m = audioRe.exec(html)) !== null) add(m[1], "audio", "Audio");

  // og:video / og:audio meta tags
  const ogRe = /<meta\b[^>]*\bproperty=["']og:(video|audio)(?:_url)?["'][^>]*\bcontent=["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html)) !== null) add(m[2], m[1], `OG ${m[1] === "video" ? "Video" : "Audio"}`);

  // twitter:player (video card)
  const twitterRe = /<meta\b[^>]*\bname=["']twitter:player(?:_stream)?["'][^>]*\bcontent=["']([^"']+)["']/gi;
  while ((m = twitterRe.exec(html)) !== null) add(m[1], "video", "Twitter Video");

  return sources;
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'url-resolve', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders() });
    }

    // ?url=<remote>&action=download — server-side proxy streaming that bypasses CORS
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      if (params.get("action") !== "download") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      const remote = params.get("url");
      if (!remote) return jsonResponse({ error: "url is required" }, 400);
      let downloadResp: Response;
      try {
        downloadResp = await fetch(remote, {
          redirect: "follow",
          signal: AbortSignal.timeout(120000),
        });
      } catch (e: any) {
        return jsonResponse({ error: `Failed to download: ${e?.message || "timeout"}` }, 502);
      }
      if (!downloadResp.ok) {
        return jsonResponse({ error: `Download failed (${downloadResp.status})` }, 502);
      }
      const ct = downloadResp.headers.get("content-type") || "application/octet-stream";
      return new Response(downloadResp.body, {
        status: 200,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": ct,
        },
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let body: { url?: string };
    try { body = await req.json(); } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (!body.url) {
      return jsonResponse({ error: "url is required" }, 400);
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(body.url);
      if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error();
    } catch {
      return jsonResponse({ error: "Invalid URL. Must start with http:// or https://" }, 400);
    }

    // Fetch headers to detect content type
    let headResp: Response;
    try {
      headResp = await fetch(targetUrl.href, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
    } catch (e: any) {
      return jsonResponse({ error: `Failed to reach URL: ${e?.message || "timeout"}` }, 502);
    }

    const contentType = headResp.headers.get("content-type")?.split(";")[0]?.trim() || null;
    const contentLength = parseInt(headResp.headers.get("content-length") || "0", 10) || null;
    const ext = extFromPath(targetUrl.pathname);

    // Check if it's a direct file link
    const isDirectFile = (
      (contentType && MEDIA_TYPES.has(contentType)) ||
      (contentType && contentType.startsWith("application/octet-stream")) ||
      (contentType && contentType.startsWith("text/html") && ext && (VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext))) ||
      (ext && (VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) || ARCHIVE_EXTENSIONS.has(ext) || DOC_EXTENSIONS.has(ext)))
    );

    if (isDirectFile) {
      const filename = extractFilename(targetUrl.href, contentType);
      const ext2 = extFromPath(filename);
      return jsonResponse({
        type: "direct",
        url: targetUrl.href,
        contentType: contentType || extToMime(ext2),
        contentLength,
        filename,
        fileType: guessTypeByExt(ext2 || ext),
      });
    }

    // Fetch the page to extract video sources
    let html: string;
    try {
      const getResp = await fetch(targetUrl.href, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      const ct = getResp.headers.get("content-type") || "";
      if (!ct.includes("text/html")) {
        // Not HTML and not a recognized media type — treat as generic file
        const filename = extractFilename(targetUrl.href, ct);
        return jsonResponse({
          type: "direct",
          url: targetUrl.href,
          contentType: ct || "application/octet-stream",
          contentLength,
          filename,
          fileType: "file",
        });
      }
      html = await getResp.text();
    } catch (e: any) {
      return jsonResponse({ error: `Failed to fetch page: ${e?.message || "timeout"}` }, 502);
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || targetUrl.hostname;
    const sources = extractVideoSources(html, targetUrl.href);

    return jsonResponse({
      type: "page",
      url: targetUrl.href,
      title,
      sources,
    });
  });
});
