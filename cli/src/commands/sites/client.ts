import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { authToken, anonKey, sbToken } from '../../lib/auth/oauth-session.js'

/** sites-api authenticates with the Supabase JWT — the CLI OAuth token is one. */
export async function sitesApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const jwt = sbToken || authToken
  if (!jwt) throw new Error('Not authenticated')
  if (!sbToken) {
    console.error('  note: re-run `squidcloudctl login` for full sites access (JWT session)')
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sites-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, ...(anonKey ? { apikey: anonKey } : {}) },
    body: JSON.stringify({ action, ...params }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(String((data as any)?.error || `HTTP ${res.status}`))
  return data as T
}
