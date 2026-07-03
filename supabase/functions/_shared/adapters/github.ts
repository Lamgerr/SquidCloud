import { StorageAdapter, ProviderResult } from '../storage-adapter.ts'
import { PrelContext } from '../kza-prel.ts'

const MAX_BYTES = 6 * 1024 * 1024

export class GithubAdapter implements StorageAdapter {
  readonly providerType = 'github'

  private ghToken: string
  private ghUsername: string

  constructor(token: string, username: string) {
    this.ghToken = token
    this.ghUsername = username
  }

  maxBlobSize(): number {
    return MAX_BYTES
  }

  async health(): Promise<boolean> {
    try {
      const r = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${this.ghToken}`,
          'User-Agent': 'SquidCloud-Storage',
        },
        signal: AbortSignal.timeout(8000),
      })
      return r.ok
    } catch {
      return false
    }
  }

  async store(ctx: PrelContext, blob: Uint8Array, meta?: Record<string, string>): Promise<ProviderResult> {
    const repo = meta?.repo || `SquidCloud_${ctx.userId.slice(0, 8)}`
    const path = meta?.path || `${ctx.userId}/chunk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}.json`

    const base64 = btoa(String.fromCharCode(...blob))
    const content = JSON.stringify({ v: '2.3', i: meta?.chunkIndex || 0, t: meta?.totalChunks || 1, d: base64 })

    let sha: string | undefined
    const check = await fetch(
      `https://api.github.com/repos/${this.ghUsername}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${this.ghToken}`,
          'User-Agent': 'SquidCloud-Storage',
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (check.ok) {
      const existing = await check.json() as { sha?: string }
      sha = existing.sha
    }

    const res = await fetch(
      `https://api.github.com/repos/${this.ghUsername}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SquidCloud-Storage',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `chunk ${meta?.chunkIndex || 0}`,
          content: btoa(content),
          sha,
        }),
        signal: AbortSignal.timeout(30000),
      }
    )
    if (!res.ok) throw new Error(`GitHub store failed: ${res.status} ${await res.text()}`)

    const downloadUrl = `https://raw.githubusercontent.com/${this.ghUsername}/${repo}/main/${path}`
    return { ref: `gh://${repo}/${path}`, providerType: 'github', url: downloadUrl }
  }

  async retrieve(_ctx: PrelContext, ref: string): Promise<Uint8Array> {
    const parsed = ref.match(/gh:\/\/([^/]+)\/(.+)/)
    if (!parsed) throw new Error(`invalid github ref: ${ref}`)
    const repo = parsed[1]
    const path = parsed[2]

    const url = `https://api.github.com/repos/${this.ghUsername}/${repo}/contents/${path}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.ghToken}`,
        'User-Agent': 'SquidCloud-Storage',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`GitHub retrieve failed: ${res.status}`)
    const data = await res.json() as { content?: string; download_url?: string }

    let raw = data.content || ''
    if (!raw && data.download_url) {
      const dl = await fetch(data.download_url, {
        headers: { 'Authorization': `Bearer ${this.ghToken}` },
        signal: AbortSignal.timeout(30000),
      })
      if (dl.ok) raw = btoa(await dl.text())
    }

    if (!raw) throw new Error('no content in GitHub response')

    const jsonStr = atob(raw.replace(/\s/g, ''))
    const parsedChunk = JSON.parse(jsonStr)
    const d = parsedChunk.d || (typeof parsedChunk.chunkData === 'string' ? parsedChunk.chunkData : '')
    if (!d) throw new Error('no chunk data in parsed content')

    return new Uint8Array(atob(d).split('').map(c => c.charCodeAt(0)))
  }

  async delete(_ctx: PrelContext, ref: string): Promise<boolean> {
    const parsed = ref.match(/gh:\/\/([^/]+)\/(.+)/)
    if (!parsed) return false
    const repo = parsed[1]
    const path = parsed[2]

    try {
      const check = await fetch(
        `https://api.github.com/repos/${this.ghUsername}/${repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${this.ghToken}`,
            'User-Agent': 'SquidCloud-Storage',
          },
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!check.ok) return false
      const data = await check.json() as { sha?: string }
      if (!data.sha) return false

      const del = await fetch(
        `https://api.github.com/repos/${this.ghUsername}/${repo}/contents/${path}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.ghToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SquidCloud-Storage',
          },
          body: JSON.stringify({ message: 'delete chunk', sha: data.sha }),
          signal: AbortSignal.timeout(10000),
        }
      )
      return del.ok
    } catch {
      return false
    }
  }
}
