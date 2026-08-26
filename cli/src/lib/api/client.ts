import { loadSession } from '../auth/session.js'
import { authToken as oauthToken, anonKey as oauthAnonKey } from '../auth/oauth-session.js'

export const API_BASE =
  process.env.SQUIDCLOUD_API_BASE ||
  'https://squidcloud.vercel.app/api/v1'

const MAX_RETRIES = 3
const BASE_DELAY = 600
const RATE_LIMIT_WINDOW = 170

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  retries?: number
}

let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_WINDOW) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_WINDOW - elapsed))
  }
  lastRequestTime = Date.now()
}

/** Auth header chain: OAuth session token → SQUIDCLOUD_API_KEY env → stored api key. */
async function authHeaders(): Promise<Record<string, string>> {
  if (oauthToken) return { Authorization: `Bearer ${oauthToken}` }
  const envKey = process.env.SQUIDCLOUD_API_KEY
  if (envKey) return { 'X-SquidCloud-Key': envKey }
  try {
    const session = await loadSession()
    if (session?.api_key) return { 'X-SquidCloud-Key': session.api_key }
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` }
  } catch {
    /* unauthenticated */
  }
  return {}
}

export async function buildHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const auth = await authHeaders()
  if (oauthAnonKey && !auth['X-SquidCloud-Key']) auth['apikey'] = oauthAnonKey
  return { 'Content-Type': 'application/json', ...auth, ...extra }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function extractError(body: unknown, status: number): ApiError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, any>
    const msg = b?.error?.message || b?.error || b?.message || `HTTP ${status}`
    return new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), status, b?.error?.code ?? b?.code)
  }
  return new ApiError(`HTTP ${status}`, status)
}

export async function apiRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', headers = {}, body, retries = MAX_RETRIES } = options
  let lastError: Error | null = null

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
              ? (body as any)
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

function sleepBackoff(attempt: number): Promise<void> {
  const delay = BASE_DELAY * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
  return new Promise((r) => setTimeout(r, delay))
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiRaw(path, options)
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null)
    if (!res.ok) throw extractError(data, res.status)
    return data as T
  }
  const text = await res.text()
  if (!res.ok) throw new ApiError(text.slice(0, 400) || `HTTP ${res.status}`, res.status)
  return text as unknown as T
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' })
}

export async function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body })
}

export async function apiPut<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PUT', body })
}

export async function apiPatch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PATCH', body })
}

export async function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE' })
}
