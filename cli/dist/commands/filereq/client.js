 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { anonKey, sbToken } from '../../lib/auth/oauth-session.js'

/** File requests live in PostgREST — the CLI OAuth token is a valid Supabase
    JWT, so RLS applies exactly as it does for the dashboard. */
async function rest(path, init = {}) {
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
  if (!res.ok) throw new Error(String(_optionalChain([(data ), 'optionalAccess', _ => _.message]) || `HTTP ${res.status}`))
  return data 
}

export async function listRequests() {
  return rest(`/file_requests?select=*&order=created_at.desc`)
}

export async function createRequest(p) {
  return rest(`/rpc/create_file_request`, { method: 'POST', body: JSON.stringify(p) })
}

export async function submissionsFor(id) {
  return rest(`/file_request_submissions?select=*,file:files(id,name,type,size)&file_request_id=eq.${id}&order=created_at.desc`)
}

export async function deleteRequest(id) {
  await rest(`/file_requests?id=eq.${id}`, { method: 'DELETE' })
}
