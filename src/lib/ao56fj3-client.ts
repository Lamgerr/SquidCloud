import { supabase } from "@/integrations/supabase/client"

export interface ChunkRecord {
  index: number
  data: ArrayBuffer
  providerType?: string
}

export interface Ao56fj3Entry {
  chunkIndex: number
  providerType: string
  ref: string
  size: number
}

export interface Ao56fj3Manifest {
  fileId: string
  totalChunks: number
  totalSize: number
  algorithm: string
  entries: Ao56fj3Entry[]
}

const STORAGE_BACKEND = 'storage-backend'

async function invoke(action: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(STORAGE_BACKEND, {
    body: { action, ...body }
  })
  if (error) throw new Error(`ao56fj3: ${error.message || JSON.stringify(error)}`)
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (!parsed.success) throw new Error(`ao56fj3: ${parsed.error || 'unknown error'}`)
  return parsed
}

export async function storeChunks(
  fileId: string,
  chunks: ChunkRecord[],
  totalSize: number,
  chunkSize: number,
): Promise<{ chunksStored: number; manifestVersion: number }> {
  const chunkPayloads = chunks.map(c => ({
    index: c.index,
    data: Array.from(new Uint8Array(c.data)),
    providerType: c.providerType,
  }))

  const result = await invoke('store-chunks', {
    fileId,
    totalSize,
    chunkSize,
    chunks: chunkPayloads,
  })

  return {
    chunksStored: result.chunksStored,
    manifestVersion: result.manifestVersion,
  }
}

export async function retrieveManifest(fileId: string): Promise<Ao56fj3Manifest> {
  const result = await invoke('retrieve-manifest', { fileId })
  return result.manifest as Ao56fj3Manifest
}

export async function retrieveChunk(entry: Ao56fj3Entry): Promise<ArrayBuffer> {
  const result = await invoke('retrieve-chunk', {
    ref: entry.ref,
    providerType: entry.providerType,
  })
  return new Uint8Array(result.data as number[]).buffer
}

export async function getHealth(): Promise<Record<string, boolean>> {
  const result = await invoke('health', {})
  return result.health as Record<string, boolean>
}
