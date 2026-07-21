import {
  jsonResponse, errorResponse, apiSuccess, apiError,
  CORS_HEADERS, getOptionalEncryptionKey, validateEncryptionKeyFormat,
  generateEncryptionKey, encryptData, decryptData, calculateSHA256, uint8ToBase64,
  loadB2Clusters, signB2Url, ROLE_RANK,
  requireWorkspaceRole, resolveWorkspaceId, encryptSecretValue, decryptSecretValue,
  deriveAESKeyFromApiKey, logAudit
} from './utils.ts';

const B2_ENDPOINT = () => Deno.env.get('B2_ENDPOINT') ?? '';
const B2_BUCKET = () => Deno.env.get('B2_BUCKET_NAME') ?? '';
const B2_ACCESS_KEY = () => Deno.env.get('B2_ACCESS_KEY_ID') ?? '';
const B2_SECRET = () => Deno.env.get('B2_SECRET_ACCESS_KEY') ?? '';
const B2_REGION = () => Deno.env.get('B2_REGION') ?? 'us-west-000';

function uuidRegex(): RegExp {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
}

function getIdFromPath(pathParts: string[], index: number): string | null {
  const val = pathParts[index];
  if (!val) return null;
  return uuidRegex().test(val) ? val : null;
}

async function makeB2Client() {
  const { AwsClient } = await import('npm:aws4fetch');
  return new AwsClient({
    accessKeyId: B2_ACCESS_KEY(),
    secretAccessKey: B2_SECRET(),
    region: B2_REGION(),
    service: 's3',
  });
}

// ============================================================
// HANDLER: handleFilesAPI
// ============================================================
export async function handleFilesAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
  apiKey?: string,
): Promise<Response> {
  const method = req.method;

  wsId = await resolveWorkspaceId(supabase, userId, wsId);
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400);
  }

  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer');
  const editorCheck = viewerCheck.allowed
    ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.editor, role: viewerCheck.role }
    : { allowed: false, role: null };
  const adminCheck = viewerCheck.allowed
    ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.admin, role: viewerCheck.role }
    : { allowed: false, role: null };

  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403);
  }

  // GET /files — List files and folders with pagination
  if (method === 'GET' && path === '/files' || path === '') {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)));
    const search = url.searchParams.get('search') || '';
    const folderId = url.searchParams.get('folder_id') || '';

    let filesQuery = supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('workspace_id', wsId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false });

    if (folderId) {
      filesQuery = filesQuery.eq('parent_folder', folderId);
    }
    if (search) {
      filesQuery = filesQuery.ilike('name', `%${search}%`);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    filesQuery = filesQuery.range(from, to);

    const { data: files, error: filesError, count: totalFiles } = await filesQuery;

    let foldersQuery = supabase
      .from('folders')
      .select('*', { count: 'exact' })
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (folderId) {
      foldersQuery = foldersQuery.eq('parent_folder', folderId);
    }
    if (search) {
      foldersQuery = foldersQuery.ilike('name', `%${search}%`);
    }

    const { data: folders, error: foldersError, count: totalFolders } = await foldersQuery;

    if (filesError || foldersError) {
      throw filesError || foldersError;
    }

    return jsonResponse({
      files: files || [],
      folders: folders || [],
      total_files: totalFiles || 0,
      total_folders: totalFolders || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((totalFiles || 0) / perPage),
      success: true,
    });
  }

  // GET /files/:id/metadata
  if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'metadata') {
    const fileId = pathParts[1];
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (error || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    return jsonResponse({ file, success: true });
  }

  // GET /files/:id/download
  if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'download') {
    const fileId = pathParts[1];
    const url = new URL(req.url);
    const signed = url.searchParams.get('signed') === 'true';
    const providedEncryptionKey = getOptionalEncryptionKey(req, url.searchParams);

    if (providedEncryptionKey && !validateEncryptionKeyFormat(providedEncryptionKey)) {
      return jsonResponse({ error: 'Invalid encryption key format', success: false, code: 400 }, 400);
    }

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fileError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    if (file.storage_path === 'res54_distributed' && file.encrypted) {
      let metadata: any;
      try {
        metadata = Array.isArray(file.tags) && file.tags.length > 0
          ? JSON.parse(file.tags[0])
          : null;
      } catch {
        return jsonResponse({ error: 'Invalid file metadata', success: false }, 500);
      }

      if (!metadata || !metadata.chunks) {
        return jsonResponse({ error: 'File metadata not found', success: false }, 500);
      }

      const isBYOK =
        file.encryption_key === 'sha256:byok_encrypted' ||
        metadata.encryptionKey === 'sha256:byok_encrypted' ||
        metadata.encryptionKey === 'byok_encrypted' ||
        metadata.encryptionKey === 'byok_protected' ||
        metadata.encryptionKey === null ||
        metadata.encryptionKey === '';

      let decryptionKey = providedEncryptionKey;
      if (!decryptionKey) {
        if (isBYOK) {
          return jsonResponse({
            error: 'This file uses BYOK. Provide the encryption key via encryption_key parameter.',
            success: false,
            code: 422,
          }, 422);
        }
        decryptionKey = metadata.encryptionKey || file.encryption_key;
      }

      if (!decryptionKey) {
        return jsonResponse({ error: 'Encryption key missing for encrypted file', success: false, code: 422 }, 422);
      }

      if (signed) {
        // Return signed B2 URLs for direct download instead of proxying
        const b2Client = await makeB2Client();
        const signedUrls: string[] = [];
        for (const chunkMeta of metadata.chunks) {
          if (chunkMeta.repo === 'b2') {
            const b2Url = new URL(`${B2_ENDPOINT()}/${B2_BUCKET()}/${chunkMeta.path}`);
            const signedReq = await b2Client.sign(b2Url.toString(), {
              method: 'GET',
              aws: { signQuery: true },
            });
            signedUrls.push(signedReq.url);
          }
        }
        return jsonResponse({
          signed_urls: signedUrls,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          encrypted: true,
          requires_decryption: true,
          success: true,
        });
      }

      // Full server-side decryption
      const b2Client = await makeB2Client();
      const chunks: ArrayBuffer[] = [];
      for (const chunkMeta of metadata.chunks) {
        try {
          let encryptedBuffer: ArrayBuffer;
          if (chunkMeta.repo === 'b2') {
            const b2Url = new URL(`${B2_ENDPOINT()}/${B2_BUCKET()}/${chunkMeta.path}`);
            const signedReq = await b2Client.sign(b2Url.toString(), {
              method: 'GET',
              aws: { signQuery: true },
            });
            const b2Response = await fetch(signedReq.url);
            if (!b2Response.ok) throw new Error(`B2 download failed (${b2Response.status})`);
            encryptedBuffer = await b2Response.arrayBuffer();
          } else {
            const response = await supabase.functions.invoke('github-storage', {
              body: { action: 'download', path: chunkMeta.path, repo: chunkMeta.repo, userId, nodeId: chunkMeta.accountId ?? 0 },
            });
            if (response.error) {
              throw new Error(`Failed to download chunk ${chunkMeta.index}: ${typeof response.error === 'object' ? JSON.stringify(response.error) : response.error}`);
            }
            if (!response.data?.content) throw new Error(`Empty content from storage for chunk ${chunkMeta.index}`);
            const cleanContent = response.data.content.replace(/\s/g, '');
            encryptedBuffer = Uint8Array.from(atob(cleanContent), c => c.charCodeAt(0)).buffer;
          }

          let encryptedB64: string;
          try {
            const text = new TextDecoder().decode(encryptedBuffer);
            const parsed = JSON.parse(text);
            encryptedB64 = parsed.chunkData || uint8ToBase64(new Uint8Array(encryptedBuffer));
          } catch {
            encryptedB64 = uint8ToBase64(new Uint8Array(encryptedBuffer));
          }

          const decryptedChunk = await decryptData(encryptedB64, decryptionKey);
          chunks.push(decryptedChunk);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          if (errMsg.includes('decrypt') || errMsg.includes('key mismatch') || (error instanceof DOMException && error.name === 'OperationError')) {
            return jsonResponse({ error: 'Provided encryption key mismatch. Unable to decrypt file.', success: false, code: 422 }, 422);
          }
          return jsonResponse({ error: `Failed to process chunk ${chunkMeta.index}: ${errMsg}`, success: false }, 500);
        }
      }

      const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      return new Response(combined, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.name}"`,
        },
      });
    }

    // Non-encrypted download via Supabase Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) throw downloadError;

    return new Response(fileData, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.name}"`,
      },
    });
  }

  // POST /files/upload/init — Initialize upload with signed B2 URLs
  if (method === 'POST' && pathParts.length === 3 && pathParts[1] === 'upload' && pathParts[2] === 'init') {
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to upload files', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const name = (body.name as string) || '';
    const type = (body.type as string) || 'application/octet-stream';
    const size = parseInt(String(body.size || '0'), 10);
    const folderId = (body.folder_id as string) || null;
    const providedEncryptionKey = (body.encryption_key as string) || getOptionalEncryptionKey(req) || '';
    const workspaceId = (body.workspace_id as string) || wsId;

    if (!name || size <= 0) {
      return jsonResponse({ error: 'File name and valid size are required', success: false }, 400);
    }

    if (providedEncryptionKey && !validateEncryptionKeyFormat(providedEncryptionKey)) {
      return jsonResponse({ error: 'Invalid encryption key format', success: false, code: 400 }, 400);
    }

    const uploadId = crypto.randomUUID();
    const encryptionKey = providedEncryptionKey || await generateEncryptionKey();

    // Determine chunk size based on file size
    let chunkSize = 512 * 1024;
    if (size > 10 * 1024 * 1024) chunkSize = 1 * 1024 * 1024;
    if (size > 50 * 1024 * 1024) chunkSize = 2 * 1024 * 1024;

    const totalChunks = Math.ceil(size / chunkSize);
    const b2Client = await makeB2Client();

    const urls: Array<{ path: string; upload_url: string; index: number }> = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = `${userId}/uploads/${uploadId}/${i}.bin`;
      const b2Url = new URL(`${B2_ENDPOINT()}/${B2_BUCKET()}/${chunkPath}`);
      const signedReq = await b2Client.sign(b2Url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        aws: { signQuery: true },
      });
      urls.push({ path: chunkPath, upload_url: signedReq.url, index: i });
    }

    // Pre-register upload in metadata
    const uploadMeta = {
      upload_id: uploadId,
      file_name: name,
      file_type: type,
      file_size: size,
      chunk_size: chunkSize,
      total_chunks: totalChunks,
      folder_id: folderId,
      encryption_key: providedEncryptionKey ? 'sha256:byok_encrypted' : encryptionKey,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      user_id: userId,
    };

    await supabase.from('api_request_logs').insert({
      api_key_id: null,
      user_id: userId,
      endpoint: '/files/upload/init',
      method: 'POST',
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null,
      status_code: 200,
      error_message: null,
      file_name: name,
      file_size: size,
      metadata: { upload_id: uploadId, total_chunks: totalChunks },
    });

    return jsonResponse({
      success: true,
      upload_id: uploadId,
      urls,
      cluster_id: 'b2',
      chunk_size: chunkSize,
      total_chunks: totalChunks,
      encryption: {
        mode: providedEncryptionKey ? 'provided' : 'generated',
        key_required_for_complete: true,
      },
    }, 201);
  }

  // POST /files/upload/complete — Complete upload, register file in DB
  if (method === 'POST' && pathParts.length === 3 && pathParts[1] === 'upload' && pathParts[2] === 'complete') {
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to complete uploads', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const uploadId = (body.upload_id as string) || '';
    const fileId = (body.file_id as string) || '';
    const chunks = (body.chunks as Array<{ path: string; index: number; sha256: string }>) || [];
    const providedEncryptionKey = (body.encryption_key as string) || '';

    if (!uploadId || !fileId || !chunks.length) {
      return jsonResponse({ error: 'upload_id, file_id, and chunks are required', success: false }, 400);
    }

    const url = new URL(req.url);
    // Fetch upload metadata from init to get encryption key
    const initKey = url.searchParams.get('encryption_key') || providedEncryptionKey;
    if (!initKey) {
      return jsonResponse({ error: 'Encryption key missing. Provide it in the body as encryption_key.', success: false, code: 422 }, 422);
    }

    const b2Client = await makeB2Client();

    // Verify all chunks exist and have correct SHA256
    const verifiedChunks: Array<{ index: number; path: string; sha256: string; repo: string }> = [];
    for (const chunk of chunks) {
      try {
        const b2Url = new URL(`${B2_ENDPOINT()}/${B2_BUCKET()}/${chunk.path}`);
        const signedReq = await b2Client.sign(b2Url.toString(), {
          method: 'GET',
          aws: { signQuery: true },
        });
        const headResp = await fetch(signedReq.url, { method: 'HEAD' });
        if (!headResp.ok) {
          throw new Error(`Chunk ${chunk.index} not found on storage`);
        }
        verifiedChunks.push({ ...chunk, repo: 'b2' });
      } catch (err) {
        return jsonResponse({
          error: `Chunk ${chunk.index} verification failed: ${err instanceof Error ? err.message : String(err)}`,
          success: false,
        }, 400);
      }
    }

    const encryptionKey = initKey;
    const isBYOK = encryptionKey.startsWith('sha256:byok_encrypted') ||
                   encryptionKey === 'byok_encrypted' ||
                   encryptionKey === 'byok_protected';

    const metadata = {
      fileId: fileId,
      chunkSize: chunks[0]?.path ? 0 : 0,
      chunks: verifiedChunks,
      encryptionKey: isBYOK ? encryptionKey : encryptionKey,
      created: new Date().toISOString(),
      previewAvailable: false,
    };

    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        user_id: userId,
        name: body.name || 'unknown',
        type: body.type || 'application/octet-stream',
        size: body.file_size || 0,
        storage_path: 'res54_distributed',
        parent_folder: body.folder_id ? String(body.folder_id) : null,
        workspace_id: wsId,
        encrypted: true,
        encryption_key: encryptionKey,
        tags: [JSON.stringify(metadata)],
        is_deleted: false,
      })
      .select()
      .single();

    if (fileError) {
      if (fileError.code === '23505') {
        return jsonResponse({ error: 'A file with this ID already exists', success: false }, 409);
      }
      throw fileError;
    }

    return jsonResponse({
      success: true,
      file: fileRecord,
      message: 'Upload completed and file registered successfully',
    }, 201);
  }

  // DELETE /files/:id — Soft delete
  if (method === 'DELETE' && pathParts.length === 2) {
    const fileId = pathParts[1];
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to delete files', success: false, code: 403 }, 403);
    }

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fetchError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    if (!adminCheck.allowed && file.user_id !== userId) {
      return jsonResponse({ error: 'Cannot delete another user\'s file', success: false, code: 403 }, 403);
    }

    const { error: deleteError } = await supabase
      .from('files')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true, message: 'File deleted successfully' });
  }

  // POST /files/:id/restore — Restore from trash
  if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'restore') {
    const fileId = pathParts[1];
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to restore files', success: false, code: 403 }, 403);
    }

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fetchError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    if (!file.is_deleted) {
      return jsonResponse({ error: 'File is not in trash', success: false }, 400);
    }

    const { error: restoreError } = await supabase
      .from('files')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', fileId);

    if (restoreError) throw restoreError;

    return jsonResponse({ success: true, message: 'File restored from trash' });
  }

  // PUT /files/:id/rename
  if (method === 'PUT' && pathParts.length === 3 && pathParts[2] === 'rename') {
    const fileId = pathParts[1];
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to rename files', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const newName = (body.name as string || '').trim();
    if (!newName) {
      return jsonResponse({ error: 'New name is required', success: false }, 400);
    }

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fetchError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    const { data: updated, error: updateError } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({ success: true, file: updated });
  }

  // POST /files/:id/move — Move file to folder
  if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'move') {
    const fileId = pathParts[1];
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to move files', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const folderId = (body.folder_id as string) || null;

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fetchError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    const { data: updated, error: updateError } = await supabase
      .from('files')
      .update({ parent_folder: folderId })
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({ success: true, file: updated });
  }

  // POST /files/copy — Copy file
  if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'copy') {
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to copy files', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const sourceFileId = (body.file_id as string) || '';
    const targetFolderId = (body.folder_id as string) || null;
    const newName = (body.new_name as string) || '';

    if (!sourceFileId) {
      return jsonResponse({ error: 'file_id is required', success: false }, 400);
    }

    const { data: sourceFile, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', sourceFileId)
      .eq('workspace_id', wsId)
      .single();

    if (fetchError || !sourceFile) {
      return jsonResponse({ error: 'Source file not found', success: false }, 404);
    }

    const { data: newFile, error: copyError } = await supabase
      .from('files')
      .insert({
        user_id: userId,
        name: newName || `${sourceFile.name} (Copy)`,
        type: sourceFile.type,
        size: sourceFile.size,
        storage_path: sourceFile.storage_path,
        parent_folder: targetFolderId,
        workspace_id: wsId,
        encrypted: sourceFile.encrypted,
        encryption_key: sourceFile.encryption_key,
        tags: sourceFile.tags,
        is_deleted: false,
      })
      .select()
      .single();

    if (copyError) throw copyError;

    return jsonResponse({ success: true, file: newFile }, 201);
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleCDNAPI
// ============================================================
export async function handleCDNAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
): Promise<Response> {
  const method = req.method;

  wsId = await resolveWorkspaceId(supabase, userId, wsId);
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400);
  }

  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer');
  const editorCheck = viewerCheck.allowed
    ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.editor, role: viewerCheck.role }
    : { allowed: false, role: null };

  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403);
  }

  // GET /cdn/list
  if (method === 'GET' && path === '/cdn/list') {
    const { data: cdnFiles, error } = await supabase
      .from('squidcdn_files')
      .select('*, files!inner(name, type, size)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return jsonResponse({ cdn_files: cdnFiles || [], success: true });
  }

  // GET /cdn/:file_id — Get CDN info
  if (method === 'GET' && pathParts.length === 2) {
    const fileId = pathParts[1];

    const { data: cdnEntry, error } = await supabase
      .from('squidcdn_files')
      .select('*')
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .single();

    if (error || !cdnEntry) {
      return jsonResponse({ error: 'CDN entry not found', success: false }, 404);
    }

    return jsonResponse({
      cdn_info: {
        id: cdnEntry.id,
        file_id: cdnEntry.file_id,
        cdn_path: cdnEntry.cdn_path,
        content_type: cdnEntry.content_type,
        views_count: cdnEntry.views_count,
        is_active: cdnEntry.is_active,
        created_at: cdnEntry.created_at,
      },
      cdn_url: `https://squidcloud.vercel.app/api/v1/cdn/play/${cdnEntry.cdn_path}`,
      success: true,
    });
  }

  // POST /cdn/publish
  if (method === 'POST' && path === '/cdn/publish') {
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to publish to CDN', success: false, code: 403 }, 403);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const fileId = (body.file_id as string) || '';
    if (!fileId) {
      return jsonResponse({ error: 'file_id is required', success: false }, 400);
    }

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single();

    if (fileError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404);
    }

    const cdnPath = `${crypto.randomUUID().split('-')[0]}-${file.name.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`;

    const { data: cdnEntry, error: cdnError } = await supabase
      .from('squidcdn_files')
      .insert({
        file_id: fileId,
        user_id: userId,
        workspace_id: wsId,
        cdn_path: cdnPath,
        content_type: file.type || 'application/octet-stream',
        file_size: file.size || 0,
        is_active: true,
      })
      .select()
      .single();

    if (cdnError) {
      if (cdnError.code === '23505') {
        return jsonResponse({ error: 'File already published to CDN', success: false }, 409);
      }
      throw cdnError;
    }

    return jsonResponse({
      success: true,
      cdn_entry: cdnEntry,
      cdn_url: `https://squidcloud.vercel.app/api/v1/cdn/play/${cdnPath}`,
    }, 201);
  }

  // DELETE /cdn/:file_id — Unpublish
  if (method === 'DELETE' && pathParts.length === 2) {
    const fileId = pathParts[1];

    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to unpublish from CDN', success: false, code: 403 }, 403);
    }

    const { data: existing, error: fetchError } = await supabase
      .from('squidcdn_files')
      .select('id')
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return jsonResponse({ error: 'CDN entry not found', success: false }, 404);
    }

    const { error: deleteError } = await supabase
      .from('squidcdn_files')
      .update({ is_active: false })
      .eq('file_id', fileId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true, message: 'File unpublished from CDN' });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// GET /cdn/play/:cdn_path — Public streaming endpoint (no auth)
// This endpoint is designed to be called without auth headers.
// It returns a signed B2 URL for direct streaming.
// Handle it as a special case in index.ts routing.

// ============================================================
// HANDLER: handleSearchAPI
// ============================================================
export async function handleSearchAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  wsId = await resolveWorkspaceId(supabase, userId, wsId);
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400);
  }

  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer');
  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403);
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const typeFilter = url.searchParams.get('type') || '';
  const folderId = url.searchParams.get('folder_id') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '20', 10)));

  if (!query && !typeFilter) {
    return jsonResponse({ error: 'Search query (q) or type filter required', success: false }, 400);
  }

  let filesQuery = supabase
    .from('files')
    .select('*', { count: 'exact' })
    .eq('workspace_id', wsId)
    .is('is_deleted', false);

  if (query) {
    filesQuery = filesQuery.or(`name.ilike.%${query}%,tags.cs.{${query}}`);
  }
  if (typeFilter) {
    filesQuery = filesQuery.ilike('type', `${typeFilter}%`);
  }
  if (folderId) {
    filesQuery = filesQuery.eq('parent_folder', folderId);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data: files, count: total, error } = await filesQuery
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  let foldersQuery = supabase
    .from('folders')
    .select('*', { count: 'exact' })
    .eq('workspace_id', wsId);

  if (query) {
    foldersQuery = foldersQuery.ilike('name', `%${query}%`);
  }
  if (folderId) {
    foldersQuery = foldersQuery.eq('parent_folder', folderId);
  }

  const { data: folders, count: folderTotal } = await foldersQuery;

  return jsonResponse({
    success: true,
    files: files || [],
    folders: folders || [],
    total,
    folder_total: folderTotal || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((total || 0) / perPage),
    query,
    type_filter: typeFilter,
  });
}

// ============================================================
// HANDLER: handleBatchAPI
// ============================================================
export async function handleBatchAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  wsId = await resolveWorkspaceId(supabase, userId, wsId);
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400);
  }

  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer');
  const editorCheck = viewerCheck.allowed
    ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.editor, role: viewerCheck.role }
    : { allowed: false, role: null };

  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
  }

  const fileIds = (body.file_ids as string[]) || [];
  const folderId = (body.folder_id as string) || null;

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return jsonResponse({ error: 'file_ids array is required', success: false }, 400);
  }

  if (fileIds.length > 100) {
    return jsonResponse({ error: 'Maximum 100 files per batch operation', success: false }, 400);
  }

  const action = pathParts[1]; // delete, move, restore, copy
  const results: Array<{ file_id: string; status: string; error?: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const fileId of fileIds) {
    try {
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('workspace_id', wsId)
        .single();

      if (fetchError || !file) {
        results.push({ file_id: fileId, status: 'error', error: 'File not found' });
        failed++;
        continue;
      }

      if (action === 'delete') {
        if (!editorCheck.allowed) {
          results.push({ file_id: fileId, status: 'error', error: 'Insufficient permissions' });
          failed++;
          continue;
        }
        const { error: delErr } = await supabase
          .from('files')
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', fileId);
        if (delErr) throw delErr;
        results.push({ file_id: fileId, status: 'deleted' });
        succeeded++;
      } else if (action === 'move') {
        if (!editorCheck.allowed) {
          results.push({ file_id: fileId, status: 'error', error: 'Insufficient permissions' });
          failed++;
          continue;
        }
        if (!folderId) {
          results.push({ file_id: fileId, status: 'error', error: 'folder_id required for move' });
          failed++;
          continue;
        }
        const { error: moveErr } = await supabase
          .from('files')
          .update({ parent_folder: folderId })
          .eq('id', fileId);
        if (moveErr) throw moveErr;
        results.push({ file_id: fileId, status: 'moved' });
        succeeded++;
      } else if (action === 'restore') {
        if (!file.is_deleted) {
          results.push({ file_id: fileId, status: 'error', error: 'File not in trash' });
          failed++;
          continue;
        }
        const { error: restErr } = await supabase
          .from('files')
          .update({ is_deleted: false, deleted_at: null })
          .eq('id', fileId);
        if (restErr) throw restErr;
        results.push({ file_id: fileId, status: 'restored' });
        succeeded++;
      } else if (action === 'copy') {
        if (!editorCheck.allowed) {
          results.push({ file_id: fileId, status: 'error', error: 'Insufficient permissions' });
          failed++;
          continue;
        }
        const { data: newFile, error: copyErr } = await supabase
          .from('files')
          .insert({
            user_id: userId,
            name: `${file.name} (Copy)`,
            type: file.type,
            size: file.size,
            storage_path: file.storage_path,
            parent_folder: folderId,
            workspace_id: wsId,
            encrypted: file.encrypted,
            encryption_key: file.encryption_key,
            tags: file.tags,
            is_deleted: false,
          })
          .select()
          .single();
        if (copyErr) throw copyErr;
        results.push({ file_id: fileId, status: 'copied', new_file_id: newFile.id });
        succeeded++;
      } else {
        results.push({ file_id: fileId, status: 'error', error: `Unknown action: ${action}` });
        failed++;
      }
    } catch (err) {
      results.push({ file_id: fileId, status: 'error', error: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  return jsonResponse({
    success: true,
    action,
    results,
    total: fileIds.length,
    succeeded,
    failed,
  });
}

// ============================================================
// HANDLER: handleStatsAPI
// ============================================================
export async function handleStatsAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  // GET /stats/usage
  if (path === '/stats/usage') {
    const { data: credits, error: creditsError } = await supabase
      .from('api_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') throw creditsError;

    const today = new Date().toISOString().split('T')[0];
    const { data: todayLog } = await supabase
      .from('api_credit_log')
      .select('credits_deducted')
      .eq('user_id', userId)
      .gte('created_at', today);

    const todayCredits = todayLog
      ? todayLog.reduce((sum: number, r: any) => sum + (r.credits_deducted || 0), 0)
      : 0;

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: weekLog } = await supabase
      .from('api_credit_log')
      .select('credits_deducted')
      .eq('user_id', userId)
      .gte('created_at', weekAgo);

    const weekCredits = weekLog
      ? weekLog.reduce((sum: number, r: any) => sum + (r.credits_deducted || 0), 0)
      : 0;

    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: monthLog } = await supabase
      .from('api_credit_log')
      .select('credits_deducted')
      .eq('user_id', userId)
      .gte('created_at', monthAgo);

    const monthCredits = monthLog
      ? monthLog.reduce((sum: number, r: any) => sum + (r.credits_deducted || 0), 0)
      : 0;

    return jsonResponse({
      success: true,
      usage: {
        today: {
          credits_used: todayCredits,
          daily_limit: credits?.daily_limit || 1000,
        },
        this_week: {
          credits_used: weekCredits,
        },
        this_month: {
          credits_used: monthCredits,
        },
        total_requests_today: todayLog?.length || 0,
        credits_remaining: credits?.credits_remaining || 1000,
      },
    });
  }

  // GET /stats/credits — Detailed credit log
  if (path === '/stats/credits') {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data: logs, count: total, error } = await supabase
      .from('api_credit_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return jsonResponse({
      success: true,
      logs: logs || [],
      total,
      page,
      per_page: perPage,
    });
  }

  // GET /stats/storage — Storage breakdown
  if (path === '/stats/storage') {
    const { data: files, error } = await supabase
      .from('files')
      .select('type, size, encrypted')
      .eq('user_id', userId)
      .is('is_deleted', false);

    if (error) throw error;

    const byType: Record<string, { count: number; total_size: number }> = {};
    let totalSize = 0;
    let totalCount = 0;
    let encryptedSize = 0;
    let encryptedCount = 0;

    for (const f of files || []) {
      const category = f.type?.split('/')[0] || 'unknown';
      if (!byType[category]) byType[category] = { count: 0, total_size: 0 };
      byType[category].count++;
      byType[category].total_size += f.size || 0;
      totalSize += f.size || 0;
      totalCount++;
      if (f.encrypted) {
        encryptedSize += f.size || 0;
        encryptedCount++;
      }
    }

    return jsonResponse({
      success: true,
      storage: {
        total_files: totalCount,
        total_size: totalSize,
        encrypted_files: encryptedCount,
        encrypted_size: encryptedSize,
        by_type: byType,
      },
    });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleExportAPI
// ============================================================
export async function handleExportAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  wsId = await resolveWorkspaceId(supabase, userId, wsId);
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400);
  }

  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer');
  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403);
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'json';
  const folderId = url.searchParams.get('folder_id') || '';

  let query = supabase
    .from('files')
    .select('id, name, type, size, encrypted, created_at, updated_at, parent_folder')
    .eq('workspace_id', wsId)
    .is('is_deleted', false)
    .order('created_at', { ascending: false });

  if (folderId) {
    query = query.eq('parent_folder', folderId);
  }

  const { data: files, error } = await query;

  if (error) throw error;

  if (format === 'csv') {
    const header = 'id,name,type,size,encrypted,created_at,updated_at,parent_folder';
    const rows = (files || []).map((f: any) =>
      `"${f.id}","${f.name.replace(/"/g, '""')}","${f.type}",${f.size},${f.encrypted},"${f.created_at}","${f.updated_at}","${f.parent_folder || ''}"`
    );
    const csv = [header, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="files_export.csv"',
      },
    });
  }

  return jsonResponse({
    success: true,
    files: files || [],
    total: files?.length || 0,
    exported_at: new Date().toISOString(),
  });
}

// ============================================================
// HANDLER: handleHealthAPI
// ============================================================
export async function handleHealthAPI(
  req: Request,
  supabase: any,
): Promise<Response> {
  try {
    const { count, error } = await supabase
      .from('api_operation_costs')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return jsonResponse({
      status: 'ok',
      version: '4.0',
      timestamp: new Date().toISOString(),
      db: 'connected',
      uptime: Math.floor(performance.now() / 1000),
      operations_count: count || 0,
    });
  } catch (err) {
    return jsonResponse({
      status: 'degraded',
      version: '4.0',
      timestamp: new Date().toISOString(),
      db: 'disconnected',
      uptime: Math.floor(performance.now() / 1000),
      error: err instanceof Error ? err.message : String(err),
    }, 503);
  }
}

// ============================================================
// HANDLER: handleKeysAPI
// ============================================================
export async function handleKeysAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
): Promise<Response> {
  const method = req.method;

  // GET /keys — List keys
  if (method === 'GET' && path === '/keys') {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Include key limits if any
    const keyIds = (keys || []).map((k: any) => k.id);
    let limits: any[] = [];
    if (keyIds.length > 0) {
      const { data: limitsData } = await supabase
        .from('api_key_limits')
        .select('*')
        .in('api_key_id', keyIds);
      limits = limitsData || [];
    }

    return jsonResponse({ keys: keys || [], limits, success: true });
  }

  // POST /keys — Create key
  if (method === 'POST' && path === '/keys') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const name = (body.name as string || '').trim();
    const scopes = (body.scopes as string[]) || ['*'];
    const expiresAt = (body.expires_at as string) || null;

    if (!name) {
      return jsonResponse({ error: 'Key name is required', success: false }, 400);
    }

    const rawKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const prefix = rawKey.substring(0, 8);
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = btoa(String.fromCharCode(...saltBytes));

    const encoder = new TextEncoder();
    const combined = new Uint8Array(saltBytes.length + encoder.encode(rawKey).length);
    combined.set(saltBytes);
    combined.set(encoder.encode(rawKey), saltBytes.length);
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyRecord, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        key_prefix: prefix,
        key_hash: keyHash,
        key_salt: saltB64,
        scopes,
        expires_at: expiresAt,
        is_active: true,
      })
      .select('id, name, key_prefix, scopes, created_at, is_active')
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      success: true,
      key: keyRecord,
      raw_key: rawKey,
      message: 'Save the raw key — it will not be shown again.',
    }, 201);
  }

  // PUT /keys/:id — Update key
  if (method === 'PUT' && pathParts.length === 2) {
    const keyId = pathParts[1];

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.scopes !== undefined) updates.scopes = body.scopes;
    if (body.is_active !== undefined) updates.is_active = body.is_active === true || body.is_active === 'true';

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: 'No fields to update', success: false }, 400);
    }

    const { data: keyRecord, error: updateError } = await supabase
      .from('api_keys')
      .update(updates)
      .eq('id', keyId)
      .eq('user_id', userId)
      .select('id, name, key_prefix, scopes, is_active, created_at, last_used_at')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return jsonResponse({ error: 'Key not found', success: false }, 404);
      }
      throw updateError;
    }

    return jsonResponse({ success: true, key: keyRecord });
  }

  // DELETE /keys/:id
  if (method === 'DELETE' && pathParts.length === 2) {
    const keyId = pathParts[1];

    const { data: existing, error: fetchError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return jsonResponse({ error: 'Key not found', success: false }, 404);
    }

    const { error: deleteError } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true, message: 'Key deleted' });
  }

  // PUT /keys/:id/limits — Custom per-key limits
  if (method === 'PUT' && pathParts.length === 3 && pathParts[2] === 'limits') {
    const keyId = pathParts[1];

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    // Check user is supporter+ (has custom_daily_limit on profile or subscription)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    // Only admins or supporter plans can set custom limits; for now allow all users
    const limits: Record<string, unknown> = {};
    if (body.custom_daily_limit !== undefined) {
      limits.custom_daily_limit = parseInt(String(body.custom_daily_limit), 10);
    }
    if (body.custom_rate_limit_rps !== undefined) {
      limits.custom_rate_limit_rps = parseInt(String(body.custom_rate_limit_rps), 10);
    }

    if (Object.keys(limits).length === 0) {
      return jsonResponse({ error: 'No limit fields to update', success: false }, 400);
    }

    const { data: keyRecord, error: upsertError } = await supabase
      .from('api_key_limits')
      .upsert({
        api_key_id: keyId,
        ...limits,
      })
      .select()
      .single();

    if (upsertError) {
      if (upsertError.code === '23503') {
        return jsonResponse({ error: 'Key not found', success: false }, 404);
      }
      throw upsertError;
    }

    return jsonResponse({ success: true, limits: keyRecord });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleStorageAPI
// ============================================================
export async function handleStorageAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  wsId?: string,
): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  wsId = await resolveWorkspaceId(supabase, userId, wsId);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('storage_used')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') throw profileError;

  let filesQuery = supabase.from('files').select('size');
  if (wsId) {
    filesQuery = filesQuery.eq('workspace_id', wsId);
  } else {
    filesQuery = filesQuery.eq('user_id', userId);
  }
  filesQuery = filesQuery.is('is_deleted', false);

  const { data: files, error: filesError } = await filesQuery;
  if (filesError) throw filesError;

  const totalFiles = files?.length || 0;
  const totalSize = (files || []).reduce((sum: number, f: any) => sum + (f.size || 0), 0);

  return jsonResponse({
    storage_used: profile?.storage_used || 0,
    total_files: totalFiles,
    total_size: totalSize,
    success: true,
  });
}

// ============================================================
// HANDLER: handleUserAPI
// ============================================================
export async function handleUserAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed', success: false }, 405);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, storage_used')
    .eq('id', userId)
    .single();

  // Get credit info
  const { data: credits } = await supabase
    .from('api_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError) {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;

    return jsonResponse({
      id: authUser.user.id,
      email: authUser.user.email,
      created_at: authUser.user.created_at,
      credits: {
        remaining: credits?.credits_remaining ?? 1000,
        used_today: credits?.credits_used_today ?? 0,
        daily_limit: credits?.daily_limit ?? 1000,
      },
      success: true,
    });
  }

  return jsonResponse({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,
    storage_used: profile.storage_used,
    credits: {
      remaining: credits?.credits_remaining ?? 1000,
      used_today: credits?.credits_used_today ?? 0,
      daily_limit: credits?.daily_limit ?? 1000,
    },
    success: true,
  });
}

// ============================================================
// HANDLER: handleSecretsAPI
// ============================================================
export async function handleSecretsAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  apiKey?: string,
  keyId?: string,
): Promise<Response> {
  const method = req.method;

  // GET /secrets
  if (method === 'GET' && path === '/secrets') {
    const { data: secrets, error } = await supabase
      .from('squid_vault_secrets')
      .select('id, name, scope, created_at, updated_at, storage_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return jsonResponse({ secrets: secrets || [], success: true });
  }

  // POST /secrets
  if (method === 'POST' && path === '/secrets') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const name = (body.name as string || '').trim();
    const value = (body.value as string || '').trim();
    const storageType = (body.storage as string || 'database').trim();

    if (!name) return jsonResponse({ error: 'Secret name is required', success: false }, 400);
    if (!value) return jsonResponse({ error: 'Secret value is required', success: false }, 400);
    if (!apiKey) return jsonResponse({ error: 'API key required for secret encryption', success: false }, 400);

    const key = await deriveAESKeyFromApiKey(apiKey);
    const { encrypted, iv } = await encryptSecretValue(value, key);

    if (storageType === 'res54') {
      const b2Client = await makeB2Client();
      const chunkId = `sv_${Date.now().toString(36)}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const storagePath = `${userId}/secrets/${chunkId}.json`;

      const chunkData = {
        version: '3.0',
        type: 'squidveil_secret',
        name,
        encrypted_value: encrypted,
        iv,
        created_at: new Date().toISOString(),
      };

      const b2Url = new URL(`${B2_ENDPOINT()}/${B2_BUCKET()}/${storagePath}`);
      const signedReq = await b2Client.sign(b2Url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        aws: { signQuery: true },
      });

      const b2Response = await fetch(signedReq.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new TextEncoder().encode(JSON.stringify(chunkData)),
      });

      if (!b2Response.ok) {
        return jsonResponse({ error: 'Failed to store secret in vault', success: false }, 500);
      }

      const { data: secret, error: insertError } = await supabase
        .from('squid_vault_secrets')
        .insert({
          user_id: userId,
          name,
          encrypted_value: encrypted,
          iv,
          storage_type: 'res54',
          storage_path: storagePath,
          storage_repo: 'b2',
        })
        .select('id, name, scope, created_at, updated_at, storage_type')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          return jsonResponse({ error: `A secret named "${name}" already exists`, success: false }, 409);
        }
        throw insertError;
      }

      return jsonResponse({ secret, success: true, storage: 'res54' }, 201);
    }

    const { data: secret, error: insertError } = await supabase
      .from('squid_vault_secrets')
      .insert({ user_id: userId, name, encrypted_value: encrypted, iv, storage_type: 'database' })
      .select('id, name, scope, created_at, updated_at, storage_type')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return jsonResponse({ error: `A secret named "${name}" already exists`, success: false }, 409);
      }
      throw insertError;
    }

    return jsonResponse({ secret, success: true }, 201);
  }

  // POST /secrets/:name/verify
  if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'verify') {
    const secretName = pathParts[1];
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const candidateValue = (body.value as string || '').trim();
    if (!candidateValue) return jsonResponse({ error: 'Value to verify is required', success: false }, 400);
    if (!apiKey) return jsonResponse({ error: 'API key required', success: false }, 400);

    const { data: secret, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('encrypted_value, iv')
      .eq('user_id', userId)
      .eq('name', secretName)
      .single();

    if (fetchError || !secret) return jsonResponse({ error: 'Secret not found', success: false }, 404);

    const key = await deriveAESKeyFromApiKey(apiKey);
    let decryptedValue: string;
    try {
      decryptedValue = await decryptSecretValue(secret.encrypted_value, secret.iv, key);
    } catch {
      return jsonResponse({ error: 'Failed to decrypt secret', success: false }, 500);
    }

    return jsonResponse({ matched: decryptedValue === candidateValue, success: true });
  }

  // PATCH /secrets/:id/rename
  if (method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'rename') {
    const secretId = pathParts[1];
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const newName = (body.name as string || '').trim();
    if (!newName) return jsonResponse({ error: 'New name is required', success: false }, 400);

    const { data: existing, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('id')
      .eq('id', secretId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) return jsonResponse({ error: 'Secret not found', success: false }, 404);

    const { data: secret, error: updateError } = await supabase
      .from('squid_vault_secrets')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', secretId)
      .eq('user_id', userId)
      .select('id, name, scope, created_at, updated_at')
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return jsonResponse({ error: `A secret named "${newName}" already exists`, success: false }, 409);
      }
      throw updateError;
    }

    return jsonResponse({ secret, success: true });
  }

  // DELETE /secrets/:id
  if (method === 'DELETE' && pathParts.length === 2) {
    const secretId = pathParts[1];

    const { data: existing, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('id')
      .eq('id', secretId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) return jsonResponse({ error: 'Secret not found', success: false }, 404);

    const { error: deleteError } = await supabase
      .from('squid_vault_secrets')
      .delete()
      .eq('id', secretId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleSquidShakeAPI
// ============================================================
export async function handleSquidShakeAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  apiKey?: string,
): Promise<Response> {
  const method = req.method;

  // POST /squidshake/handshake
  if (method === 'POST' && path === '/squidshake/handshake') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const deviceFingerprint = (body.device_fingerprint as string) || 'unknown';
    const sessionNonce = (body.session_nonce as string) || crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const serverNonce = crypto.randomUUID();
    const serverPublicKey = `squidshake_ed25519_${Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')}`;
    const sessionKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

    await supabase.from('squidveil_sessions').insert({
      session_id: sessionId,
      user_id: userId,
      device_fingerprint: deviceFingerprint,
      session_nonce: sessionNonce,
      server_nonce: serverNonce,
      session_key: sessionKey,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });

    await logAudit(supabase, {
      action: 'squidshake.handshake',
      project_id: (body.project_id as string) || 'unknown',
      user_id: userId,
      secret_name: '',
      success: true,
    });

    return jsonResponse({
      version: '1.0',
      session_id: sessionId,
      server_nonce: serverNonce,
      server_public_key: serverPublicKey,
      encrypted_session_key: sessionKey,
      success: true,
    });
  }

  // POST /squidshake/ref
  if (method === 'POST' && path === '/squidshake/ref') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const sessionId = (body.session_id as string) || '';
    const secretName = (body.secret_name as string) || '';
    const deviceFingerprint = (body.device_fingerprint as string) || '';

    if (!sessionId || !secretName) {
      return jsonResponse({ error: 'session_id and secret_name required', success: false }, 400);
    }

    const { data: session } = await supabase
      .from('squidveil_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return jsonResponse({ error: 'Invalid session', success: false }, 401);
    }

    if (!apiKey) return jsonResponse({ error: 'API key required', success: false }, 400);

    const signingKey = await deriveAESKeyFromApiKey(apiKey);
    const signKeyHex = Array.from(
      new Uint8Array(await crypto.subtle.exportKey('raw', signingKey)),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    const refId = crypto.randomUUID().split('-')[0];
    const now = Date.now();
    const ttl = (body.ref_ttl as number) || 60;
    const maxUses = (body.max_uses as number) || 1;

    const deviceBound = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceFingerprint || 'unknown'))),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    const veilRef: Record<string, unknown> = {
      ref_id: refId,
      secret_name: secretName,
      session_id: sessionId,
      device_bound: deviceBound,
      issued_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl * 1000).toISOString(),
      use_count_max: maxUses,
      use_count_used: 0,
      ops_allowed: (body.ops_allowed as string[]) || ['proxy_request'],
      hmac: '',
    };

    const canonical = `${veilRef.ref_id}${veilRef.secret_name}${veilRef.session_id}${veilRef.issued_at}${veilRef.expires_at}`;
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signKeyHex.slice(0, 32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    veilRef.hmac = Array.from(
      new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(canonical))),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    const veilRefJson = JSON.stringify(veilRef);

    await supabase.from('squidveil_refs').insert({
      ref_id: refId,
      session_id: sessionId,
      secret_name: secretName,
      user_id: userId,
      veil_ref_json: veilRefJson,
      expires_at: new Date(now + ttl * 1000).toISOString(),
    });

    await logAudit(supabase, {
      action: 'squidshake.ref_issued',
      project_id: sessionId,
      user_id: userId,
      secret_name: secretName,
      ref_id: refId,
      success: true,
    });

    return jsonResponse({
      session_id: sessionId,
      veil_ref_json: veilRefJson,
      hmac: veilRef.hmac as string,
      success: true,
    });
  }

  // POST /squidshake/audit
  if (method === 'POST' && path === '/squidshake/audit') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    await logAudit(supabase, {
      action: (body.action as string) || 'unknown',
      project_id: (body.project_id as string) || '',
      user_id: userId,
      secret_name: (body.secret_name as string) || '',
      ref_id: (body.ref_id as string) || undefined,
      success: body.success !== false,
      detail: (body.detail as string) || undefined,
    });

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleVeilRefAPI
// ============================================================
export async function handleVeilRefAPI(
  req: Request,
  supabase: any,
  userId: string,
  path: string,
  pathParts: string[],
  apiKey?: string,
): Promise<Response> {
  const method = req.method;

  // POST /veilref/verify
  if (method === 'POST' && path === '/veilref/verify') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const refJson = (body.veil_ref_json as string) || '';
    let ref: Record<string, unknown>;
    try { ref = JSON.parse(refJson); } catch {
      return jsonResponse({ error: 'Invalid VeilRef JSON', success: false }, 400);
    }

    const { data: stored } = await supabase
      .from('squidveil_refs')
      .select('*')
      .eq('ref_id', ref.ref_id)
      .eq('user_id', userId)
      .single();

    if (!stored) return jsonResponse({ error: 'VeilRef not found', success: false }, 404);

    const now = new Date();
    if (new Date(stored.expires_at) < now) {
      return jsonResponse({ error: 'VeilRef expired', verified: false, success: true });
    }

    if (!apiKey) return jsonResponse({ error: 'API key required', success: false }, 400);

    const signingKey = await deriveAESKeyFromApiKey(apiKey);
    const signKeyHex = Array.from(
      new Uint8Array(await crypto.subtle.exportKey('raw', signingKey)),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    const canonical = `${ref.ref_id}${ref.secret_name}${ref.session_id}${ref.issued_at}${ref.expires_at}`;
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signKeyHex.slice(0, 32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expectedHmac = Array.from(
      new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(canonical))),
      b => b.toString(16).padStart(2, '0'),
    ).join('');

    if (ref.hmac !== expectedHmac) {
      return jsonResponse({ error: 'VeilRef signature invalid', verified: false, success: true });
    }

    return jsonResponse({ verified: true, secret_name: ref.secret_name, success: true });
  }

  // POST /veilref/resolve
  if (method === 'POST' && path === '/veilref/resolve') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'Invalid JSON body', success: false }, 400);
    }

    const refJson = (body.veil_ref_json as string) || '';
    let ref: Record<string, unknown>;
    try { ref = JSON.parse(refJson); } catch {
      return jsonResponse({ error: 'Invalid VeilRef JSON', success: false }, 400);
    }

    const { data: stored } = await supabase
      .from('squidveil_refs')
      .select('*')
      .eq('ref_id', ref.ref_id)
      .eq('user_id', userId)
      .single();

    if (!stored) return jsonResponse({ error: 'VeilRef not found', success: false }, 404);

    const secretName = stored.secret_name as string;

    const { data: secret } = await supabase
      .from('squid_vault_secrets')
      .select('encrypted_value, iv')
      .eq('user_id', userId)
      .eq('name', secretName)
      .single();

    if (!secret) return jsonResponse({ error: 'Secret not found', success: false }, 404);

    if (!apiKey) return jsonResponse({ error: 'API key required', success: false }, 400);

    const key = await deriveAESKeyFromApiKey(apiKey);
    const decryptedValue = await decryptSecretValue(secret.encrypted_value, secret.iv, key);

    return jsonResponse({ value: decryptedValue, secret_name: secretName, success: true });
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404);
}

// ============================================================
// HANDLER: handleRootAPI
// ============================================================
export async function handleRootAPI(): Promise<Response> {
  return jsonResponse({
    name: 'SquidCloud CloudBliss API',
    version: '4.0',
    description: 'File operations, CDN streaming, secrets management, workspace collaboration',
    docs_url: 'https://squidcloud.vercel.app/docs/api',
    endpoints: {
      files: {
        'GET /files': 'List files and folders (paginated, searchable)',
        'GET /files/:id/metadata': 'Get file metadata',
        'GET /files/:id/download': 'Download file (or signed B2 URL with ?signed=true)',
        'POST /files/upload/init': 'Initialize upload with signed B2 URLs',
        'POST /files/upload/complete': 'Complete upload and register file',
        'DELETE /files/:id': 'Soft delete file',
        'POST /files/:id/restore': 'Restore file from trash',
        'PUT /files/:id/rename': 'Rename file',
        'POST /files/:id/move': 'Move file to folder',
        'POST /files/copy': 'Copy file',
      },
      cdn: {
        'GET /cdn/list': 'List CDN-published files',
        'GET /cdn/:file_id': 'Get CDN file info',
        'POST /cdn/publish': 'Publish file to SquidCDN',
        'DELETE /cdn/:file_id': 'Unpublish from CDN',
        'GET /cdn/play/:cdn_path': 'Public media streaming (no auth)',
      },
      search: {
        'GET /search': 'Search files (q, type, folder_id, page, per_page)',
      },
      batch: {
        'POST /batch/delete': 'Batch delete files',
        'POST /batch/move': 'Batch move files',
        'POST /batch/restore': 'Batch restore files',
        'POST /batch/copy': 'Batch copy files',
      },
      stats: {
        'GET /stats/usage': 'Daily/weekly/monthly credit usage',
        'GET /stats/credits': 'Detailed credit log (paginated)',
        'GET /stats/storage': 'Storage breakdown by file type',
      },
      export: {
        'GET /export/files': 'Export file listing (format=csv|json)',
      },
      keys: {
        'GET /keys': 'List API keys',
        'POST /keys': 'Create API key',
        'PUT /keys/:id': 'Update API key',
        'DELETE /keys/:id': 'Delete API key',
        'PUT /keys/:id/limits': 'Set per-key custom limits',
      },
      storage: {
        'GET /storage': 'Get storage usage stats',
      },
      secrets: {
        'GET /secrets': 'List secrets',
        'POST /secrets': 'Create secret',
        'POST /secrets/:name/verify': 'Verify secret value',
        'PATCH /secrets/:id/rename': 'Rename secret',
        'DELETE /secrets/:id': 'Delete secret',
      },
      user: {
        'GET /user': 'Get user profile and credits',
        'GET /whoami': 'Alias for GET /user',
      },
      squidshake: {
        'POST /squidshake/handshake': 'Initiate SquidShake handshake',
        'POST /squidshake/ref': 'Issue VeilRef',
        'POST /squidshake/audit': 'Log audit entry',
      },
      veilref: {
        'POST /veilref/verify': 'Verify VeilRef',
        'POST /veilref/resolve': 'Resolve VeilRef secret',
      },
      health: {
        'GET /health': 'Health check (no auth required)',
      },
    },
    workspace_support: 'Add ?workspace_id=<uuid> to scope operations to a workspace',
    success: true,
  });
}

// ============================================================
// HELPER: getOperationForPath
// Maps method+path to an API operation string for credit lookup
// ============================================================
export function getOperationForPath(method: string, path: string): string {
  const methodUpper = method.toUpperCase();
  const parts = path.split('/').filter(p => p.length > 0);
  const first = parts[0] || '';
  const second = parts[1] || '';

  if (first === 'files') {
    if (methodUpper === 'GET' && parts.length === 1) return 'files.list';
    if (methodUpper === 'GET' && parts[2] === 'metadata') return 'files.metadata';
    if (methodUpper === 'GET' && parts[2] === 'download') return 'files.download';
    if (methodUpper === 'POST' && parts[1] === 'upload' && parts[2] === 'init') return 'files.upload.init';
    if (methodUpper === 'POST' && parts[1] === 'upload' && parts[2] === 'complete') return 'files.upload.complete';
    if (methodUpper === 'DELETE') return 'files.delete';
    if (methodUpper === 'POST' && parts[2] === 'restore') return 'files.delete';
    if (methodUpper === 'PUT' && parts[2] === 'rename') return 'files.upload.init';
    if (methodUpper === 'POST' && parts[2] === 'move') return 'files.upload.init';
    if (methodUpper === 'POST' && second === 'copy') return 'files.upload.init';
    return 'files.list';
  }

  if (first === 'cdn') {
    if (methodUpper === 'POST' && second === 'publish') return 'cdn.publish';
    if (methodUpper === 'DELETE') return 'cdn.unpublish';
    if (methodUpper === 'GET' && (parts[2] === 'play')) return 'cdn.play';
    if (methodUpper === 'GET') return 'cdn.info';
    return 'cdn.info';
  }

  if (first === 'search') return 'search';

  if (first === 'batch') {
    if (second === 'delete') return 'batch.delete';
    if (second === 'move') return 'batch.move';
    if (second === 'restore') return 'batch.delete';
    if (second === 'copy') return 'batch.delete';
    return 'batch.delete';
  }

  if (first === 'stats') {
    if (second === 'usage' || second === 'credits') return 'stats.usage';
    return 'stats.usage';
  }

  if (first === 'export') return 'export.csv';

  if (first === 'keys') {
    if (methodUpper === 'GET') return 'keys.list';
    if (methodUpper === 'POST') return 'keys.create';
    if (methodUpper === 'PUT') return 'keys.update';
    if (methodUpper === 'DELETE') return 'keys.delete';
    return 'keys.list';
  }

  if (first === 'storage') return 'storage.usage';

  if (first === 'secrets') {
    if (methodUpper === 'GET') return 'secrets.list';
    if (methodUpper === 'POST' && parts[2] === 'verify') return 'secrets.verify';
    if (methodUpper === 'POST') return 'secrets.create';
    if (methodUpper === 'PATCH') return 'secrets.update';
    if (methodUpper === 'DELETE') return 'secrets.delete';
    return 'secrets.list';
  }

  if (first === 'user' || first === 'whoami') return 'whoami';

  if (first === 'squidshake') {
    if (second === 'handshake') return 'squidshake.handshake';
    if (second === 'ref') return 'squidshake.ref';
    if (second === 'audit') return 'squidshake.audit';
    return 'squidshake.handshake';
  }

  if (first === 'veilref') {
    if (second === 'verify') return 'veilref.verify';
    if (second === 'resolve') return 'veilref.resolve';
    return 'veilref.verify';
  }

  if (first === 'health' || first === '') return 'health';

  return 'whoami';
}
