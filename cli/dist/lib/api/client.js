 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { loadSession } from '../auth/session.js'
import { authToken as oauthToken, anonKey as oauthAnonKey } from '../auth/oauth-session.js'

export const API_BASE =
  process.env.SQUIDCLOUD_API_BASE ||
  'https://squidcloud.vercel.app/api/v1'

const MAX_RETRIES = 3
const BASE_DELAY = 600
const RATE_LIMIT_WINDOW = 170








let lastRequestTime = 0

async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_WINDOW) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_WINDOW - elapsed))
  }
  lastRequestTime = Date.now()
}

/** Auth header chain: OAuth session token → SQUIDCLOUD_API_KEY env → stored api key. */
async function authHeaders() {
  if (oauthToken) return { Authorization: `Bearer ${oauthToken}` }
  const envKey = process.env.SQUIDCLOUD_API_KEY
  if (envKey) return { 'X-SquidCloud-Key': envKey }
  try {
    const session = await loadSession()
    if (_optionalChain([session, 'optionalAccess', _ => _.api_key])) return { 'X-SquidCloud-Key': session.api_key }
    if (_optionalChain([session, 'optionalAccess', _2 => _2.access_token])) return { Authorization: `Bearer ${session.access_token}` }
  } catch (e) {
    /* unauthenticated */
  }
  return {}
}

export async function buildHeaders(extra = {}) {
  const auth = await authHeaders()
  if (oauthAnonKey && !auth['X-SquidCloud-Key']) auth['apikey'] = oauthAnonKey
  return { 'Content-Type': 'application/json', ...auth, ...extra }
}

export class ApiError extends Error {
  constructor(
    message,
     status,
     details,
  ) {
    super(message);this.status = status;this.details = details;
    this.name = 'ApiError'
  }
}

function extractError(body, status) {
  if (body && typeof body === 'object') {
    const b = body 
    const msg = _optionalChain([b, 'optionalAccess', _3 => _3.error, 'optionalAccess', _4 => _4.message]) || _optionalChain([b, 'optionalAccess', _5 => _5.error]) || _optionalChain([b, 'optionalAccess', _6 => _6.message]) || `HTTP ${status}`
    return new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), status, _nullishCoalesce(_optionalChain([b, 'optionalAccess', _7 => _7.error, 'optionalAccess', _8 => _8.code]), () => ( _optionalChain([b, 'optionalAccess', _9 => _9.code]))))
  }
  return new ApiError(`HTTP ${status}`, status)
}

export async function apiRaw(path, options = {}) {
  const { method = 'GET', headers = {}, body, retries = MAX_RETRIES } = options
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimit()
    const reqHeaders = await buildHeaders(headers)
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: reqHeaders,
        body:
          body === undefined || ['GET', 'HEAD'].includes(method)
            ? undefined
            : typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer
              ? (body )
              : JSON.stringify(body),
      })
      // Retry transient failures only.
      if (res.status >= 500 && attempt < retries) {
        lastError = new ApiError(`HTTP ${res.status}`, res.status)
        await sleepBackoff(attempt)
        continue
      }
      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 2
        lastError = new ApiError('Rate limited', 429)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        continue
      }
      return res
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) await sleepBackoff(attempt)
    }
  }
  throw lastError || new Error(`Request failed: ${path}`)
}

function sleepBackoff(attempt) {
  const delay = BASE_DELAY * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
  return new Promise((r) => setTimeout(r, delay))
}

export async function apiRequest(path, options = {}) {
  const res = await apiRaw(path, options)
  if (res.status === 204) return undefined 
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null)
    if (!res.ok) throw extractError(data, res.status)
    return data 
  }
  const text = await res.text()
  if (!res.ok) throw new ApiError(text.slice(0, 400) || `HTTP ${res.status}`, res.status)
  return text 
}

export async function apiGet(path, options) {
  return apiRequest(path, { ...options, method: 'GET' })
}

export async function apiPost(path, body, options) {
  return apiRequest(path, { ...options, method: 'POST', body })
}

export async function apiPut(path, body, options) {
  return apiRequest(path, { ...options, method: 'PUT', body })
}

export async function apiPatch(path, body, options) {
  return apiRequest(path, { ...options, method: 'PATCH', body })
}

export async function apiDelete(path, options) {
  return apiRequest(path, { ...options, method: 'DELETE' })
}
