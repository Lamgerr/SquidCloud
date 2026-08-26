 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { authToken, anonKey, sbToken } from '../../lib/auth/oauth-session.js'

/** sites-api authenticates with the Supabase JWT — the CLI OAuth token is one. */
export async function sitesApi(action, params = {}) {
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
  if (!res.ok) throw new Error(String(_optionalChain([(data ), 'optionalAccess', _ => _.error]) || `HTTP ${res.status}`))
  return data 
}
