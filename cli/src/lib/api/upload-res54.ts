import { loadSession } from '../auth/session.js'
import { encryptFile, type FileEncryptionResult } from '../crypto/encrypt-file.js'
import { SUPABASE_URL, getAnonKey } from '../auth/constants.js'

interface GitHubRepo {
  repo_name: string
}

interface ChunkUploadResult {
  index: number
  repo: string
  path: string
  sha?: string
}

async function supabaseFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await loadSession()
  if (!session?.access_token) throw new Error('Not logged in')

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': getAnonKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase API error (${response.status}): ${text.slice(0, 500)}`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function getRepoPath(userId: string, chunkIndex: number, totalChunks: number): string {
  const id = `res54_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}_${chunkIndex}`
  return `${userId}/${id}.json`
}

export async function uploadFileRes54(
  data: Uint8Array,
  fileName: string,
  fileType: string,
  onProgress?: (current: number, total: number, stage: string) => void,
): Promise<{ id: string }> {
  const session = await loadSession()
  if (!session?.access_token) throw new Error('Not logged in. Run `squidcloud auth login` first.')
  const userId = session.user.id

  const repos = await supabaseFetch<GitHubRepo[]>('GET', `/rest/v1/repositories?select=repo_name&user_id=eq.${userId}`)
  if (!repos || repos.length === 0) throw new Error('No storage vault found. Create one on the dashboard first.')

  onProgress?.(0, 1, 'Encrypting')

  const result = encryptFile(data, fileName, fileType)
  const totalChunks = result.chunks.length

  const chunkResults: ChunkUploadResult[] = []

  onProgress?.(0, totalChunks, 'Uploading')

  for (let i = 0; i < totalChunks; i++) {
    const chunk = result.chunks[i]
    const repo = repos[i % repos.length]
    const path = getRepoPath(userId, chunk.index, totalChunks)

    const chunkData = {
      version: '3.0',
      chunkIndex: chunk.index,
      totalChunks: chunk.totalChunks,
      fileName: result.fileName,
      fileType: result.fileType,
      fileSize: result.fileSize,
      chunkData: chunk.encryptedBase64,
      chunkSize: chunk.encryptedBase64.length,
      checksum: chunk.sha256,
      repo: repo.repo_name,
      path,
    }

    const uploadResponse = await supabaseFetch<{ success: boolean; sha?: string }>('POST', '/functions/v1/github-storage', {
      action: 'upload',
      fileName: path.split('/').pop(),
      fileType: 'application/json',
      data: JSON.stringify(chunkData),
      userId,
      path,
      repo: repo.repo_name,
    })

    if (!uploadResponse.success) {
      throw new Error(`Failed to upload chunk ${i}`)
    }

    chunkResults.push({ index: i, repo: repo.repo_name, path, sha: uploadResponse.sha })
    onProgress?.(i + 1, totalChunks, 'Uploading')
  }

  onProgress?.(totalChunks, totalChunks, 'Finalizing')

  const metadata = {
    fileName: result.fileName,
    fileType: result.fileType,
    fileSize: result.fileSize,
    chunks: result.chunks.map((c, idx) => ({
      ...c,
      repo: chunkResults[idx].repo,
      path: chunkResults[idx].path,
    })),
    encryptionKey: result.encryptionKey,
    created: new Date().toISOString(),
    previewAvailable: false,
  }

  const rpcResult = await supabaseFetch<{ id: string }>('POST', '/rest/v1/rpc/create_file_record', {
    p_name: result.fileName,
    p_type: result.fileType || 'application/octet-stream',
    p_size: result.fileSize,
    p_storage_path: 'res54_distributed',
    p_user_id: userId,
    p_encrypted: true,
    p_encryption_key: result.encryptionKey,
    p_metadata: JSON.stringify(metadata),
    p_workspace_id: null as string | null,
  })

  const fileId = (rpcResult as any)?.id
  if (!fileId) throw new Error('Failed to create file record: no id returned')

  onProgress?.(totalChunks, totalChunks, 'Complete')

  return { id: fileId }
}
