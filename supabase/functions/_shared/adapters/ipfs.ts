import { StorageAdapter, ProviderResult } from '../storage-adapter.ts'
import { PrelContext } from '../kza-prel.ts'

const GATEWAYS = [
  { name: 'ipfs-ninja', upload: 'https://api.ipfs.ninja/upload/new', gateway: 'https://ipfs.ninja/ipfs' },
  { name: 'public-getpost', upload: null, gateway: 'https://public.getpost.workers.dev' },
]

const MAX_BYTES = 10 * 1024 * 1024

export const ipfsAdapter: StorageAdapter = {
  providerType: 'ipfs',

  maxBlobSize(): number {
    return MAX_BYTES
  },

  async health(): Promise<boolean> {
    for (const gw of GATEWAYS) {
      try {
        const r = await fetch(gw.gateway.replace('/ipfs', ''), { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (r.ok || r.status === 405) return true
      } catch {}
    }
    return false
  },

  async store(_ctx: PrelContext, blob: Uint8Array, _meta?: Record<string, string>): Promise<ProviderResult> {
    const gw = GATEWAYS[0]
    if (!gw.upload) throw new Error('no upload-capable gateway available')

    const form = new FormData()
    form.append('file', new Blob([blob]), `chunk_${Date.now().toString(36)}.bin`)

    const res = await fetch(gw.upload, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`IPFS upload failed: ${res.status}`)

    const data = await res.json() as { cid?: string; hash?: string; url?: string }
    const cid = data.cid || data.hash || ''
    if (!cid) throw new Error('IPFS upload returned no CID')

    return {
      ref: cid,
      providerType: 'ipfs',
      url: `${gw.gateway}/${cid}`,
    }
  },

  async retrieve(_ctx: PrelContext, ref: string): Promise<Uint8Array> {
    const cid = ref.replace(/^ipfs:\/\//, '').split('/')[0]
    let lastErr: Error | null = null

    for (const gw of GATEWAYS) {
      try {
        const url = ref.startsWith('http') ? ref : `${gw.gateway}/${cid}`
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) continue
        const buf = await res.arrayBuffer()
        if (buf.byteLength > 0) return new Uint8Array(buf)
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
      }
    }
    throw lastErr || new Error('all IPFS gateways failed to retrieve')
  },

  async delete(_ctx: PrelContext, ref: string): Promise<boolean> {
    return true
  },
}
