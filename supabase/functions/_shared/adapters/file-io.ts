import { StorageAdapter, ProviderResult } from '../storage-adapter.ts'
import { PrelContext } from '../kza-prel.ts'

const BASE = 'https://file.io'
const MAX_BYTES = 4 * 1024 * 1024 * 1024

export const fileIoAdapter: StorageAdapter = {
  providerType: 'file_io',

  maxBlobSize(): number {
    return MAX_BYTES
  },

  async health(): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/`, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      return r.ok || r.status === 405
    } catch {
      return false
    }
  },

  async store(_ctx: PrelContext, blob: Uint8Array, _meta?: Record<string, string>): Promise<ProviderResult> {
    const form = new FormData()
    form.append('file', new Blob([blob]), 'chunk.bin')
    const res = await fetch(`${BASE}/?expires=1w`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`file.io store failed: ${res.status}`)
    const data = await res.json() as { success: boolean; key: string; link: string }
    if (!data.success) throw new Error('file.io store failed: success=false')
    return { ref: data.key, providerType: 'file_io', url: data.link }
  },

  async retrieve(_ctx: PrelContext, ref: string): Promise<Uint8Array> {
    const url = ref.startsWith('http') ? ref : `${BASE}/${ref}`
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`file.io retrieve failed: ${res.status}`)
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  },

  async delete(_ctx: PrelContext, ref: string): Promise<boolean> {
    const url = ref.startsWith('http') ? ref : `${BASE}/${ref}`
    try {
      const res = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(10000) })
      return res.ok
    } catch {
      return false
    }
  },
}
