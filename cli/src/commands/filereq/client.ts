import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { authToken, anonKey, sbToken } from '../../lib/auth/oauth-session.js'

/** File requests live in PostgREST — the CLI OAuth token is a valid Supabase
    JWT, so RLS applies exactly as it does for the dashboard. */
async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!sbToken) {
    throw new Error(
      'File requests need an upgraded session. Re-run `squidcloudctl login` (browser flow) and try again.',
    )
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sbToken}`,
      apikey: anonKey || '',
      Accept: 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(String((data as any)?.message || `HTTP ${res.status}`))
  return data as T
}

export async function listRequests<T>(): Promise<T> {
  return rest<T>(`/file_requests?select=*&order=created_at.desc`)
}

export async function createRequest<T>(p: Record<string, unknown>): Promise<T> {
  return rest<T>(`/rpc/create_file_request`, { method: 'POST', body: JSON.stringify(p) })
}

export async function submissionsFor<T>(id: string): Promise<T> {
  return rest<T>(`/file_request_submissions?select=*,file:files(id,name,type,size)&file_request_id=eq.${id}&order=created_at.desc`)
}

export async function deleteRequest(id: string): Promise<void> {
  await rest(`/file_requests?id=eq.${id}`, { method: 'DELETE' })
}
