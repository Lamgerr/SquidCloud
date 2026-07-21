/**
 * SquidCloud API v4 Proxy
 * Route: /api/v1/*  →  Supabase cloudbliss-api
 *
 * Adds CDN-edge rate limiting, timestamp validation, and CORS.
 * Injects Supabase headers automatically — users only need X-SquidCloud-Key.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const CRON_SECRET = process.env.CRON_SECRET || crypto.randomUUID()

// Per-IP rate limiting (in-memory sliding window)
const ipRateMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 200 // max requests per window per IP

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = ipRateMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRateMap.set(ip, { windowStart: now, count: 1 })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS }
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)

  // ===== CORS PREFLIGHT =====
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-SquidCloud-Key, X-SquidCloud-Encryption-Key, X-Timestamp, X-Request-Nonce, X-Signature, Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // ===== RATE LIMITING =====
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateCheck = checkRateLimit(ip)

  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests. Rate limit exceeded.',
      success: false,
      code: 'RATE_LIMITED',
      retry_after: Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
      },
    })
  }

  // ===== TIMESTAMP VALIDATION =====
  const timestamp = req.headers.get('x-timestamp')
  if (timestamp) {
    const ts = parseInt(timestamp, 10)
    const now = Date.now()
    if (isNaN(ts) || Math.abs(now - ts) > 300_000) {
      return new Response(JSON.stringify({
        error: 'Request timestamp is invalid or expired. Ensure X-Timestamp header is within 5 minutes of server time.',
        success: false,
        code: 'INVALID_TIMESTAMP',
        server_time: now,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
  }

  // ===== FORWARD TO SUPABASE =====
  const subPath = url.pathname.replace(/^\/api\/v1/, '') || '/'
  const target = `${SUPABASE_URL}/functions/v1/cloudbliss-api${subPath}${url.search}`

  const headers = new Headers(req.headers)
  headers.set('apikey', SUPABASE_ANON_KEY)
  headers.delete('host')

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? null : req.body,
    // @ts-ignore
    duplex: 'half',
  })

  // Forward response with CORS
  const resHeaders = new Headers(upstream.headers)
  resHeaders.set('Access-Control-Allow-Origin', '*')
  resHeaders.set('Access-Control-Allow-Headers', 'X-SquidCloud-Key, X-SquidCloud-Encryption-Key, X-Timestamp, X-Request-Nonce, X-Signature, Content-Type')
  resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  resHeaders.set('X-RateLimit-Remaining', rateCheck.remaining.toString())
  resHeaders.set('X-RateLimit-Reset', Math.ceil((rateCheck.resetAt || (Date.now() + RATE_LIMIT_WINDOW_MS)) / 1000).toString())

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  })
}
