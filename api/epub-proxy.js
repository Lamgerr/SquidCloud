export const config = { runtime: 'edge' }

const ALLOWED_HOSTS = ['www.gutenberg.org', 'gutenberg.org', 'gutenberg.readingroo.ms']

export default async function handler(req) {
  const url = new URL(req.url)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  let parsedUrl
  try {
    parsedUrl = new URL(target)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid target URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudBliss-Reader/1.0)',
        'Accept': 'application/epub+zip, application/octet-stream, */*',
      },
      redirect: 'follow',
    })

    if (!upstream.ok) {
      // Forward as 502 so client can retry or fall back gracefully
      return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Read body as buffer to validate it before returning
    const arrayBuffer = await upstream.arrayBuffer()
    const buf = new Uint8Array(arrayBuffer)

    // Basic EPUB validation: ZIP magic bytes (PK)
    if (buf.length > 4 && !(buf[0] === 0x50 && buf[1] === 0x4b)) {
      return new Response(JSON.stringify({ error: 'Downloaded file is not a valid EPUB.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/epub+zip',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
