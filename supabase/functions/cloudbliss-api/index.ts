
// CloudBliss API v2.0 - File Operations API
// Deployed: 2025-10-05
// CloudBliss API v3.0 - Full file management with RES54 encryption
// Updated: 2025-10-05 - Added RES54 encryption/decryption support
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cip, x-f2fa, x-prel-token, x-prel-session, x-prel-op, x-prel-long-op, x-kza-session, x-squidcloud-key, x-squidcloud-encryption-key, x-encryption-key',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, PATCH, OPTIONS',
}

function getCorsHeaders() { return CORS_HEADERS }

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

// RES54 Configuration
const MAX_PARALLEL_OPERATIONS = 3
const MAX_RETRIES = 8
const RETRY_DELAY_BASE = 1000
const CHUNK_SIZE_SMALL = 512 * 1024  // 512KB
const CHUNK_SIZE_MEDIUM = 1 * 1024 * 1024  // 1MB
const CHUNK_SIZE_LARGE = 2 * 1024 * 1024  // 2MB
const LARGE_FILE_THRESHOLD = 128 * 1024 * 1024 // 128MB

console.log('CloudBliss API v3.0 loaded with RES54 encryption')

function getOptionalEncryptionKey(req: Request, queryParams?: URLSearchParams): string | null {
  const headerKey = req.headers.get('x-squidcloud-encryption-key') || req.headers.get('x-encryption-key')
  const queryKey = queryParams?.get('encryption_key') || queryParams?.get('encryptionKey')
  const value = (headerKey || queryKey || '').trim()
  return value.length > 0 ? value : null
}

function validateEncryptionKeyFormat(key: string): boolean {
  return key.length >= 8 && key.length <= 512
}

// Encryption/Decryption utilities (matching frontend format)
async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const exported = await crypto.subtle.exportKey('raw', key)
  return Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function encryptData(data: ArrayBuffer, key: string): Promise<string> {
  // Match frontend encryption format exactly
  const keyBytes = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  // Add AEAD additional data for integrity (matching frontend)
  const additionalData = new TextEncoder().encode(`res54-v2-${Date.now()}`)
  
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    keyBuffer,
    data
  )

  // Combine in frontend format: [4 bytes dataLength][additionalData][IV][encrypted content]
  const combined = new Uint8Array(iv.length + encryptedContent.byteLength + additionalData.length + 4)
  
  // Store additionalData length as first 4 bytes (little-endian)
  const dataLengthView = new DataView(combined.buffer, 0, 4)
  dataLengthView.setUint32(0, additionalData.length, true)
  
  // Copy additionalData after length
  combined.set(additionalData, 4)
  
  // Copy IV after additionalData
  combined.set(iv, 4 + additionalData.length)
  
  // Copy encrypted content after IV
  combined.set(new Uint8Array(encryptedContent), 4 + additionalData.length + iv.length)
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined))
}

async function decryptData(encryptedData: string, key: string): Promise<ArrayBuffer> {
  // Match frontend decryption format exactly
  const binaryData = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  
  // Read additionalData length (first 4 bytes, little-endian)
  const dataLengthView = new DataView(binaryData.buffer, 0, 4)
  const additionalDataLength = dataLengthView.getUint32(0, true)
  
  // Extract additionalData
  const additionalData = binaryData.slice(4, 4 + additionalDataLength)
  
  // Extract IV (12 bytes after additionalData)
  const iv = binaryData.slice(4 + additionalDataLength, 4 + additionalDataLength + 12)
  
  // Extract encrypted content (everything after IV)
  const encryptedContent = binaryData.slice(4 + additionalDataLength + 12)
  
  // Import key
  const keyBytes = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'))
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  
  // Decrypt
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData },
    keyBuffer,
    encryptedContent
  )
}

async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function backoffDelay(attempt: number): number {
  return Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), 30000)
}

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const ROLE_RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 }

async function requireWorkspaceRole(supabase: any, workspaceId: string, userId: string, minRole: string): Promise<{ allowed: boolean; role: string | null }> {
  const { data: role, error } = await supabase.rpc('get_workspace_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  })
  if (error || !role) return { allowed: false, role: null }
  const userRank = ROLE_RANK[role as string] || 0
  const minRank = ROLE_RANK[minRole] || 0
  return { allowed: userRank >= minRank, role }
}

async function resolveWorkspaceId(supabase: any, userId: string, workspaceId?: string): Promise<string | null> {
  if (workspaceId) return workspaceId
  const { data, error } = await supabase.rpc('get_or_create_default_workspace', { p_user_id: userId })
  if (error || !data) return null
  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  console.log('CloudBliss API function invoked');

  let supabase: any
  let keyData: any = null

  try {
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = req.headers.get('x-squidcloud-key') || 
                   req.headers.get('X-SquidCloud-Key') || 
                   req.headers.get('Authorization')?.replace('Bearer ', '')

    console.log('CloudBliss API request received', {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : 'none',
      method: req.method,
      pathname: new URL(req.url).pathname,
    })

    if (!apiKey) {
      return jsonResponse({ 
        error: 'SquidCloud API key required. Include it in X-SquidCloud-Key header.',
        success: false,
        code: 401,
        message: 'Missing authorization header'
      }, 401)
    }

    const keyPrefix = apiKey.substring(0, 8)

    const { data: candidateKeys, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, is_active, scopes, key_hash, key_salt')
      .eq('key_prefix', keyPrefix)
      .eq('is_active', true)

    if (keyError || !candidateKeys || candidateKeys.length === 0) {
      return jsonResponse({ 
        error: 'Invalid SquidCloud API key',
        success: false 
      }, 401)
    }

    const encoder = new TextEncoder()

    for (const candidate of candidateKeys) {
      const saltBase64 = candidate.key_salt || ''
      const saltBytes = saltBase64 ? Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)) : new Uint8Array(0)
      const apiKeyBytes = encoder.encode(apiKey)
      const combined = new Uint8Array(saltBytes.length + apiKeyBytes.length)
      combined.set(saltBytes)
      combined.set(apiKeyBytes, saltBytes.length)
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      if (computedHash === candidate.key_hash) {
        keyData = candidate
        break
      }
    }

    if (!keyData) {
      return jsonResponse({ 
        error: 'Invalid SquidCloud API key',
        success: false 
      }, 401)
    }

    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyData.key_hash)

    const url = new URL(req.url)
    const workspaceId = url.searchParams.get('workspace_id') || undefined

    let path = url.pathname
      .replace('/cloudbliss-api', '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')

    if (!path || path === '') path = '/'

    const pathParts = path.split('/').filter(p => p.length > 0)
    const firstPathSegment = pathParts[0] || ''

    const startTime = Date.now()
    let apiResponse: Response
    let apiError = ''
    const logMeta: { reqFileName: string | null; reqFileSize: number | null } = { reqFileName: null, reqFileSize: null }

    try {
      if (firstPathSegment === 'files') {
        apiResponse = await handleFilesAPI(req, supabase, keyData.user_id, path, workspaceId, logMeta)
      } else if (firstPathSegment === 'keys') {
        apiResponse = await handleKeysAPI(req, supabase, keyData.user_id, path)
      } else if (firstPathSegment === 'storage') {
        apiResponse = await handleStorageAPI(req, supabase, keyData.user_id, workspaceId)
      } else if (firstPathSegment === 'secrets') {
        apiResponse = await handleSecretsAPI(req, supabase, keyData.user_id, path, apiKey, keyData.id)
      } else if (firstPathSegment === 'user' || firstPathSegment === 'whoami') {
        apiResponse = await handleUserAPI(req, supabase, keyData.user_id)
      } else if (firstPathSegment === 'squidshake') {
        apiResponse = await handleSquidShakeAPI(req, supabase, keyData.user_id, path, apiKey)
      } else if (firstPathSegment === 'veilref') {
        apiResponse = await handleVeilRefAPI(req, supabase, keyData.user_id, path, apiKey)
      } else {
        apiResponse = jsonResponse({ 
          message: 'SquidCloud API v2.5 — SquidVeil',
          version: '2.5',
          endpoints: ['/files', '/keys', '/storage', '/secrets', '/user', '/whoami', '/squidshake', '/veilref'],
          workspace_support: 'Add ?workspace_id=<uuid> to scope operations to a workspace',
          success: true 
        })
      }
    } catch (error) {
      console.error('SquidCloud API handler error:', error)
      apiError = error instanceof Error ? error.message : 'Internal server error'
      apiResponse = jsonResponse({ error: apiError, success: false }, 500)
    } finally {
      try {
        await supabase.from('api_request_logs').insert({
          api_key_id: keyData.id,
          user_id: keyData.user_id,
          endpoint: url.pathname,
          method: req.method,
          ip_address: req.headers.get('x-forwarded-for') || null,
          user_agent: req.headers.get('user-agent') || null,
          status_code: apiResponse.status,
          response_time_ms: Date.now() - startTime,
          error_message: apiError || null,
          file_name: logMeta.reqFileName,
          file_size: logMeta.reqFileSize,
        })
      } catch (logError) {
        console.error('Failed to log API request:', logError)
      }
    }

    return apiResponse

  } catch (error) {
    console.error('SquidCloud API Error:', error)
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      success: false 
    }, 500)
  }
});

async function handleFilesAPI(req: Request, supabase: any, userId: string, path: string, workspaceId?: string, logMeta?: { reqFileName: string | null; reqFileSize: number | null }): Promise<Response> {
  const method = req.method
  
  const wsId = await resolveWorkspaceId(supabase, userId, workspaceId)
  if (!wsId) {
    return jsonResponse({ error: 'No workspace found', success: false }, 400)
  }
  
  const viewerCheck = await requireWorkspaceRole(supabase, wsId, userId, 'viewer')
  const editorCheck = viewerCheck.allowed ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.editor, role: viewerCheck.role } : { allowed: false, role: null }
  const adminCheck = viewerCheck.allowed ? { allowed: ROLE_RANK[(viewerCheck.role || 'viewer')] >= ROLE_RANK.admin, role: viewerCheck.role } : { allowed: false, role: null }
  
  if (!viewerCheck.allowed) {
    return jsonResponse({ error: 'Insufficient workspace permissions', success: false, code: 403 }, 403)
  }
  
  if (method === 'GET' && path === '/files') {
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('workspace_id', wsId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false })

    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })

    if (filesError || foldersError) {
      throw filesError || foldersError
    }

    return jsonResponse({ 
      files: files || [], 
      folders: folders || [],
      total_files: files?.length || 0,
      total_folders: folders?.length || 0,
      success: true 
    })
  }
  
  if (method === 'GET' && path.match(/^\/files\/[a-f0-9-]+\/metadata$/)) {
    const fileId = path.split('/')[2]
    
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single()

    if (error || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404)
    }

    return jsonResponse({ file, success: true })
  }

  if (method === 'GET' && path.match(/^\/files\/[a-f0-9-]+\/download$/)) {
    const fileId = path.split('/')[2]
    const providedEncryptionKey = getOptionalEncryptionKey(req, new URL(req.url).searchParams)

    if (providedEncryptionKey && !validateEncryptionKeyFormat(providedEncryptionKey)) {
      return jsonResponse({
        error: 'Invalid encryption key format',
        success: false,
        code: 400,
      }, 400)
    }
    
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single()

    if (fileError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404)
    }

    if (logMeta) { logMeta.reqFileName = file.name; logMeta.reqFileSize = file.size }

    if (file.storage_path === 'res54_distributed' && file.encrypted) {
      let metadata
      try {
        metadata = Array.isArray(file.tags) && file.tags.length > 0 
          ? JSON.parse(file.tags[0])
          : null
      } catch (e) {
        return jsonResponse({ error: 'Invalid file metadata', success: false }, 500)
      }

      if (!metadata || !metadata.chunks) {
        return jsonResponse({ error: 'File metadata not found', success: false }, 500)
      }

      const isBYOK = file.encryption_key === 'sha256:byok_encrypted'
        || metadata.encryptionKey === 'sha256:byok_encrypted'
        || metadata.encryptionKey === 'byok_encrypted'
        || metadata.encryptionKey === 'byok_protected'
        || metadata.encryptionKey === null
        || metadata.encryptionKey === ''

      let decryptionKey = providedEncryptionKey
      if (!decryptionKey) {
        if (isBYOK) {
          return jsonResponse({
            error: 'This file uses Bring Your Own Key (BYOK). Provide the encryption key via encryption_key parameter.',
            success: false,
            code: 422,
          }, 422)
        }
        decryptionKey = metadata.encryptionKey || file.encryption_key
      }

      if (!decryptionKey) {
        return jsonResponse({ error: 'Encryption key missing for encrypted file', success: false, code: 422 }, 422)
      }

      console.log(`[cloudbliss] Download file: id="${fileId}", isBYOK=${isBYOK}, providedKey=${!!providedEncryptionKey}, decryptionKeyPrefix="${decryptionKey.substring(0, 8)}..."`)
      console.log(`[cloudbliss] metadata keys:`, Object.keys(metadata).join(','))
      console.log(`[cloudbliss] metadata.encryptionKey present: ${!!metadata.encryptionKey}`)
      console.log(`[cloudbliss] file.encryption_key: "${file.encryption_key}"`)

      const chunks: ArrayBuffer[] = []
      for (const chunkMeta of metadata.chunks) {
        try {
          const nodeId = chunkMeta.accountId ?? 0
          console.log(`[cloudbliss] Calling github-storage download: userId="${userId}", path="${chunkMeta.path}", repo="${chunkMeta.repo}", nodeId=${nodeId}`)
          const response = await supabase.functions.invoke('github-storage', {
            body: { action: 'download', path: chunkMeta.path, repo: chunkMeta.repo, userId, nodeId }
          })
          console.log(`[cloudbliss] github-storage response:`, JSON.stringify(response).slice(0, 200))

          if (response.error) {
            const errDetail = typeof response.error === 'object' ? (response.error.message || response.error.context || JSON.stringify(response.error)) : String(response.error)
            throw new Error(`Failed to download chunk ${chunkMeta.index}: ${errDetail}`)
          }

          if (!response.data?.content) {
            throw new Error(`Empty content from storage for chunk ${chunkMeta.index} — file may not exist on GitHub`)
          }

          const cleanContent = response.data.content.replace(/\s/g, '')
          const decodedContent = atob(cleanContent)
          const parsedChunk = JSON.parse(decodedContent)

          const decryptedChunk = await decryptData(parsedChunk.chunkData, decryptionKey)
          chunks.push(decryptedChunk)
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error(`Error processing chunk ${chunkMeta.index}:`, errMsg)
          console.error(`[cloudbliss] decryptionKey used: "${decryptionKey ? decryptionKey.substring(0, 8) + '...' : 'null'}"`)
          console.error(`[cloudbliss] chunkMeta:`, JSON.stringify(chunkMeta))

          const errMsg = error instanceof Error ? error.message : String(error)
          if (errMsg.includes('Empty content from storage')) {
            return jsonResponse({ error: errMsg, success: false }, 404)
          }

          if (error instanceof DOMException && error.name === 'OperationError') {
            return jsonResponse({
              error: 'Provided encryption key mismatch. Unable to decrypt file.',
              success: false,
              code: 422,
            }, 422)
          }

          if (errMsg.includes('key mismatch') || errMsg.includes('decrypt')) {
            return jsonResponse({
              error: 'Provided encryption key mismatch. Unable to decrypt file.',
              success: false,
              code: 422,
            }, 422)
          }

          return jsonResponse({ error: `Failed to process chunk ${chunkMeta.index}: ${errMsg}`, success: false }, 500)
        }
      }

      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      const combined = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength
      }

      return new Response(combined, {
        headers: {
          ...getCorsHeaders(),
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.name}"`,
        }
      })
    } else {
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('files')
        .download(file.storage_path)

      if (downloadError) {
        throw downloadError
      }

      return new Response(fileData, {
        headers: {
          ...getCorsHeaders(),
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.name}"`,
        }
      })
    }
  }
  
  if (method === 'POST' && path === '/files/upload') {
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to upload files', success: false, code: 403 }, 403)
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const folderId = formData.get('folderId') as string | null
    const formEncryptionKey = (formData.get('encryption_key') || formData.get('encryptionKey')) as string | null
    const headerEncryptionKey = getOptionalEncryptionKey(req)
    const providedEncryptionKey = (formEncryptionKey || headerEncryptionKey || '').trim() || null
    
    if (!file) {
      return jsonResponse({ error: 'No file provided', success: false }, 400)
    }

    if (providedEncryptionKey && !validateEncryptionKeyFormat(providedEncryptionKey)) {
      return jsonResponse({
        error: 'Invalid encryption key format',
        success: false,
        code: 400,
      }, 400)
    }

    if (logMeta) { logMeta.reqFileName = file.name; logMeta.reqFileSize = file.size }
    const fileName = file.name
    const fileSize = file.size
    const fileType = file.type

    const { data: repos } = await supabase
      .from('repositories')
      .select('repo_name')
      .eq('user_id', userId)

    if (!repos?.length) {
      return jsonResponse({ error: 'Please create a Storage Vault before uploading files', success: false }, 400)
    }

    const encryptionKey = providedEncryptionKey || await generateEncryptionKey()

    let chunkSize = CHUNK_SIZE_SMALL
    if (fileSize > 10 * 1024 * 1024) {
      chunkSize = CHUNK_SIZE_MEDIUM
    }
    if (fileSize > 50 * 1024 * 1024) {
      chunkSize = CHUNK_SIZE_LARGE
    }

    const fileBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(fileBuffer)

    const chunks: ArrayBuffer[] = []
    const chunkMetadata: any[] = []
    let offset = 0

    while (offset < fileSize) {
      const end = Math.min(offset + chunkSize, fileSize)
      const chunk = fileData.slice(offset, end)
      chunks.push(chunk.buffer)

      chunkMetadata.push({
        index: chunks.length - 1,
        totalChunks: Math.ceil(fileSize / chunkSize),
        size: chunk.length,
        offset,
        sha256: await calculateSHA256(chunk)
      })

      offset = end
    }

    const uploadedChunks: any[] = []
    for (let i = 0; i < chunks.length; i++) {
      try {
        const encryptedChunk = await encryptData(chunks[i], encryptionKey)

        const repoIndex = i % repos.length
        const repo = repos[repoIndex].repo_name
        const chunkId = `res54_${Date.now().toString(36)}_${i}`
        const path = `${userId}/${chunkId}.json`

        const chunkData = {
          version: '3.0',
          chunkIndex: i,
          totalChunks: chunks.length,
          fileName,
          fileType,
          fileSize,
          chunkData: encryptedChunk,
          chunkSize: encryptedChunk.length,
          checksum: await calculateSHA256(new TextEncoder().encode(encryptedChunk)),
          repo,
          path
        }

        const response = await supabase.functions.invoke('github-storage', {
          body: {
            action: 'upload',
            fileName: `${chunkId}.json`,
            fileType: 'application/json',
            data: JSON.stringify(chunkData),
            userId,
            path,
            repo
          }
        })

        if (response.error) {
          throw new Error(`Failed to upload chunk ${i}: ${response.error.message}`)
        }

        chunkMetadata[i].repo = repo
        chunkMetadata[i].path = path
        uploadedChunks.push({ index: i, repo, path })
      } catch (error) {
        console.error(`Error uploading chunk ${i}:`, error)
        return jsonResponse({ error: `Failed to upload chunk ${i}`, success: false }, 500)
      }
    }

    const metadata = {
      fileName,
      fileType,
      fileSize,
      chunks: chunkMetadata,
      encryptionKey: providedEncryptionKey ? 'sha256:byok_encrypted' : encryptionKey,
      created: new Date().toISOString(),
      previewAvailable: false
    }

    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        user_id: userId,
        name: fileName,
        type: fileType,
        size: fileSize,
        storage_path: 'res54_distributed',
        parent_folder: folderId || null,
        workspace_id: wsId,
        encrypted: true,
        encryption_key: providedEncryptionKey ? 'sha256:byok_encrypted' : encryptionKey,
        tags: [JSON.stringify(metadata)],
        is_deleted: false
      })
      .select()
      .single()

    if (fileError) {
      console.error('Database error:', fileError)
      return jsonResponse({ error: 'Failed to create file record', success: false }, 500)
    }

    return jsonResponse({ 
      file: fileRecord, 
      success: true,
      message: 'File uploaded and encrypted successfully',
      encryption: {
        mode: providedEncryptionKey ? 'provided' : 'generated',
        key_required_for_download: true,
      },
    }, 201)
  }

  if (method === 'DELETE' && path.match(/^\/files\/[a-f0-9-]+$/)) {
    const fileId = path.split('/')[2]
    
    if (!editorCheck.allowed) {
      return jsonResponse({ error: 'Editor role required to delete files', success: false, code: 403 }, 403)
    }

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('workspace_id', wsId)
      .single()

    if (fetchError || !file) {
      return jsonResponse({ error: 'File not found', success: false }, 404)
    }

    if (!adminCheck.allowed && file.user_id !== userId) {
      return jsonResponse({ error: 'Cannot delete another user\'s file', success: false, code: 403 }, 403)
    }

    const { error: deleteError } = await supabase
      .from('files')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', fileId)

    if (deleteError) throw deleteError

    return jsonResponse({ 
      success: true,
      message: 'File deleted successfully'
    })
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404)
}

async function handleKeysAPI(req: Request, supabase: any, userId: string, path: string): Promise<Response> {
  if (req.method === 'GET' && path === '/keys') {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return jsonResponse({ keys, success: true })
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404)
}

async function handleStorageAPI(req: Request, supabase: any, userId: string, workspaceId?: string): Promise<Response> {
  const wsId = await resolveWorkspaceId(supabase, userId, workspaceId)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('storage_used')
    .eq('id', userId)
    .single()

  if (error) throw error

  const filesQuery = supabase.from('files').select('size')
  if (wsId) {
    filesQuery.eq('workspace_id', wsId)
  } else {
    filesQuery.eq('user_id', userId)
  }
  const { data: files, error: filesError } = await filesQuery

  if (filesError) throw filesError

  const totalFiles = files.length
  const totalSize = files.reduce((sum: number, file: any) => sum + file.size, 0)

  return jsonResponse({ 
    storage_used: profile.storage_used,
    total_files: totalFiles,
    total_size: totalSize,
    success: true 
  })
}

async function handleUserAPI(req: Request, supabase: any, userId: string): Promise<Response> {
  if (req.method === 'GET') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, storage_used')
      .eq('id', userId)
      .single()

    if (profileError) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
      
      if (authError) throw authError
      
      return jsonResponse({ 
        id: authUser.user.id,
        email: authUser.user.email,
        created_at: authUser.user.created_at,
        success: true 
      })
    }

    return jsonResponse({ 
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      created_at: profile.created_at,
      storage_used: profile.storage_used,
      success: true 
    })
  }

  return jsonResponse({ error: 'Method not allowed', success: false }, 405)
}

async function deriveAESKeyFromApiKey(apiKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey))
  return crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function encryptSecretValue(plaintext: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const encryptedBytes = new Uint8Array(encrypted)
  return {
    encrypted: btoa(String.fromCharCode(...encryptedBytes)),
    iv: btoa(String.fromCharCode(...iv))
  }
}

async function decryptSecretValue(encryptedB64: string, ivB64: string, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const encryptedBytes = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes)
  return new TextDecoder().decode(decrypted)
}

async function handleSecretsAPI(req: Request, supabase: any, userId: string, path: string, apiKey: string, keyId?: string): Promise<Response> {
  const method = req.method
  const pathParts = path.split('/').filter(p => p.length > 0)

  if (method === 'GET' && path === '/secrets') {
    const { data: secrets, error } = await supabase
      .from('squid_vault_secrets')
      .select('id, name, scope, created_at, updated_at, storage_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return jsonResponse({ secrets: secrets || [], success: true })
  }

  if (method === 'POST' && path === '/secrets') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const name = (body.name as string || '').trim()
    const value = (body.value as string || '').trim()
    const storageType = (body.storage as string || 'database').trim()

    if (!name) return jsonResponse({ error: 'Secret name is required', success: false }, 400)
    if (!value) return jsonResponse({ error: 'Secret value is required', success: false }, 400)

    const key = await deriveAESKeyFromApiKey(apiKey)
    const { encrypted, iv } = await encryptSecretValue(value, key)

    if (storageType === 'res54') {
      const { data: repos } = await supabase
        .from('repositories')
        .select('repo_name')
        .eq('user_id', userId)

      if (!repos?.length) {
        return jsonResponse({ error: 'Create a Storage Vault before using RES54 storage', success: false }, 400)
      }

      const repoIndex = Math.floor(Math.random() * repos.length)
      const repo = repos[repoIndex].repo_name
      const chunkId = `sv_${Date.now().toString(36)}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      const storagePath = `${userId}/secrets/${chunkId}.json`

      const chunkData = {
        version: '3.0',
        type: 'squidveil_secret',
        name,
        encrypted_value: encrypted,
        iv,
        created_at: new Date().toISOString(),
      }

      const response = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: `${chunkId}.json`,
          fileType: 'application/json',
          data: JSON.stringify(chunkData),
          userId,
          path: storagePath,
          repo,
        },
      })

      if (response.error) {
        return jsonResponse({ error: 'Failed to store secret in vault', success: false }, 500)
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
          storage_repo: repo,
        })
        .select('id, name, scope, created_at, updated_at, storage_type')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          return jsonResponse({ error: `A secret named "${name}" already exists`, success: false }, 409)
        }
        throw insertError
      }

      return jsonResponse({ secret, success: true, storage: 'res54' }, 201)
    }

    const { data: secret, error: insertError } = await supabase
      .from('squid_vault_secrets')
      .insert({ user_id: userId, name, encrypted_value: encrypted, iv, storage_type: 'database' })
      .select('id, name, scope, created_at, updated_at, storage_type')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return jsonResponse({ error: `A secret named "${name}" already exists`, success: false }, 409)
      }
      throw insertError
    }

    return jsonResponse({ secret, success: true }, 201)
  }

  if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'verify') {
    const secretName = pathParts[1]
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const candidateValue = (body.value as string || '').trim()
    if (!candidateValue) return jsonResponse({ error: 'Value to verify is required', success: false }, 400)

    const { data: secret, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('encrypted_value, iv')
      .eq('user_id', userId)
      .eq('name', secretName)
      .single()

    if (fetchError || !secret) return jsonResponse({ error: 'Secret not found', success: false }, 404)

    const key = await deriveAESKeyFromApiKey(apiKey)
    let decryptedValue: string
    try {
      decryptedValue = await decryptSecretValue(secret.encrypted_value, secret.iv, key)
    } catch {
      return jsonResponse({ error: 'Failed to decrypt secret', success: false }, 500)
    }

    return jsonResponse({ matched: decryptedValue === candidateValue, success: true })
  }

  if (method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'rename') {
    const secretId = pathParts[1]
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const newName = (body.name as string || '').trim()
    if (!newName) return jsonResponse({ error: 'New name is required', success: false }, 400)

    const { data: existing, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('id')
      .eq('id', secretId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existing) return jsonResponse({ error: 'Secret not found', success: false }, 404)

    const { data: secret, error: updateError } = await supabase
      .from('squid_vault_secrets')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', secretId)
      .eq('user_id', userId)
      .select('id, name, scope, created_at, updated_at')
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return jsonResponse({ error: `A secret named "${newName}" already exists`, success: false }, 409)
      }
      throw updateError
    }

    return jsonResponse({ secret, success: true })
  }

  if (method === 'DELETE' && pathParts.length === 2) {
    const secretId = pathParts[1]

    const { data: existing, error: fetchError } = await supabase
      .from('squid_vault_secrets')
      .select('id')
      .eq('id', secretId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existing) return jsonResponse({ error: 'Secret not found', success: false }, 404)

    const { error: deleteError } = await supabase
      .from('squid_vault_secrets')
      .delete()
      .eq('id', secretId)
      .eq('user_id', userId)

    if (deleteError) throw deleteError
    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404)
}

async function logAudit(supabase: any, entry: {
  action: string; project_id: string; user_id: string; secret_name: string;
  ref_id?: string; success: boolean; detail?: string
}) {
  try {
    await supabase.from('squidveil_audit_log').insert({
      action: entry.action,
      project_id: entry.project_id,
      user_id: entry.user_id,
      secret_name: entry.secret_name,
      ref_id: entry.ref_id || null,
      success: entry.success,
      detail: entry.detail || null,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

async function handleSquidShakeAPI(req: Request, supabase: any, userId: string, path: string, apiKey: string): Promise<Response> {
  const method = req.method
  const pathParts = path.split('/').filter(p => p.length > 0)

  if (method === 'POST' && pathParts[1] === 'handshake') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const deviceFingerprint = (body.device_fingerprint as string) || 'unknown'
    const sessionNonce = (body.session_nonce as string) || crypto.randomUUID()

    const sessionId = crypto.randomUUID()
    const serverNonce = crypto.randomUUID()
    const serverPublicKey = `squidshake_ed25519_${Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')}`

    const sessionKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('squidveil_sessions').insert({
      session_id: sessionId,
      user_id: userId,
      device_fingerprint: deviceFingerprint,
      session_nonce: sessionNonce,
      server_nonce: serverNonce,
      session_key: sessionKey,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    })

    await logAudit(supabase, {
      action: 'squidshake.handshake',
      project_id: (body.project_id as string) || 'unknown',
      user_id: userId,
      secret_name: '',
      success: true,
    })

    return jsonResponse({
      version: '1.0',
      session_id: sessionId,
      server_nonce: serverNonce,
      server_public_key: serverPublicKey,
      encrypted_session_key: sessionKey,
      success: true,
    })
  }

  if (method === 'POST' && pathParts[1] === 'ref') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const sessionId = (body.session_id as string) || ''
    const secretName = (body.secret_name as string) || ''
    const deviceFingerprint = (body.device_fingerprint as string) || ''

    if (!sessionId || !secretName) {
      return jsonResponse({ error: 'session_id and secret_name required', success: false }, 400)
    }

    const { data: session } = await supabase
      .from('squidveil_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single()

    if (!session) {
      return jsonResponse({ error: 'Invalid session', success: false }, 401)
    }

    const signingKey = await deriveAESKeyFromApiKey(apiKey)
    const signKeyHex = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', signingKey)), b => b.toString(16).padStart(2, '0')).join('')

    const refId = crypto.randomUUID().split('-')[0]
    const now = Date.now()
    const ttl = (body.ref_ttl as number) || 60
    const maxUses = (body.max_uses as number) || 1

    const deviceBound = await crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(deviceFingerprint || 'unknown'))
      .then(h => Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join(''))

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
    }
    const canonical = `${veilRef.ref_id}${veilRef.secret_name}${veilRef.session_id}${veilRef.issued_at}${veilRef.expires_at}`
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(signKeyHex.slice(0, 32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    veilRef.hmac = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(canonical))), b => b.toString(16).padStart(2, '0')).join('')

    const veilRefJson = JSON.stringify(veilRef)

    await supabase.from('squidveil_refs').insert({
      ref_id: refId,
      session_id: sessionId,
      secret_name: secretName,
      user_id: userId,
      veil_ref_json: veilRefJson,
      expires_at: new Date(now + ttl * 1000).toISOString(),
    })

    await logAudit(supabase, {
      action: 'squidshake.ref_issued',
      project_id: sessionId,
      user_id: userId,
      secret_name: secretName,
      ref_id: refId,
      success: true,
    })

    return jsonResponse({
      session_id: sessionId,
      veil_ref_json: veilRefJson,
      hmac: veilRef.hmac as string,
      success: true,
    })
  }

  if (method === 'POST' && pathParts[1] === 'audit') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    await logAudit(supabase, {
      action: (body.action as string) || 'unknown',
      project_id: (body.project_id as string) || '',
      user_id: userId,
      secret_name: (body.secret_name as string) || '',
      ref_id: (body.ref_id as string) || undefined,
      success: body.success !== false,
      detail: (body.detail as string) || undefined,
    })

    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404)
}

async function handleVeilRefAPI(req: Request, supabase: any, userId: string, path: string, apiKey: string): Promise<Response> {
  const method = req.method
  const pathParts = path.split('/').filter(p => p.length > 0)

  if (method === 'POST' && path === '/veilref/verify') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const refJson = (body.veil_ref_json as string) || ''

    let ref: Record<string, unknown>
    try { ref = JSON.parse(refJson) } catch { return jsonResponse({ error: 'Invalid VeilRef JSON', success: false }, 400) }

    const { data: stored } = await supabase
      .from('squidveil_refs')
      .select('*')
      .eq('ref_id', ref.ref_id)
      .eq('user_id', userId)
      .single()

    if (!stored) return jsonResponse({ error: 'VeilRef not found', success: false }, 404)

    const now = new Date()
    if (new Date(stored.expires_at) < now) {
      return jsonResponse({ error: 'VeilRef expired', verified: false, success: true })
    }

    const signingKey = await deriveAESKeyFromApiKey(apiKey)
    const signKeyHex = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', signingKey)), b => b.toString(16).padStart(2, '0')).join('')

    const canonical = `${ref.ref_id}${ref.secret_name}${ref.session_id}${ref.issued_at}${ref.expires_at}`
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(signKeyHex.slice(0, 32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const expectedHmac = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(canonical))), b => b.toString(16).padStart(2, '0')).join('')

    if (ref.hmac !== expectedHmac) {
      return jsonResponse({ error: 'VeilRef signature invalid', verified: false, success: true })
    }

    return jsonResponse({ verified: true, secret_name: ref.secret_name, success: true })
  }

  if (method === 'POST' && path === '/veilref/resolve') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body', success: false }, 400) }

    const refJson = (body.veil_ref_json as string) || ''

    let ref: Record<string, unknown>
    try { ref = JSON.parse(refJson) } catch { return jsonResponse({ error: 'Invalid VeilRef JSON', success: false }, 400) }

    const { data: stored } = await supabase
      .from('squidveil_refs')
      .select('*')
      .eq('ref_id', ref.ref_id)
      .eq('user_id', userId)
      .single()

    if (!stored) return jsonResponse({ error: 'VeilRef not found', success: false }, 404)

    const secretName = stored.secret_name as string

    const { data: secret } = await supabase
      .from('squid_vault_secrets')
      .select('encrypted_value, iv')
      .eq('user_id', userId)
      .eq('name', secretName)
      .single()

    if (!secret) return jsonResponse({ error: 'Secret not found', success: false }, 404)

    const key = await deriveAESKeyFromApiKey(apiKey)
    const decryptedValue = await decryptSecretValue(secret.encrypted_value, secret.iv, key)

    return jsonResponse({ value: decryptedValue, secret_name: secretName, success: true })
  }

  return jsonResponse({ error: 'Endpoint not found', success: false }, 404)
}
