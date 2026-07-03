import { StorageAdapter, ProviderResult } from '../storage-adapter.ts'
import { PrelContext } from '../kza-prel.ts'

const BASE = 'https://paste.rs'
const MAX_BYTES = 900 * 1024

export const pasteRsAdapter: StorageAdapter = {
  providerType: 'paste_rs',

  maxBlobSize(): number {
    return MAX_BYTES
  },

  async health(): Promise<boolean> {
    try {
      const r = await fetch(BASE, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      return r.ok || r.status === 405
    } catch {
      return false
    }
  },

  async store(_ctx: PrelContext, blob: Uint8Array, _meta?: Record<string, string>): Promise<ProviderResult> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok && res.status !== 206) throw new Error(`paste.rs store failed: ${res.status}`)
    const url = (await res.text()).trim()
    const id = url.split('/').pop() || url
    return { ref: id, providerType: 'paste_rs', url }
  },

  async retrieve(_ctx: PrelContext, ref: string): Promise<Uint8Array> {
    const url = ref.startsWith('http') ? ref : `${BASE}/${ref}`
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`paste.rs retrieve failed: ${res.status}`)
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
