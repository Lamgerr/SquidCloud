import { supabase } from "@/integrations/supabase/client"
import { generateEncryptionKey, decryptData } from "./encryption"
import { uploadFileWithRes54, type Res54FileMetadata, type ChunkMetadata, type Res54DownloadOptions } from "./res54"
import { storeChunks, retrieveManifest, retrieveChunk, type ChunkRecord, type Ao56fj3Entry } from "./ao56fj3-client"

type ProgressCallback = (progress: number, stage: string, details?: any) => void

const CHUNK_SIZES = [
  { max: 10 * 1024 * 1024, size: 1.5 * 1024 * 1024 },
  { max: 100 * 1024 * 1024, size: 2 * 1024 * 1024 },
  { max: 500 * 1024 * 1024, size: 2.5 * 1024 * 1024 },
  { max: Infinity, size: 2 * 1024 * 1024 },
]

function determineChunkSize(fileSize: number): number {
  for (const tier of CHUNK_SIZES) {
    if (fileSize <= tier.max) return tier.size
  }
  return 2 * 1024 * 1024
}

async function readFileChunk(file: File, start: number, end: number): Promise<ArrayBuffer> {
  return file.slice(start, end).arrayBuffer()
}

async function encryptChunk(chunk: ArrayBuffer, key: string, index: number): Promise<ArrayBuffer> {
  const { encryptData } = await import("./encryption")
  const encrypted = await encryptData(chunk, key)
  const enc = new TextEncoder()
  return enc.encode(encrypted).buffer as ArrayBuffer
}

export async function uploadFileDistributed(
  file: File,
  progressCallback?: ProgressCallback,
): Promise<{ id: string; metadata: Res54FileMetadata; encryptionKey: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Authentication required")

  progressCallback?.(0, 'preparing')

  const chunkSize = determineChunkSize(file.size)
  const totalChunks = Math.ceil(file.size / chunkSize)
  const encryptionKey = generateEncryptionKey()

  progressCallback?.(10, 'chunking')

  const chunks: ChunkRecord[] = []
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const rawChunk = await readFileChunk(file, start, end)
    const encrypted = await encryptChunk(rawChunk, encryptionKey, i)
    chunks.push({ index: i, data: encrypted })
    if (i % 5 === 0) progressCallback?.(10 + (i / totalChunks) * 30, 'encrypting')
  }

  progressCallback?.(40, 'uploading')

  const fileId = crypto.randomUUID()
  const result = await storeChunks(fileId, chunks, file.size, chunkSize)

  progressCallback?.(90, 'finalizing')

  const chunkMetas: ChunkMetadata[] = chunks.map((c, i) => ({
    index: i,
    totalChunks,
    size: c.data.byteLength,
    offset: i * chunkSize,
    sha256: '',
  }))

  const metadata: Res54FileMetadata = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    chunks: chunkMetas,
    encryptionKey,
    created: new Date().toISOString(),
    previewAvailable: false,
  }

  const metadataString = JSON.stringify({
    ...metadata,
    encryptionKey: 'byok_protected',
    chunks: chunkMetas,
  })

  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert({
      name: file.name,
      type: file.type,
      size: file.size,
      storage_path: 'res54_ao56fj3',
      user_id: user.id,
      encrypted: true,
      shared: false,
      encryption_key: 'byok_protected',
      tags: [metadataString],
    })
    .select()
    .single()

  if (dbError) throw new Error(`Failed to create file record: ${dbError.message}`)

  progressCallback?.(100, 'complete')
  return { id: dbFile.id, metadata, encryptionKey }
}

export async function downloadFileDistributed(
  fileId: string,
  options?: Res54DownloadOptions,
): Promise<Blob> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Authentication required")

  let manifest: Awaited<ReturnType<typeof retrieveManifest>> | null = null
  try {
    manifest = await retrieveManifest(fileId)
  } catch {
    const { data: fileRecord } = await supabase
      .from('files')
      .select('tags, encryption_key')
      .eq('id', fileId)
      .single()

    if (!fileRecord) throw new Error('File not found')

    const tag = JSON.parse(fileRecord.tags?.[0] || '{}') as Res54FileMetadata
    if (!tag.chunks) throw new Error('No chunk metadata found')

    const encryptedChunks: ArrayBuffer[] = []
    for (const chunk of tag.chunks) {
      const { data: chunkData } = await supabase.functions.invoke('github-storage', {
        body: { action: 'download', path: chunk.path, repo: chunk.repo, userId: user.id, nodeId: chunk.accountId ? chunk.accountId - 1 : 0 }
      })
      const resp = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData
      if (!resp?.content) throw new Error(`Failed to download chunk ${chunk.index}`)

      const clean = resp.content.replace(/\s/g, '')
      const decoded = atob(clean)
      const parsed = JSON.parse(decoded)
      const d = parsed.d || parsed.chunkData || ''
      const binary = Uint8Array.from(atob(d), c => c.charCodeAt(0))
      encryptedChunks.push(binary.buffer)
    }

    const key = fileRecord.encryption_key
    if (!key || key === 'byok_protected') throw new Error('Encryption key not available')

    const decrypted = await Promise.all(
      encryptedChunks.map(enc => decryptData(
        new TextDecoder().decode(new Uint8Array(enc)),
        key
      ))
    )

    return new Blob(decrypted, { type: tag.fileType || 'application/octet-stream' })
  }

  const encryptedChunks: ArrayBuffer[] = []
  for (const entry of manifest.entries) {
    const blob = await retrieveChunk(entry)
    encryptedChunks.push(blob)
  }

  const key = options?.reason
    ? await getDecryptionKey(fileId)
    : await supabase
        .from('files')
        .select('encryption_key')
        .eq('id', fileId)
        .single()
        .then(r => r.data?.encryption_key || '')

  if (!key || key === 'byok_protected') throw new Error('Encryption key not available')

  const decrypted = await Promise.all(
    encryptedChunks.map(enc => decryptData(
      new TextDecoder().decode(new Uint8Array(enc)),
      key
    ))
  )

  return new Blob(decrypted)
}

async function getDecryptionKey(fileId: string): Promise<string> {
  const { data, error } = await supabase
    .from('files')
    .select('encryption_key')
    .eq('id', fileId)
    .single()
  if (error) throw new Error(`Failed to get decryption key: ${error.message}`)
  return data.encryption_key || ''
}
