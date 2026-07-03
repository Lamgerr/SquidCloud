import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const BUCKET = 'migration-zips';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];
    let processedSize = 0;

    for (const entry of entries) {
      try {
        const storageKey = `${job.user_id}/migration/${job.id}/${entry.path}`;

        const { error: uploadError } = await supabase.storage.from('files').upload(storageKey, entry.content, {
          contentType: entry.mimeType,
          upsert: true,
        });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        const { error: recordError } = await supabase.from('files').insert({
          name: entry.name,
          type: entry.mimeType,
          size: entry.size,
          storage_path: storageKey,
          user_id: job.user_id,
          encrypted: false,
          parent_folder: entry.parentFolder,
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
