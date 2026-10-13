export const config = { runtime: 'edge' }

// Same-origin forwarder for anonymous paste-hosts (uguu.se, 0x0.st),
// which accept uploads but send no CORS headers, so browsers cannot use
// them directly. Used only by the SDE fragile tier (small encrypted blobs).
// 10MB cap; nothing here touches credentials.

const MAX_BYTES = 10 * 1024 * 1024

const UPLOAD_TARGETS = {
  uguu: 'https://uguu.se/upload.php',
  '0x0st': 'https://0x0.st',
}

const FETCH_ALLOW = ['d.uguu.se', 'uguu.se', '0x0.st', 'files.catbox.moe']

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function uploadTo(host, bytes) {
  if (host === 'uguu') {
    const form = new FormData()
    form.append('files[]', new Blob([bytes]), 'chunk.bin')
    const res = await fetch(UPLOAD_TARGETS.uguu, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`uguu HTTP ${res.status}`)
    const data = await res.json()
    const url = data?.files?.[0]?.url
    if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('uguu bad reply')
    return url
  }
  if (host === '0x0st') {
    const form = new FormData()
    form.append('file', new Blob([bytes]), 'chunk.bin')
    const res = await fetch(UPLOAD_TARGETS['0x0st'], { method: 'POST', body: form })
    if (!res.ok) throw new Error(`0x0.st HTTP ${res.status}`)
    const url = (await res.text()).trim()
    if (!url.startsWith('https://')) throw new Error('0x0.st bad reply')
    return url
  }
  throw new Error('unknown host')
}

export default async function handler(req) {
  const url = new URL(req.url)
  const host = url.searchParams.get('host')
  const fetchUrl = url.searchParams.get('url')

  if (req.method === 'GET' && url.searchParams.get('probe') === '1') {
    return json({ ok: true })
  }

  if (req.method === 'POST' && host) {
    if (!UPLOAD_TARGETS[host]) return json({ error: 'unknown host' }, 400)
    const buf = await req.arrayBuffer()
    if (!buf || buf.byteLength === 0) return json({ error: 'empty body' }, 400)
    if (buf.byteLength > MAX_BYTES) return json({ error: 'chunk too large' }, 413)
    try {
      const out = await uploadTo(host, new Uint8Array(buf))
      return json({ url: out })
    } catch (e) {
      return json({ error: 'paste upload failed: ' + (e?.message || e) }, 502)
    }
  }

  if (req.method === 'GET' && fetchUrl) {
    let parsed
    try { parsed = new URL(fetchUrl) } catch { return json({ error: 'bad url' }, 400) }
    if (!FETCH_ALLOW.includes(parsed.hostname)) return json({ error: 'host not allowed' }, 403)
    try {
      const upstream = await fetch(fetchUrl, { redirect: 'follow' })
      if (!upstream.ok) return json({ error: `paste fetch HTTP ${upstream.status}` }, 502)
      const bytes = new Uint8Array(await upstream.arrayBuffer())
      if (bytes.length === 0) return json({ error: 'paste object empty (expired?)' }, 502)
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (e) {
      return json({ error: 'paste fetch failed: ' + (e?.message || e) }, 502)
    }
  }

  return json({ error: 'use POST ?host=uguu|0x0st or GET ?url=' }, 400)
}
