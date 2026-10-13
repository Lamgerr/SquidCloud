import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSignal } from "../_shared/signals.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const BUCKET = 'migration-zips';

/* ── Canonical res54 v2 encryption (byte-identical to the dashboard
   uploader, the CLI transfer path, and POST /upload/encrypted) ──────
   Key: UTF-8 bytes of key.slice(0,32).padEnd(32,'0') → AES-256-GCM.
   Framing per logical chunk: [u32le headerLen]
   [JSON {version:2,chunks,totalSize,ivs:number[][]}]
   then per 64KB part: [u32le aadLen][aad][u32le encLen][ct‖tag],
   AAD = `chunk-{i}-{N}-{timestamp}`, random 12B IV per part. */
const V2_SUB_CHUNK = 64 * 1024;

function generateRes54Key(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join('');
}

function res54ChunkSize(totalSize: number): number {
  if (totalSize > 50 * 1024 * 1024) return 2 * 1024 * 1024;
  if (totalSize > 10 * 1024 * 1024) return 1024 * 1024;
  return 512 * 1024;
}

async function encryptChunkCanonical(plaintext: Uint8Array, keyStr: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(keyStr.slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const numParts = Math.max(1, Math.ceil(plaintext.length / V2_SUB_CHUNK));
  const ivs: Uint8Array[] = [];
  const parts: { aad: Uint8Array; encrypted: Uint8Array }[] = [];
  const timestamp = Date.now();
  for (let i = 0; i < numParts; i++) {
    const sub = plaintext.subarray(i * V2_SUB_CHUNK, Math.min((i + 1) * V2_SUB_CHUNK, plaintext.length));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = enc.encode(`chunk-${i}-${numParts}-${timestamp}`);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, sub);
    ivs.push(iv);
    parts.push({ aad, encrypted: new Uint8Array(ct) });
  }
  const headerBytes = enc.encode(JSON.stringify({
    version: 2, chunks: numParts, totalSize: plaintext.length,
    ivs: ivs.map(iv => Array.from(iv)),
  }));
  let total = 4 + headerBytes.length;
  for (const p of parts) total += 4 + p.aad.length + 4 + p.encrypted.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, headerBytes.length, true);
  out.set(headerBytes, 4);
  let off = 4 + headerBytes.length;
  for (const p of parts) {
    dv.setUint32(off, p.aad.length, true); off += 4;
    out.set(p.aad, off); off += p.aad.length;
    dv.setUint32(off, p.encrypted.length, true); off += 4;
    out.set(p.encrypted, off); off += p.encrypted.length;
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const internalKey = req.headers.get("X-Internal-Key") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (internalKey) {
    const { data: config } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "INTERNAL_WEBHOOK_KEY")
      .single();
    if (config?.value !== internalKey) {
      return new Response(JSON.stringify({ error: "Invalid internal key" }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  } else if (jwt !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  let job: any = null;

  try {
    const { data: jobs } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('source_platform', 'zip-upload')
      .eq('status', 'scheduled')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: false, message: 'No scheduled jobs' }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    job = jobs[0];
    const storagePath = job.settings?.storagePath;

    if (!storagePath) {
      await markFailed(supabase, job.id, 'No storage path in settings');
      return json(200, { processed: false, error: 'No storage path' });
    }

    await supabase.from('migration_jobs').update({ status: 'extracting' }).eq('id', job.id);
    await addLog(supabase, job.id, job.user_id, 'info', `Starting ZIP extraction: ${job.settings?.originalName || storagePath}`);

    const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET).download(storagePath);
    if (downloadError || !fileData) {
      throw new Error(`Failed to download ZIP: ${downloadError?.message || 'No data'}`);
    }

    const buffer = await fileData.arrayBuffer();
    const entries = await extractZipFiles(new Uint8Array(buffer));

    if (entries.length === 0) {
      throw new Error('ZIP file is empty or corrupted');
    }

    await supabase.from('migration_jobs').update({
      status: 'uploading',
      total_files: entries.length,
    }).eq('id', job.id);

    // All extracted files belong to the user's default workspace so they
    // appear in the dashboard instead of limbo.
    let workspaceId: string | null = null;
    try {
      const { data: wsId } = await supabase.rpc('get_or_create_default_workspace', { p_user_id: job.user_id });
      if (typeof wsId === 'string' && wsId) workspaceId = wsId;
    } catch { /* non-fatal: files still land, workspace-scoped views may hide them */ }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];
    let processedSize = 0;

    for (let entryIdx = 0; entryIdx < entries.length; entryIdx++) {
      const entry = entries[entryIdx];
      try {
        // Canonical res54: encrypt every entry with AES-256-GCM exactly like
        // dashboard / CLI uploads, then store encrypted chunk objects plus
        // full chunk-location metadata so the file reads everywhere.
        const fileId = crypto.randomUUID();
        const encryptionKey = generateRes54Key();
        const chunkSize = res54ChunkSize(entry.size);
        const totalChunks = Math.max(1, Math.ceil(entry.size / chunkSize));
        const chunkMetas: any[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const slice = entry.content.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, entry.content.length));
          const encrypted = await encryptChunkCanonical(slice, encryptionKey);
          const chunkPath = `${job.user_id}/migration/${job.id}/res54/${entryIdx}/${i}.bin`;
          const { error: chunkError } = await supabase.storage.from('files').upload(chunkPath, encrypted, {
            contentType: 'application/octet-stream',
            upsert: true,
          });
          if (chunkError) throw new Error(`Chunk upload failed: ${chunkError.message}`);
          chunkMetas.push({
            index: i, totalChunks, size: slice.length, offset: i * chunkSize, sha256: '',
            repo: 'supabase', path: chunkPath,
          });
        }
        const metadata = {
          fileId, chunkSize, chunks: chunkMetas, encryptionKey,
          created: new Date().toISOString(), previewAvailable: false,
        };

        const { error: recordError } = await supabase.from('files').insert({
          id: fileId,
          name: entry.name,
          type: entry.mimeType,
          size: entry.size,
          storage_path: 'res54_distributed',
          user_id: job.user_id,
          encrypted: true,
          encryption_key: '',
          tags: [JSON.stringify(metadata)],
          processor: 'res54',
          parent_folder: entry.parentFolder,
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
        });
        if (recordError) throw new Error(`Record insert failed: ${recordError.message}`);

        processed++;
        processedSize += entry.size;
        await supabase.from('migration_jobs').update({
          processed_files: processed,
          failed_files: failed,
          settings: { ...job.settings, processedSize },
        }).eq('id', job.id);

      } catch (err: any) {
        failed++;
        errors.push(`${entry.path}: ${err.message}`);
        await addLog(supabase, job.id, job.user_id, 'error', `Failed to upload ${entry.path}: ${err.message}`);
      }
    }

    await supabase.storage.from(BUCKET).remove([storagePath]);

    // Create folder rows for every directory in the archive. Without these,
    // extracted files carry parent_folder paths that don't exist as rows,
    // leaving the whole tree orphaned and invisible in the dashboard.
    try {
      const dirSet = new Set<string>();
      for (const entry of entries) {
        const parts = String(entry.parentFolder || '').split('/').filter(Boolean);
        for (let i = 1; i <= parts.length; i++) dirSet.add(parts.slice(0, i).join('/'));
      }
      if (dirSet.size > 0) {
        const { data: existing } = await supabase
          .from('folders')
          .select('path')
          .eq('user_id', job.user_id);
        const have = new Set((existing || []).map((f: any) => f.path));
        const missing = [...dirSet].filter(p => !have.has(p));
        for (const dirPath of missing) {
          const segs = dirPath.split('/');
          const parent = segs.length > 1 ? segs.slice(0, -1).join('/') : null;
          await supabase.from('folders').insert({
            user_id: job.user_id,
            name: segs[segs.length - 1],
            path: dirPath,
            parent_folder: parent,
            ...(workspaceId ? { workspace_id: workspaceId } : {}),
          });
        }
        if (missing.length > 0) {
          await addLog(supabase, job.id, job.user_id, 'info', `Created ${missing.length} folders for extracted tree`);
        }
      }
    } catch (folderErr: any) {
      await addLog(supabase, job.id, job.user_id, 'error', `Folder creation failed (files are intact): ${folderErr?.message || folderErr}`);
    }

    const jobFinalStatus = failed === 0 ? 'completed' : failed === entries.length ? 'failed' : 'completed';
    const msg = `Migration ${jobFinalStatus}: ${processed}/${entries.length} files uploaded${failed > 0 ? `, ${failed} failed` : ''}`;
    await supabase.from('migration_jobs').update({
      status: jobFinalStatus,
      processed_files: processed,
      failed_files: failed,
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    await addLog(supabase, job.id, job.user_id, jobFinalStatus === 'completed' ? 'success' : 'error', msg);

    // Post-verify browsability: every extracted file's parent chain must
    // exist as folder rows, otherwise the tree is orphaned and invisible
    // in the dashboard despite a "completed" job. Never stay silent.
    try {
      const { data: fileRows } = await supabase
        .from('files')
        .select('parent_folder')
        .eq('user_id', job.user_id)
        .like('storage_path', `${job.user_id}/migration/${job.id}/%`);
      const needed = new Set<string>();
      for (const r of fileRows || []) {
        const parts = String((r as any).parent_folder || '').split('/').filter(Boolean);
        for (let i = 1; i <= parts.length; i++) needed.add(parts.slice(0, i).join('/'));
      }
      let orphanCount = 0;
      if (needed.size > 0) {
        const { data: folderRows } = await supabase
          .from('folders')
          .select('path')
          .eq('user_id', job.user_id);
        const have = new Set((folderRows || []).map((f: any) => f.path));
        orphanCount = [...needed].filter(p => !have.has(p)).length;
      }
      const label = job.settings?.originalName || 'archive';
      if (jobFinalStatus === 'failed' || failed > 0 || orphanCount > 0) {
        await sendSignal({
          service_id: 'cloudbliss',
          type: 'import_failed',
          user_id: job.user_id,
          severity: 'warning',
          title: `Import finished with issues (${label})`,
          body: `${processed}/${entries.length} files imported${failed > 0 ? `, ${failed} failed` : ''}${orphanCount > 0 ? `, ${orphanCount} folders missing — files may be hidden` : ''}. Check the file requests panel for details.`,
          link: '/dashboard',
        });
      } else {
        await sendSignal({
          service_id: 'cloudbliss',
          type: 'import_completed',
          user_id: job.user_id,
          severity: 'info',
          title: `Import complete (${label})`,
          body: `${processed} files are now browsable in your dashboard.`,
          link: '/dashboard',
          idempotency_key: `migration-${job.id}`,
        });
      }
    } catch (signalErr) {
      await addLog(supabase, job.id, job.user_id, 'error', `Completion signal failed: ${(signalErr as any)?.message || signalErr}`);
    }

    return json(200, { processed: true, jobId: job.id, processed, failed, total: entries.length });

  } catch (error: any) {
    if (job?.id) {
      await markFailed(supabase, job.id, error.message);
    }
    return json(500, { error: error.message });
  }
});

function json(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

// ZIP extraction using native Deno DecompressionStream
async function extractZipFiles(buffer: Uint8Array): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Not a valid ZIP file');
  }

  let offset = 0;
  while (offset < buffer.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const filenameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    const filenameBytes = buffer.slice(offset + 30, offset + 30 + filenameLength);
    const filename = new TextDecoder().decode(filenameBytes);
    const dataStart = offset + 30 + filenameLength + extraLength;

    offset = dataStart + compressedSize;

    if (filename.endsWith('/') || filename.startsWith('__MACOSX/') || filename.startsWith('.')) continue;

    let content: Uint8Array;
    if (compression === 0) {
      content = buffer.slice(dataStart, dataStart + uncompressedSize);
    } else if (compression === 8) {
      content = await decompressDeflateRaw(buffer.slice(dataStart, dataStart + compressedSize));
    } else {
      continue;
    }

    const normalized = filename.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const name = parts.pop() || normalized;
    const parentFolder = parts.length > 0 ? parts.join('/') : null;

    entries.push({
      name,
      path: normalized,
      parentFolder,
      content,
      mimeType: mimeType(name),
      size: content.byteLength,
    });
  }

  return entries;
}

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressed);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

function mimeType(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
    txt: 'text/plain', html: 'text/html', css: 'text/css', js: 'application/javascript',
    json: 'application/json', xml: 'application/xml', csv: 'text/csv',
    md: 'text/markdown', ts: 'application/typescript',
  };
  return map[ext] || 'application/octet-stream';
}

interface ZipEntry {
  name: string;
  path: string;
  parentFolder: string | null;
  content: Uint8Array;
  mimeType: string;
  size: number;
}

async function markFailed(supabase: SupabaseClient, jobId: string, message: string) {
  await supabase.from('migration_jobs').update({
    status: 'failed', error_message: message, completed_at: new Date().toISOString()
  }).eq('id', jobId);
}

async function addLog(supabase: SupabaseClient, jobId: string, userId: string, level: string, message: string) {
  await supabase.from('migration_logs').insert({
    migration_job_id: jobId, user_id: userId, level, message,
  });
}
