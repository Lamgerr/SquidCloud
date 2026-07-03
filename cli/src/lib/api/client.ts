import { loadSession } from '../auth/session.js'
import { refreshAccessToken } from '../auth/refresh.js'
import { getApiBase } from './cert-pin.js'

const MAX_RETRIES = 3
const BASE_DELAY = 1000
const RATE_LIMIT_WINDOW = 1000
const API_BASE = getApiBase()

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  authenticated?: boolean
  retries?: number
}

let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_WINDOW) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_WINDOW - elapsed))
  }
  lastRequestTime = Date.now()
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, authenticated = false, retries = MAX_RETRIES } = options

  await rateLimit()

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (authenticated) {
    const session = await loadSession()
    if (session?.api_key) {
      reqHeaders['x-squidcloud-key'] = session.api_key
    } else if (session?.access_token) {
      const newSession = await refreshAccessToken()
      if (newSession?.api_key) {
        reqHeaders['x-squidcloud-key'] = newSession.api_key
      }
    }
  }

  const url = `${API_BASE}${path}`
  const fetchOptions: RequestInit = {
    method,
    headers: reqHeaders,
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)
      return handleResponse<T>(response)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) {
        const delay = BASE_DELAY * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  throw lastError || new Error(`Request failed: ${path}`)
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json()
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `HTTP ${response.status}`
      throw new ApiError(message, response.status, data?.error)
    }
    return data as T
  }
  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(text || `HTTP ${response.status}`, response.status)
  }
  const text = await response.text()
  return text as unknown as T
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

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' })
}

export async function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body })
}

export async function apiPut<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PUT', body })
}

export async function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE' })
}

export async function apiUpload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
  const { method = 'POST', headers = {}, authenticated = false } = options || {}

  const reqHeaders: Record<string, string> = {
    ...headers,
  }

  if (authenticated) {
    const session = await loadSession()
    if (session?.api_key) {
      reqHeaders['x-squidcloud-key'] = session.api_key
    }
  }

  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: formData,
  })

  return handleResponse<T>(response)
}
