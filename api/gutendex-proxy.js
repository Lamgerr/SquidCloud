export const config = { runtime: 'edge' }

const ALLOWED_HOSTS = ['gutendex.com', 'www.gutendex.com', 'openlibrary.org', 'www.openlibrary.org', 'archive.org', 'www.archive.org']

function extractErrorMessage(html, status) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) return `${status} — ${titleMatch[1].replace(/<[^>]+>/g, '').trim()}`;
  const stripped = html.replace(/\s+/g, ' ').trim();
  if (stripped.length < 300) return `${status} — ${stripped}`;
  return `Upstream error: ${status}`;
}

export default async function handler(req) {
  const url = new URL(req.url)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid target URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  let bodyText = ''
  let upstreamStatus = 0

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudBliss-Reader/1.0)',
        'Accept': 'application/json',
      },
    })

    upstreamStatus = upstream.status
    bodyText = await upstream.text()
    const contentType = upstream.headers.get('Content-Type') || ''

    if (!upstream.ok) {
      // 4xx errors from providers are often HTML error pages — treat as 502 so
      // the client can fall back to other providers rather than showing "HTTP 400"
      const clientStatus = upstreamStatus >= 400 && upstreamStatus < 500 ? 502 : upstreamStatus
      const msg = extractErrorMessage(bodyText, upstreamStatus)
      return new Response(JSON.stringify({ error: msg, upstreamStatus }), {
        status: clientStatus,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Guard against non-JSON bodies (some APIs return HTML on edge cases)
    const isJson = contentType.includes('json') ||
      bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')
    if (!isJson) {
      return new Response(JSON.stringify({ error: 'Provider returned an unexpected format' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(bodyText, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
