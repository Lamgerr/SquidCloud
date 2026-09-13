import { supabase } from '@/integrations/supabase/client';

// ============================================================
// S-Hawk client sentinel — metadata-only upload screening.
// The manifest is extracted from the PLAINTEXT file BEFORE
// res54 encryption and submitted to kza-swk/scan. The server
// never sees file content (ciphertext only), only this manifest.
//
// Rejected uploads throw SwkRejection carrying the exact reasons
// so the UI can tell the user WHY the file was refused.
// ============================================================

export const SWK_MANIFEST_VERSION = 'swk_manifest_v1';

export interface SwkArchiveEntry {
  name: string;
  size: number;
}

export interface SwkManifest {
  manifest_version: string;
  filename: string;
  size_bytes: number;
  declared_mime: string;
  extension: string;
  magic_bytes: string | null;
  sniffed_mime: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  codec: string | null;
  exif_software: string | null;
  id3_artist: string | null;
  id3_title: string | null;
  sha256_plaintext: string | null;
  phash: string | null;
  audio_fingerprint: string | null;
  archive_entries: SwkArchiveEntry[] | null;
  doc_author: string | null;
  doc_producer: string | null;
  macro_enabled: boolean | null;
}

export interface SwkReason {
  code: string;
  message: string;
}

export interface SwkVerdict {
  decision: 'allow' | 'review' | 'reject';
  risk_score: number;
  case_id: string | null;
  reasons: SwkReason[];
  token: string | null;
  manifestHash: string;
  manifest: SwkManifest;
}

export class SwkRejection extends Error {
  reasons: SwkReason[];
  caseId: string | null;
  riskScore: number;
  constructor(reasons: SwkReason[], caseId: string | null, riskScore: number) {
    super(`S-Hawk: ${reasons.map((r) => r.message).join(' ') || 'upload blocked by safety screening'}`);
    this.name = 'SwkRejection';
    this.reasons = reasons;
    this.caseId = caseId;
    this.riskScore = riskScore;
  }
}

function extOf(name: string): string {
  const base = name.split(/[/\\]/).pop() || '';
  const parts = base.split('.');
  return parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
}

async function sha256HexBytes(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readMagic(file: File): Promise<string | null> {
  try {
    const buf = await file.slice(0, 16).arrayBuffer();
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

// Full-file sha256 up to 256 MiB. Larger files omit the plaintext hash
// (hash-intel exact-match then only covers smaller files; every other
// scanner still runs). Hashing gigabytes in-browser would OOM the tab.
async function readPlaintextSha256(file: File): Promise<string | null> {
  try {
    if (file.size > 256 * 1024 * 1024) return null;
    const buf = await file.arrayBuffer();
    return await sha256HexBytes(buf);
  } catch {
    return null;
  }
}

function probeImageDims(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const done = (v: { w: number; h: number } | null) => {
        URL.revokeObjectURL(url);
        resolve(v);
      };
      const timer = window.setTimeout(() => done(null), 8000);
      img.onload = () => {
        window.clearTimeout(timer);
        done({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        done(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function probeMediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.muted = true;
      const done = (v: number | null) => {
        URL.revokeObjectURL(url);
        resolve(v);
      };
      const timer = window.setTimeout(() => done(null), 8000);
      el.onloadedmetadata = () => {
        window.clearTimeout(timer);
        done(Number.isFinite(el.duration) ? el.duration : null);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        done(null);
      };
      el.src = url;
    } catch {
      resolve(null);
    }
  });
}

async function readZipEntries(file: File): Promise<SwkArchiveEntry[] | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const entries: SwkArchiveEntry[] = [];
    let count = 0;
    zip.forEach((relativePath, entry) => {
      if (count >= 2000 || relativePath.length > 512) return;
      count++;
      entries.push({
        name: relativePath.slice(0, 255),
        size: typeof (entry as any)._data?.uncompressedSize === 'number' ? (entry as any)._data.uncompressedSize : 0,
      });
    });
    return entries;
  } catch {
    return null;
  }
}

export async function buildSwkManifest(file: File): Promise<SwkManifest> {
  const declared = file.type || 'application/octet-stream';
  const extension = extOf(file.name);
  const [magic, sha] = await Promise.all([readMagic(file), readPlaintextSha256(file)]);

  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;
  if (declared.startsWith('image/')) {
    const dims = await probeImageDims(file);
    if (dims) {
      width = dims.w;
      height = dims.h;
    }
  } else if (declared.startsWith('video/') || declared.startsWith('audio/')) {
    duration = await probeMediaDuration(file);
  }

  let archive: SwkArchiveEntry[] | null = null;
  if (extension === 'zip') {
    archive = await readZipEntries(file);
  }

  const macroExt = /^(docm|xlsm|pptm)$/i.test(extension);

  return {
    manifest_version: SWK_MANIFEST_VERSION,
    filename: file.name.slice(0, 255),
    size_bytes: file.size,
    declared_mime: declared,
    extension,
    magic_bytes: magic,
    sniffed_mime: null,
    width,
    height,
    duration_sec: duration,
    codec: null,
    exif_software: null,
    id3_artist: null,
    id3_title: null,
    sha256_plaintext: sha,
    phash: null,
    audio_fingerprint: null,
    archive_entries: archive,
    doc_author: null,
    doc_producer: null,
    macro_enabled: macroExt ? true : null,
  };
}

export function swkManifestHashInput(m: SwkManifest): string {
  // Must stay in sync with kza-swk canonicalManifestHash.
  return JSON.stringify({
    v: SWK_MANIFEST_VERSION,
    n: (m.filename || '').toLowerCase(),
    s: m.size_bytes,
    mt: (m.declared_mime || '').toLowerCase(),
    e: (m.extension || '').toLowerCase(),
    mg: (m.magic_bytes || '').toLowerCase(),
    h: (m.sha256_plaintext || '').toLowerCase(),
  });
}

export async function swkScanManifest(manifest: SwkManifest): Promise<SwkVerdict> {
  const { data, error } = await supabase.functions.invoke('kza-swk', {
    body: { action: 'scan', manifest },
  });
  if (error) {
    throw new Error(`S-Hawk screening unavailable: ${error.message || 'network error'}. Try again shortly.`);
  }
  if (!data?.success) {
    throw new Error(`S-Hawk screening failed: ${data?.error || 'unknown error'}. Try again shortly.`);
  }
  const manifestHash = await sha256HexBytes(new TextEncoder().encode(swkManifestHashInput(manifest)).buffer as ArrayBuffer);
  const verdict: SwkVerdict = {
    decision: data.decision,
    risk_score: data.risk_score ?? 0,
    case_id: data.case_id || null,
    reasons: Array.isArray(data.reasons) ? data.reasons : [],
    token: data.token || null,
    manifestHash,
    manifest,
  };
  if (verdict.decision === 'reject' || !verdict.token) {
    throw new SwkRejection(verdict.reasons, verdict.case_id, verdict.risk_score);
  }
  return verdict;
}

export interface SwkNotice {
  id: string;
  title: string;
  body: string;
  reason_codes: string[];
  is_read: boolean;
  created_at: string;
  case_id: string | null;
}

export async function swkFetchNotices(markRead = false): Promise<SwkNotice[]> {
  const { data, error } = await supabase.functions.invoke('kza-swk', {
    body: { action: 'notices', mark_read: markRead },
  });
  if (error || !data?.success) return [];
  return (data.notices || []) as SwkNotice[];
}

export async function swkAppealCase(caseId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('kza-swk', {
    body: { action: 'appeal', case_id: caseId },
  });
  return !error && !!data?.success;
}
