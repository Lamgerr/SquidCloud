export const config = { runtime: 'edge' }

const ALLOWED_HOSTS = ['gutendex.com', 'www.gutendex.com', 'openlibrary.org', 'www.openlibrary.org', 'archive.org', 'www.archive.org']

export default async function handler(req) {
  const url = new URL(req.url)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response('Missing url param', { status: 400 })
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response('Domain not allowed', { status: 403 })
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudBliss-Reader/1.0)',
        'Accept': 'application/json',
      },
    })

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status })
    }

    const body = upstream.body
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800',
      },
    })
  } catch (err) {
    return new Response('Proxy fetch failed: ' + err.message, { status: 502 })
  }
}
