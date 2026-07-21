export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response('Missing url param', { status: 400 })
  }

  let parsedUrl
  try {
    parsedUrl = new URL(target)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  const allowlist = ['www.gutenberg.org', 'gutenberg.org', 'gutenberg.readingroo.ms']
  if (!allowlist.includes(parsedUrl.hostname)) {
    return new Response('Domain not allowed', { status: 403 })
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
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status })
    }

    const body = upstream.body
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/epub+zip',
        'Content-Length': upstream.headers.get('Content-Length') || '',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    return new Response('Proxy fetch failed: ' + err.message, { status: 502 })
  }
}
