import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

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
  return withPrelGateway(req, { functionId: 'start-cloud-import', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders() });
    }

    try {
      const { jobId, selectedFiles, platform } = await req.json();

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const userId = ctx.userId;

      // Update migration job with selected files
      await supabase
        .from('migration_jobs')
        .update({
          status: 'in_progress',
          total_files: selectedFiles.length,
          processed_files: 0,
          failed_files: 0,
          settings: {
            selectedFiles,
            platform
          }
        })
        .eq('id', jobId);

      // Start background import process
      EdgeRuntime.waitUntil(processCloudImport(jobId, selectedFiles, platform, userId, supabase));

      return jsonResponse({ success: true });

    } catch (error) {
      console.error("Error starting cloud import:", error);

      return jsonResponse({ error: error.message }, 500);
    }
  })
});

async function processCloudImport(jobId: string, selectedFiles: any[], platform: string, userId: string, supabase: any) {
  try {
    let processedCount = 0;
    let failedCount = 0;

    // Get job with OAuth tokens
    const { data: job } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    const tokens = job.settings?.oauth_tokens;

    for (const file of selectedFiles) {
      try {
        if (file.type === 'folder') {
          await processFolder(file, tokens, platform, userId, supabase, jobId);
        } else {
          await processFile(file, tokens, platform, userId, supabase, jobId);
        }

        processedCount++;

        // Update progress
        await supabase
          .from('migration_jobs')
          .update({ processed_files: processedCount })
          .eq('id', jobId);

        await supabase
          .from('migration_logs')
          .insert({
            migration_job_id: jobId,
            user_id: userId,
            level: 'info',
            message: `Imported: ${file.name}`,
            file_name: file.name
          });

      } catch (error) {
        failedCount++;
        console.error(`Failed to import ${file.name}:`, error);

        await supabase
          .from('migration_logs')
          .insert({
            migration_job_id: jobId,
            user_id: userId,
            level: 'error',
            message: `Failed to import: ${file.name} - ${error.message}`,
            file_name: file.name
          });
      }
    }

    // Mark as completed
    await supabase
      .from('migration_jobs')
      .update({ 
        status: 'completed',
        processed_files: processedCount,
        failed_files: failedCount,
        completed_at: new Date().toISOString() 
      })
      .eq('id', jobId);

  } catch (error) {
    console.error('Import processing error:', error);

    await supabase
      .from('migration_jobs')
      .update({ 
        status: 'failed',
        error_message: error.message
      })
      .eq('id', jobId);
  }
}

async function processFile(file: any, tokens: any, platform: string, userId: string, supabase: any, jobId: string) {
  let fileData;
  let fileName = file.name;

  // Download file from cloud service
  switch (platform) {
    case 'google-drive':
      fileData = await downloadGoogleDriveFile(file.id, tokens);
      break;
    case 'dropbox':
      fileData = await downloadDropboxFile(file.path || file.id, tokens);
      break;
    case 'onedrive':
      fileData = await downloadOneDriveFile(file.downloadUrl || file.id, tokens);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  const plainBytes = fileData instanceof Uint8Array ? fileData
    : fileData instanceof ArrayBuffer ? new Uint8Array(fileData)
    : new Uint8Array(await fileData.arrayBuffer());
  const plainSize = plainBytes.length || file.size || 0;

  // Canonical res54: AES-256-GCM exactly like dashboard / CLI uploads,
  // chunk objects in the `files` bucket, full chunk-location metadata.
  const fileId = crypto.randomUUID();
  const encryptionKey = generateRes54Key();
  const chunkSize = res54ChunkSize(plainSize);
  const totalChunks = Math.max(1, Math.ceil(plainSize / chunkSize));
  const chunkMetas: any[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const slice = plainBytes.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, plainBytes.length));
    const encrypted = await encryptChunkCanonical(slice, encryptionKey);
    const chunkPath = `${userId}/imported/res54/${fileId}/${i}.bin`;
    const { error: chunkError } = await supabase.storage
      .from('files')
      .upload(chunkPath, encrypted, {
        contentType: 'application/octet-stream',
        upsert: true
      });
    if (chunkError) throw chunkError;
    chunkMetas.push({
      index: i, totalChunks, size: slice.length, offset: i * chunkSize, sha256: '',
      repo: 'supabase', path: chunkPath,
    });
  }
  const metadata = {
    fileId, chunkSize, chunks: chunkMetas, encryptionKey,
    created: new Date().toISOString(), previewAvailable: false,
  };

  // Imported files belong to the user's default workspace so they appear
  // in the dashboard instead of limbo.
  let workspaceId: string | null = null;
  try {
    const { data: wsId } = await supabase.rpc('get_or_create_default_workspace', { p_user_id: userId });
    if (typeof wsId === 'string' && wsId) workspaceId = wsId;
  } catch { /* non-fatal */ }

  // Create file record in database
  await supabase
    .from('files')
    .insert({
      id: fileId,
      user_id: userId,
      name: fileName,
      storage_path: 'res54_distributed',
      size: plainSize,
      type: file.mimeType || 'application/octet-stream',
      encrypted: true,
      encryption_key: '',
      tags: [JSON.stringify(metadata)],
      processor: 'res54',
      parent_folder: 'imported',
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    });
}

async function processFolder(folder: any, tokens: any, platform: string, userId: string, supabase: any, jobId: string) {
  // Create folder record
  await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name: folder.name,
      path: `imported/${folder.name}`,
      parent_folder: 'imported'
    });

  // Note: In a full implementation, you would recursively process folder contents
  console.log(`Created folder: ${folder.name}`);
}

async function downloadGoogleDriveFile(fileId: string, tokens: any) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download from Google Drive: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

async function downloadDropboxFile(filePath: string, tokens: any) {
  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath })
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download from Dropbox: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

async function downloadOneDriveFile(downloadUrl: string, tokens: any) {
  const response = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download from OneDrive: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}
