 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

export let authToken = null;
export let userEmail = null;
export let tokenExpiresAt = null;
export let anonKey = null;
export let sbToken = null;
export let sbTokenExpiresAt = null;
export let supaClient = null;

const CREDENTIALS_PATH = path.join(os.homedir(), '.squidcloud', 'credentials')

export function setAuthState(
  token,
  email,
  expiresAt,
  sessionAnonKey
) {
  authToken = token
  userEmail = email
  tokenExpiresAt = expiresAt
  if (sessionAnonKey !== undefined) {
    anonKey = sessionAnonKey
  }
}

export function setSupaClient(client) {
  supaClient = client
}










function readCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return null
    const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) 
    if (raw.token && raw.expires_at) return raw
    return null
  } catch (e) {
    return null
  }
}

export function loadSbToken() {
  const creds = readCredentials()
  if (_optionalChain([creds, 'optionalAccess', _ => _.sb_token]) && creds.sb_expires_at && creds.sb_expires_at * 1000 > Date.now()) {
    sbToken = creds.sb_token
    sbTokenExpiresAt = creds.sb_expires_at * 1000
  } else {
    sbToken = null
    sbTokenExpiresAt = null
  }
}

export async function loadOAuthSession() {
  const creds = readCredentials()
  if (!creds) {
    setAuthState(null, null, null, null)
    return
  }
  const now = Date.now()
  if (creds.expires_at * 1000 > now) {
    setAuthState(creds.token, creds.email, creds.expires_at * 1000, creds.anon_key || null)
  } else {
    try { fs.rmSync(CREDENTIALS_PATH, { force: true }) } catch (e2) {}
    setAuthState(null, null, null, null)
  }
}

export async function clearOAuthSession() {
  try { fs.rmSync(CREDENTIALS_PATH, { force: true }) } catch (e3) {}
  setAuthState(null, null, null, null)
}

export function getCredentialsPath() {
  return CREDENTIALS_PATH
}

export function writeSbTokenFromUrl(jwt) {
  // Supabase JWTs live ~1h; persist with a conservative 55-minute shelf life.
  const exp = Math.floor((Date.now() + 55 * 60 * 1000) / 1000)
  try {
    const creds = _nullishCoalesce(readCredentials(), () => ( ({ token: '', email: 'unknown', expires_at: 0 } )))
    writeCredentials({ ...creds, sb_token: jwt, sb_expires_at: exp })
  } catch (e4) {}
  sbToken = jwt
  sbTokenExpiresAt = exp * 1000
}

export function writeCredentials(creds) {
  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 })
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds), { mode: 0o600 })
}
