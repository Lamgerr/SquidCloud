import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, PrelContext } from "../_shared/kza-prel.ts";
import { readJsonLimited, isBodyTooLarge } from "../_shared/body-limit.ts";

// ============================================================
// KZA-SWK "S-HAWK" — post-investigation unit for upload/material
// rule violations.
//
// METADATA ONLY. This unit never sees file content (uploads are
// end-to-end encrypted; the server only holds ciphertext). Clients
// extract a plaintext-side metadata manifest BEFORE encryption and
// submit it here. S-Hawk investigates the manifest, files cases,
// forwards findings to kza-verdict, and recommends bans.
//
// Anti-tamper model: the server re-derives internal consistency
// (magic bytes vs sniffed mime vs extension vs declared mime).
// A forged manifest that contradicts itself is rejected outright;
// a self-consistent malicious manifest still trips filename,
// hash-intel, and denylist scanners.
//
// NOTE on minor-safety/CSAM: there is no public hash-intel feed
// for CSAM. S-Hawk flags near/exact matches against files this
// platform previously removed (hash-intel) for immediate human
// review. Authoritative CSAM hash matching (NCMEC/Thorn) is a
// future legal-track integration, not claimed here.
// ============================================================

const MANIFEST_VERSION = "swk_manifest_v1";

interface SwkManifest {
  manifest_version?: string;
  filename: string;
  size_bytes: number;
  declared_mime: string;
  extension?: string;
  magic_bytes?: string; // hex of first ≤16 bytes, client-read pre-encryption
  sniffed_mime?: string;
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  codec?: string | null;
  exif_software?: string | null;
  id3_artist?: string | null;
  id3_title?: string | null;
  sha256_plaintext?: string;
  phash?: string | null; // 16-hex-char perceptual hash, client-computed
  audio_fingerprint?: string | null; // reserved (ACRCloud-class lookup, later)
  archive_entries?: Array<{ name: string; size: number }> | null;
  doc_author?: string | null;
  doc_producer?: string | null;
  macro_enabled?: boolean | null;
}

interface Finding {
  scanner: string;
  version: string;
  signal: string;
  weight: number;
  critical: boolean;
  detail: Record<string, unknown>;
}

interface Reason {
  code: string;
  message: string;
}

// ---------- helpers ----------

function hexSha256Hex(input: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then((buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

function randomTokenHex(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalManifestHash(m: SwkManifest): Promise<string> {
  const slim = {
    v: MANIFEST_VERSION,
    n: (m.filename || "").toLowerCase(),
    s: m.size_bytes,
    mt: (m.declared_mime || "").toLowerCase(),
    e: (m.extension || "").toLowerCase(),
    mg: (m.magic_bytes || "").toLowerCase(),
    h: (m.sha256_plaintext || "").toLowerCase(),
  };
  return hexSha256Hex(JSON.stringify(slim));
}

function hammingHex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist + Math.abs(a.length - b.length) * 4;
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

// ---------- magic-byte + mime knowledge ----------

const MAGIC_MAP: Array<{ prefix: string; mime: string; label: string }> = [
  { prefix: "4d5a", mime: "application/x-msdownload", label: "Windows executable" },
  { prefix: "7f454c46", mime: "application/x-elf", label: "Linux executable" },
  { prefix: "25504446", mime: "application/pdf", label: "PDF" },
  { prefix: "504b0304", mime: "application/zip", label: "ZIP container" },
  { prefix: "89504e47", mime: "image/png", label: "PNG image" },
  { prefix: "ffd8ff", mime: "image/jpeg", label: "JPEG image" },
  { prefix: "47494638", mime: "image/gif", label: "GIF image" },
  { prefix: "494433", mime: "audio/mpeg", label: "MP3 audio" },
  { prefix: "4f676753", mime: "audio/ogg", label: "OGG audio" },
  { prefix: "52617221", mime: "application/x-rar", label: "RAR archive" },
  { prefix: "377abcaf", mime: "application/x-7z", label: "7z archive" },
  { prefix: "425a68", mime: "application/x-bzip2", label: "bzip2 archive" },
];

function magicToMime(magicHex: string): { mime: string; label: string } | null {
  const clean = (magicHex || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  if (clean.length < 4) return null;
  for (const entry of MAGIC_MAP) {
    if (clean.startsWith(entry.prefix.toLowerCase())) return { mime: entry.mime, label: entry.label };
  }
  // MP4 ftyp box at offset 4
  if (clean.length >= 24 && clean.slice(8, 16) === "66747970") {
    return { mime: "video/mp4", label: "MP4 video" };
  }
  return null;
}

function mimeCategory(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m === "application/zip" || m === "application/x-rar" || m === "application/x-7z" || m === "application/x-bzip2" || m === "application/x-tar" || m === "application/gzip") return "archive";
  if (m.includes("officedocument") || m === "application/msword" || m === "application/vnd.ms-excel" || m === "application/vnd.ms-powerpoint") return "office";
  if (m.startsWith("text/")) return "text";
  if (m === "application/x-msdownload" || m === "application/x-elf" || m === "application/x-sh" || m === "application/x-mach-binary") return "executable";
  return "other";
}

const EXECUTABLE_EXTS = new Set(["exe", "scr", "bat", "cmd", "ps1", "msi", "com", "pif", "cpl", "jar", "wsf", "vbs", "js", "dll", "sys", "elf", "sh", "run", "bin"]);

function extOf(filename: string): string {
  const base = (filename || "").split(/[/\\]/).pop() || "";
  const parts = base.split(".");
  return parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
}

const PIRACY_PATTERNS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /(2160p|1080p|720p|480p)[.\-_ ]?(web-dl|webrip|bluray|brrip|hdrip|hdtv|dvdrip|camrip|\bcam\b|\bts\b|\btc\b|dvdscr|r5)/i, label: "release-quality piracy tag", weight: 35 },
  { re: /\b(yify|yts|rarbg|etrg|eztv|galaxyrg|megusta|psa|tgx|torrentgalaxy| Eztv)\b/i, label: "known release-group tag", weight: 40 },
  { re: /x26[45](-|\b|_|\.)/i, label: "scene encoder tag", weight: 20 },
  { re: /discography|complete\.series|s\d{2}e\d{2}|season[.\-_ ]?\d+/i, label: "bulk-rip naming", weight: 25 },
];

// ---------- scanners (pure: manifest + denylist -> findings) ----------

type DenyEntry = { kind: string; value: string };

function scanMimeIntegrity(m: SwkManifest, ext: string): Finding[] {
  const out: Finding[] = [];
  const declaredCat = mimeCategory(m.declared_mime);
  const magic = magicToMime(m.magic_bytes || "");

  if (magic) {
    const magicCat = mimeCategory(magic.mime);
    if (magicCat === "executable") {
      const honestExt = EXECUTABLE_EXTS.has(ext);
      const honestDecl = declaredCat === "executable" || m.declared_mime.toLowerCase() === "application/octet-stream";
      if (honestExt && honestDecl) {
        out.push({ scanner: "mime-integrity", version: "v1", signal: "EXECUTABLE_HONEST", weight: 25, critical: false, detail: { magic: magic.label } });
      } else {
        out.push({ scanner: "mime-integrity", version: "v1", signal: "EXECUTABLE_MASQUERADE", weight: 80, critical: true, detail: { magic: magic.label, extension: ext, declared: m.declared_mime } });
      }
    } else if (magicCat === "archive" && (declaredCat === "office" || declaredCat === "archive")) {
      // Office docs are ZIP containers — consistent.
    } else if (magicCat !== declaredCat && declaredCat !== "other") {
      out.push({ scanner: "mime-integrity", version: "v1", signal: "MIME_MISMATCH", weight: 45, critical: false, detail: { magic: magic.label, declared: m.declared_mime } });
    }
    if (m.sniffed_mime && mimeCategory(m.sniffed_mime) !== magicCat && mimeCategory(m.sniffed_mime) !== "other") {
      out.push({ scanner: "mime-integrity", version: "v1", signal: "MANIFEST_FORGERY", weight: 95, critical: true, detail: { sniffed: m.sniffed_mime, magic: magic.label } });
    }
  }

  const extCat = mimeCategory(`x/${ext}`);
  void extCat;
  const pdfish = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "mp4", "mp3"];
  if (pdfish.includes(ext) && declaredCat !== "other") {
    const expected: Record<string, string> = { pdf: "pdf", doc: "office", docx: "office", xls: "office", xlsx: "office", ppt: "office", pptx: "office", jpg: "image", jpeg: "image", png: "image", gif: "image", mp4: "video", mp3: "audio" };
    if (expected[ext] && expected[ext] !== declaredCat) {
      out.push({ scanner: "mime-integrity", version: "v1", signal: "EXT_DECLARED_MISMATCH", weight: 30, critical: false, detail: { extension: ext, declared: m.declared_mime } });
    }
  }
  return out;
}

function scanFilenameIntel(m: SwkManifest, deny: DenyEntry[]): Finding[] {
  const out: Finding[] = [];
  const name = m.filename || "";
  for (const entry of deny) {
    if (entry.kind !== "filename_pattern") continue;
    try {
      if (new RegExp(entry.value, "i").test(name)) {
        out.push({ scanner: "filename-intel", version: "v1", signal: "DENYLIST_FILENAME_PATTERN", weight: 70, critical: false, detail: { pattern: entry.value } });
      }
    } catch { /* ignore bad admin regex */ }
  }
  for (const entry of deny) {
    if (entry.kind !== "keyword") continue;
    if (entry.value && name.toLowerCase().includes(entry.value.toLowerCase())) {
      out.push({ scanner: "filename-intel", version: "v1", signal: "DENYLIST_KEYWORD", weight: 60, critical: false, detail: { keyword: entry.value } });
    }
  }
  for (const p of PIRACY_PATTERNS) {
    if (p.re.test(name)) {
      out.push({ scanner: "filename-intel", version: "v1", signal: "PIRACY_RELEASE_PATTERN", weight: p.weight, critical: false, detail: { pattern: p.label } });
    }
  }
  return out;
}

function scanArchiveIntel(m: SwkManifest): Finding[] {
  const out: Finding[] = [];
  const entries = m.archive_entries || [];
  if (!entries.length) return out;
  let total = 0;
  for (const e of entries) {
    const n = e.name || "";
    total += Math.max(0, e.size || 0);
    if (n.includes("..") || n.startsWith("/") || n.startsWith("\\") || /^[a-zA-Z]:/.test(n)) {
      out.push({ scanner: "archive-intel", version: "v1", signal: "ARCHIVE_TRAVERSAL", weight: 95, critical: true, detail: { entry: n.slice(0, 120) } });
    }
    if (/\.(exe|scr|bat|cmd|ps1|msi|com|pif|cpl|vbs|jar)$/i.test(n)) {
      out.push({ scanner: "archive-intel", version: "v1", signal: "ARCHIVE_CONTAINS_EXECUTABLE", weight: 50, critical: false, detail: { entry: n.slice(0, 120) } });
      break;
    }
  }
  if (entries.length > 10000) {
    out.push({ scanner: "archive-intel", version: "v1", signal: "ARCHIVE_ENTRY_FLOOD", weight: 20, critical: false, detail: { entries: entries.length } });
  }
  if (m.size_bytes > 50 * 1024 * 1024 && total > m.size_bytes * 200) {
    out.push({ scanner: "archive-intel", version: "v1", signal: "ARCHIVE_BOMB_HEURISTIC", weight: 55, critical: false, detail: { ratio: Math.round(total / Math.max(1, m.size_bytes)) } });
  }
  return out;
}

function scanDocIntel(m: SwkManifest, deny: DenyEntry[]): Finding[] {
  const out: Finding[] = [];
  const hay = `${m.doc_author || ""} ${m.doc_producer || ""}`.toLowerCase();
  for (const entry of deny) {
    if (entry.kind !== "mime_tool" && entry.kind !== "keyword") continue;
    if (entry.value && hay.includes(entry.value.toLowerCase())) {
      out.push({ scanner: "doc-intel", version: "v1", signal: "DENYLIST_DOC_TOOL", weight: 60, critical: false, detail: { tool: entry.value } });
    }
  }
  if (m.macro_enabled === true) {
    const macroFree = /^(docx|xlsx|pptx)$/i.test(extOf(m.filename));
    out.push({ scanner: "doc-intel", version: "v1", signal: macroFree ? "MACRO_IN_MACRO_FREE_FORMAT" : "MACRO_DOCUMENT", weight: macroFree ? 50 : 30, critical: false, detail: { producer: m.doc_producer || null } });
  }
  return out;
}

function scanMediaIntel(m: SwkManifest, deny: DenyEntry[]): Finding[] {
  const out: Finding[] = [];
  const cat = mimeCategory(m.declared_mime);
  if (cat === "image" && m.width != null && m.height != null) {
    if ((m.width === 0 || m.height === 0) || m.width * m.height > 200000000) {
      out.push({ scanner: "media-intel", version: "v1", signal: "ABSURD_DIMENSIONS", weight: 40, critical: false, detail: { width: m.width, height: m.height } });
    }
  }
  if ((cat === "video" || cat === "audio") && m.duration_sec != null) {
    if (m.duration_sec <= 0 || m.duration_sec > 43200) {
      out.push({ scanner: "media-intel", version: "v1", signal: "ABSURD_DURATION", weight: 25, critical: false, detail: { duration_sec: m.duration_sec } });
    }
  }
  if (m.exif_software) {
    for (const entry of deny) {
      if (entry.kind !== "mime_tool") continue;
      if (entry.value && m.exif_software.toLowerCase().includes(entry.value.toLowerCase())) {
        out.push({ scanner: "media-intel", version: "v1", signal: "DENYLIST_EXIF_SOFTWARE", weight: 60, critical: false, detail: { software: m.exif_software } });
      }
    }
  }
  return out;
}

async function scanHashIntel(supabase: any, m: SwkManifest, deny: DenyEntry[]): Promise<Finding[]> {
  const out: Finding[] = [];
  const sha = (m.sha256_plaintext || "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(sha)) {
    if (deny.some((d) => d.kind === "sha256" && d.value.toLowerCase() === sha)) {
      out.push({ scanner: "hash-intel", version: "v1", signal: "DENYLIST_HASH", weight: 100, critical: true, minor_safety_possible: true } as Finding);
      (out[out.length - 1].detail as Record<string, unknown>).sha256 = sha.slice(0, 16) + "…";
    }
  }
  const ph = (m.phash || "").toLowerCase();
  if (/^[0-9a-f]{16}$/.test(ph)) {
    const { data } = await supabase.from("kza_swk_denylist").select("value").eq("kind", "phash").eq("is_active", true).limit(500);
    let best = Infinity;
    for (const row of data || []) {
      const v = String(row.value || "").toLowerCase();
      if (!/^[0-9a-f]{16}$/.test(v)) continue;
      const d = hammingHex(ph, v);
      if (d < best) best = d;
    }
    if (best <= 8) {
      out.push({ scanner: "hash-intel", version: "v1", signal: "PHASH_NEAR_MATCH", weight: 85, critical: false, minor_safety_possible: true } as Finding);
      (out[out.length - 1].detail as Record<string, unknown>).hamming = best;
    }
  }
  return out;
}

function scanAudioIntel(m: SwkManifest): Finding[] {
  const out: Finding[] = [];
  if (mimeCategory(m.declared_mime) === "audio" && (m.id3_artist || m.id3_title)) {
    if (PIRACY_PATTERNS.some((p) => p.re.test(m.filename || ""))) {
      out.push({ scanner: "audio-intel", version: "v1", signal: "CORROBORATED_PIRACY_METADATA", weight: 15, critical: false, detail: { artist: m.id3_artist || null } });
    }
  }
  return out;
}

// ---------- reason copy (what the user is told) ----------

const REASONS: Record<string, string> = {
  MANIFEST_FORGERY: "Upload blocked: the file's metadata contradicts itself (forensic mismatch between its header and declared type). If this is legitimate, re-export it and retry.",
  EXECUTABLE_MASQUERADE: "Upload blocked: this file is actually an executable program disguised as a different file type.",
  MIME_MISMATCH: "Upload blocked: the file's real format does not match what it claims to be.",
  EXT_DECLARED_MISMATCH: "Upload blocked: the file extension does not match the declared file type.",
  DOUBLE_EXTENSION: "Upload blocked: double-extension executables (e.g. document.pdf.exe) are not allowed.",
  DENYLIST_FILENAME_PATTERN: "Upload blocked: this filename matches a blocked pattern.",
  DENYLIST_KEYWORD: "Upload blocked: this filename contains a blocked term.",
  PIRACY_RELEASE_PATTERN: "Upload blocked: this filename matches naming used by pirated releases.",
  ARCHIVE_TRAVERSAL: "Upload blocked: this archive contains path-traversal entries and is unsafe to extract.",
  ARCHIVE_CONTAINS_EXECUTABLE: "Upload blocked: this archive hides an executable program.",
  ARCHIVE_BOMB_HEURISTIC: "Upload blocked: this archive shows decompression-bomb characteristics.",
  ARCHIVE_ENTRY_FLOOD: "Upload blocked: this archive contains an absurd number of entries.",
  DENYLIST_DOC_TOOL: "Upload blocked: this document was produced by a blocked tool.",
  MACRO_DOCUMENT: "Upload blocked: macro-enabled documents are not allowed.",
  MACRO_IN_MACRO_FREE_FORMAT: "Upload blocked: macros inside a macro-free document format.",
  ABSURD_DIMENSIONS: "Upload blocked: this image reports impossible dimensions.",
  ABSURD_DURATION: "Upload blocked: this media file reports an impossible duration.",
  DENYLIST_EXIF_SOFTWARE: "Upload blocked: this image was produced by blocked software.",
  DENYLIST_HASH: "Upload blocked: this exact file was previously removed for policy violations.",
  PHASH_NEAR_MATCH: "Upload blocked: this file is near-identical to content previously removed for policy violations.",
  CORROBORATED_PIRACY_METADATA: "Upload blocked: audio metadata corroborates a pirated release.",
  EXECUTABLE_HONEST: "Executable programs require manual review.",
  SCORE_REJECT: "Upload blocked by S-Hawk safety screening.",
};

function reasonsFor(findings: Finding[], score: number): Reason[] {
  const top = [...findings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const reasons = top.map((f) => ({ code: f.signal, message: REASONS[f.signal] || REASONS.SCORE_REJECT }));
  if (!reasons.length) reasons.push({ code: "SCORE_REJECT", message: `${REASONS.SCORE_REJECT} (score ${score}).` });
  return reasons;
}

// ---------- pipeline ----------

async function runPipeline(supabase: any, m: SwkManifest): Promise<{ findings: Finding[]; score: number; critical: boolean }> {
  const { data: denyRows } = await supabase.from("kza_swk_denylist").select("kind,value").eq("is_active", true).limit(2000);
  const deny: DenyEntry[] = (denyRows || []).map((r: any) => ({ kind: String(r.kind), value: String(r.value) }));
  const ext = extOf(m.filename);

  const findings: Finding[] = [
    ...scanMimeIntegrity(m, ext),
    ...scanFilenameIntel(m, deny),
    ...scanArchiveIntel(m),
    ...scanDocIntel(m, deny),
    ...scanMediaIntel(m, deny),
    ...(await scanHashIntel(supabase, m, deny)),
    ...scanAudioIntel(m),
  ];
  const score = Math.min(100, findings.reduce((s, f) => s + f.weight, 0));
  const critical = findings.some((f) => f.critical);
  return { findings, score, critical };
}

// ---------- server ----------

serve(async (req) => {
  return withPrelGateway(req, { functionId: "kza-swk", operation: "default" }, async (ctx: PrelContext) => {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "S-Hawk misconfigured" }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let body: Record<string, unknown>;
    try {
      body = await readJsonLimited(req, 512 * 1024);
    } catch (parseErr) {
      if (isBodyTooLarge(parseErr)) return jsonResponse({ error: "Request body too large" }, 413);
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const action = String(body.action || "scan");

    // ----- user notices feed -----
    if (action === "notices") {
      if (!ctx.userId || ctx.userId === "anonymous") return jsonResponse({ error: "Authentication required" }, 401);
      const { data } = await supabase.from("kza_swk_notices").select("id,title,body,reason_codes,is_read,created_at,case_id").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(50);
      if (body.mark_read === true) {
        await supabase.from("kza_swk_notices").update({ is_read: true }).eq("user_id", ctx.userId).eq("is_read", false);
      }
      return jsonResponse({ success: true, notices: data || [] });
    }

    // ----- appeal a case -----
    if (action === "appeal") {
      if (!ctx.userId || ctx.userId === "anonymous") return jsonResponse({ error: "Authentication required" }, 401);
      const caseId = String(body.case_id || "");
      if (!caseId) return jsonResponse({ error: "case_id is required" }, 400);
      const { data: kase } = await supabase.from("kza_swk_cases").select("id,user_id,status").eq("id", caseId).maybeSingle();
      if (!kase || kase.user_id !== ctx.userId) return jsonResponse({ error: "Case not found" }, 404);
      await supabase.from("kza_swk_cases").update({ status: "appealed", updated_at: new Date().toISOString() }).eq("id", caseId);
      await supabase.from("kza_swk_notices").insert({
        user_id: ctx.userId, case_id: caseId,
        title: "Appeal received",
        body: "Your appeal is queued for human review. Your upload stays blocked until a reviewer decides. No further action is needed from you.",
        reason_codes: ["APPEAL_RECEIVED"],
      });
      return jsonResponse({ success: true });
    }

    // ----- scan / rescore -----
    if (action !== "scan" && action !== "rescore") {
      return jsonResponse({ error: "Unknown action. Use scan, rescore, notices, or appeal." }, 400);
    }
    const mintToken = action === "scan";

    // Server-to-server rescore (share/publish path) may name the subject user;
    // self-service callers can only ever scan as themselves.
    let subjectUserId = ctx.userId;
    if (typeof body.user_id === "string" && body.user_id) {
      if (ctx.userId && ctx.userId !== "anonymous") {
        if (body.user_id !== ctx.userId) return jsonResponse({ error: "user_id mismatch", code: "SWK_FORBIDDEN" }, 403);
      }
      subjectUserId = body.user_id;
    }
    if (!subjectUserId || subjectUserId === "anonymous") {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const raw = body.manifest as Partial<SwkManifest> | undefined;
    if (!raw || typeof raw.filename !== "string" || !raw.filename.trim() || typeof raw.size_bytes !== "number" || typeof raw.declared_mime !== "string" || !raw.declared_mime) {
      return jsonResponse({ error: "Invalid manifest: filename, size_bytes and declared_mime are required" }, 400);
    }
    if (raw.size_bytes < 0) return jsonResponse({ error: "Invalid manifest: size_bytes" }, 400);
    const manifest = raw as SwkManifest;
    const manifestHash = await canonicalManifestHash(manifest);

    const { data: policy } = await supabase.from("kza_swk_policy").select("*").eq("id", 1).maybeSingle();
    const rejectAt = policy?.reject_at ?? 70;
    const reviewAt = policy?.review_at ?? 40;
    const warnDays = policy?.warn_repeat_within_days ?? 30;
    const escalateN = policy?.escalate_repeat_count ?? 3;
    const suspMid = policy?.susp_70_89_days ?? 7;
    const suspHigh = policy?.susp_90_plus_days ?? 30;

    const { findings, score, critical } = await runPipeline(supabase, manifest);

    let decision: "allow" | "review" | "reject" = "allow";
    if (critical || score >= rejectAt) decision = "reject";
    else if (score >= reviewAt) decision = "review";

    // Repeat-offender history (rejected cases in window, excluding nothing yet)
    let repeatCount = 1;
    if (decision !== "allow") {
      const since = new Date(Date.now() - warnDays * 86400000).toISOString();
      const { count } = await supabase.from("kza_swk_cases").select("id", { count: "exact", head: true }).eq("user_id", subjectUserId).eq("decision", "reject").gte("created_at", since);
      repeatCount = (count || 0) + 1;
    }

    // Persist case for review + reject
    let caseId: string | null = null;
    if (decision !== "allow") {
      const { data: kase, error: caseErr } = await supabase.from("kza_swk_cases").insert({
        user_id: subjectUserId, manifest_hash: manifestHash,
        filename: manifest.filename.slice(0, 255), size_bytes: Math.floor(manifest.size_bytes),
        decision, risk_score: score, repeat_count: repeatCount, status: "open",
      }).select("id").single();
      if (caseErr) {
        console.error("[swk] case insert failed:", caseErr.message);
        return jsonResponse({ error: "S-Hawk case filing failed" }, 500);
      }
      caseId = kase.id;
      if (findings.length) {
        await supabase.from("kza_swk_findings").insert(findings.map((f) => ({
          case_id: caseId, scanner: f.scanner, scanner_version: f.version,
          signal: f.signal, weight: f.weight, critical: f.critical, details: f.detail,
        })));
      }
    }

    // Escalation: habitual violators are treated one tier harsher
    const escalated = decision === "reject" && repeatCount >= escalateN && score >= rejectAt;
    const blackTier = decision === "reject" && (critical || score >= 90 || escalated);

    // Forward + enforce on reject
    let threatEventId: string | null = null;
    if (decision === "reject" && caseId) {
      const tier = blackTier ? "BLACK" : "RED";
      const suspDays = blackTier ? suspHigh : suspMid;
      const topSignals = [...findings].sort((a, b) => b.weight - a.weight).slice(0, 3).map((f) => f.signal);

      const { data: threat } = await supabase.from("kza_threat_events").insert({
        user_id: subjectUserId,
        ip_address: clientIp(req),
        threat_tier: tier,
        threat_type: "S_HAWK_CONTENT",
        description: `S-Hawk rejected "${manifest.filename.slice(0, 120)}" (score ${score}${escalated ? `, ${repeatCount}th repeat` : ""})`,
        payload_snapshot: { case_id: caseId, risk_score: score, signals: topSignals, repeat_count: repeatCount, manifest_hash: manifestHash },
        endpoint_hit: "KZA_SWK",
        method: "POST",
        automated_action_taken: blackTier ? `UPLOAD_SUSPENDED_${suspHigh}D` : `UPLOAD_SUSPENDED_${suspMid}D`,
      }).select("id").single();
      threatEventId = threat?.id || null;

      await supabase.from("kza_banned_entities").insert({
        user_id: subjectUserId,
        ip_address: clientIp(req),
        ban_type: "TEMP",
        ban_reason: `S-Hawk upload suspension: ${topSignals.join(", ") || "policy violation"} (score ${score})`,
        ban_tier: tier,
        attack_summary: `S-Hawk case ${caseId}: ${topSignals.join(", ")}`,
        banned_until: new Date(Date.now() + suspDays * 86400000).toISOString(),
        banned_by: "S_HAWK",
        ban_source: "S_HAWK",
        is_active: true,
        shadow: false,
      });

      await supabase.from("kza_swk_cases").update({ status: "forwarded", threat_event_id: threatEventId, updated_at: new Date().toISOString() }).eq("id", caseId);

      // Hand to kza-verdict for adjudication (fire-and-forget; verdict owns the incident card + admin ping)
      if (threatEventId) {
        fetch(`${SUPABASE_URL}/functions/v1/kza-verdict`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ threat_event_id: threatEventId, threat_tier: tier }),
        }).catch(() => null);
      }
    }

    // Tell the user exactly why (rejections only)
    const reasons = decision === "reject" ? reasonsFor(findings, score) : [];
    if (decision === "reject" && caseId) {
      await supabase.from("kza_swk_notices").insert({
        user_id: subjectUserId, case_id: caseId,
        title: blackTier ? "Upload blocked and account suspended" : "Upload blocked by S-Hawk",
        body: `${reasons.map((r) => r.message).join(" ")}\n\nCase ${caseId.slice(0, 8)} · risk score ${score}/100${repeatCount > 1 ? ` · violation #${repeatCount} in ${warnDays} days` : ""}${blackTier || decision === "reject" ? " Uploads are suspended; the suspension and this decision are under KZA review." : ""} You can appeal from Settings → Security.`,
        reason_codes: reasons.map((r) => r.code),
      });
    }

    // Verdict token for allow/review (binds upload minting to this exact manifest)
    let token: string | null = null;
    let expiresAt: string | null = null;
    if (mintToken && decision !== "reject") {
      const ttl = policy?.token_ttl_seconds ?? 900;
      const maxUses = policy?.token_max_uses ?? 5;
      token = randomTokenHex(32);
      expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      await supabase.from("kza_swk_verdict_tokens").insert({
        token_hash: await hexSha256Hex(token),
        user_id: subjectUserId, manifest_hash: manifestHash,
        size_bytes: Math.floor(manifest.size_bytes), decision,
        expires_at: expiresAt, max_uses: maxUses, used_count: 0,
      });
    }

    return jsonResponse({
      success: true, decision, risk_score: score, case_id: caseId,
      reasons, token, expires_at: expiresAt, manifest_hash: manifestHash,
    });
  });
});
