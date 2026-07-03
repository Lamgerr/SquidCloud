import { StorageAdapter, ProviderResult } from '../storage-adapter.ts'
import { PrelContext } from '../kza-prel.ts'

const NEWSGROUP = 'alt.anonymous.messages'
const NNTP_SERVERS = [
  { host: 'news.anonynews.com', port: 119, tls: false },
]

const MAX_BYTES = 60 * 1024

function makeMessageId(): string {
  const rand = () => Math.random().toString(36).substring(2, 10)
  return `<${rand()}${rand()}@${rand()}.${rand().substring(0, 3)}>`
}

function randomSubject(): string {
  const parts = Math.random().toString(36).substring(2, 10)
  return `Re: ${parts}`
}

function yencEncode(data: Uint8Array, filename: string): string {
  const lines: string[] = []
  lines.push(`=ybegin line=128 size=${data.length} name=${filename}`)
  lines.push(`=ypart begin=1 end=${data.length}`)

  let line = ''
  for (let i = 0; i < data.length; i++) {
    let b = data[i]
    b = (b + 256 - 42) % 256
    if (b === 0) b = 256 - 42
    if (b === 10 || b === 13 || b === 61 || b === 46) {
      line += '='
      b = (b + 64) % 256
    }
    line += String.fromCharCode(b)
    if (line.length >= 128 || i === data.length - 1) {
      lines.push(line)
      line = ''
    }
  }
  lines.push('=yend size=' + data.length)
  return lines.join('\r\n') + '\r\n'
}

export const usenetAdapter: StorageAdapter = {
  providerType: 'usenet',

  maxBlobSize(): number {
    return MAX_BYTES
  },

  async health(): Promise<boolean> {
    for (const srv of NNTP_SERVERS) {
      try {
        const conn = await Deno.connect({ hostname: srv.host, port: srv.port })
        const buf = new Uint8Array(512)
        const n = await conn.read(buf)
        conn.close()
        if (n && n > 0) return true
      } catch {}
    }
    return false
  },

  async store(_ctx: PrelContext, blob: Uint8Array, _meta?: Record<string, string>): Promise<ProviderResult> {
    const filename = `chunk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}.bin`
    const encoded = yencEncode(blob, filename)
    const msgId = makeMessageId()
    const subject = randomSubject()
    const date = new Date().toUTCString()

    const article = [
      `From: anonymous@${Math.random().toString(36).substring(2, 6)}.invalid`,
      `Subject: ${subject}`,
      `Newsgroups: ${NEWSGROUP}`,
      `Message-ID: ${msgId}`,
      `Date: ${date}`,
      `Path: ${Math.random().toString(36).substring(2, 10)}!${Math.random().toString(36).substring(2, 10)}`,
      `X-No-Archive: Yes`,
      `Content-Type: application/octet-stream`,
      `Content-Transfer-Encoding: binary`,
      '',
      encoded,
    ].join('\r\n') + '\r\n.\r\n'

    const srv = NNTP_SERVERS[0]
    const conn = await Deno.connect({ hostname: srv.host, port: srv.port })
    try {
      let buf = new Uint8Array(4096)
      await conn.read(buf)

      const postCmd = new TextEncoder().encode('POST\r\n')
      await conn.write(postCmd)
      await conn.read(buf)

      await conn.write(new TextEncoder().encode(article))
      await conn.read(buf)
    } finally {
      conn.close()
    }

    const ref = `nntp://${srv.host}:${srv.port}/${NEWSGROUP}/${msgId}`
    return { ref, providerType: 'usenet', url: ref }
  },

  async retrieve(_ctx: PrelContext, ref: string): Promise<Uint8Array> {
    const parsed = ref.match(/nntp:\/\/([^:]+):?(\d*)\/([^/]+)\/(.+)/)
    if (!parsed) throw new Error(`invalid usenet ref: ${ref}`)
    const host = parsed[1]
    const port = parseInt(parsed[2] || '119')
    const newsgroup = parsed[3]
    const msgId = parsed[4]

    const conn = await Deno.connect({ hostname: host, port })
    try {
      let buf = new Uint8Array(65536)
      await conn.read(buf)

      const groupCmd = new TextEncoder().encode(`GROUP ${newsgroup}\r\n`)
      await conn.write(groupCmd)
      await conn.read(buf)

      const articleCmd = new TextEncoder().encode(`ARTICLE ${msgId}\r\n`)
      await conn.write(articleCmd)
      const n = await conn.read(buf)

      const text = new TextDecoder().decode(buf.subarray(0, n))

      const bodyStart = text.indexOf('\r\n\r\n')
      if (bodyStart === -1) throw new Error('no body found in usenet article')
      const body = text.substring(bodyStart + 4)

      const yBegin = body.indexOf('=ybegin')
      const yEnd = body.indexOf('=yend')
      if (yBegin === -1 || yEnd === -1) throw new Error('no yenc data found')

      const yencData = body.substring(yBegin, yEnd + 8)

      const parts: number[] = []
      for (const line of yencData.split('\n')) {
        const t = line.trim()
        if (t.startsWith('=') || t.startsWith('=y')) continue
        for (let i = 0; i < t.length; i++) {
          let b = t.charCodeAt(i)
          if (b === 61 && i + 1 < t.length) {
            i++
            b = t.charCodeAt(i)
            b = (b + 256 - 64) % 256
          }
          b = (b + 42) % 256
          parts.push(b)
        }
      }

      return new Uint8Array(parts)
    } finally {
      conn.close()
    }
  },

  async delete(_ctx: PrelContext, ref: string): Promise<boolean> {
    return true
  },
}
