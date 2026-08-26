import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

export let authToken: string | null = null;
export let userEmail: string | null = null;
export let tokenExpiresAt: number | null = null;
export let anonKey: string | null = null;
export let sbToken: string | null = null;
export let sbTokenExpiresAt: number | null = null;
export let supaClient: any = null;

const CREDENTIALS_PATH = path.join(os.homedir(), '.squidcloud', 'credentials')

export function setAuthState(
  token: string | null,
  email: string | null,
  expiresAt: number | null,
  sessionAnonKey?: string | null
): void {
  authToken = token
  userEmail = email
  tokenExpiresAt = expiresAt
  if (sessionAnonKey !== undefined) {
    anonKey = sessionAnonKey
  }
}

export function setSupaClient(client: any): void {
  supaClient = client
}

interface CredFile {
  token: string
  email?: string
  expires_at: number
  anon_key?: string
  sb_token?: string
  sb_expires_at?: number
}

function readCredentials(): CredFile | null {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return null
    const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as CredFile
    if (raw.token && raw.expires_at) return raw
    return null
  } catch {
    return null
  }
}

export function loadSbToken(): void {
  const creds = readCredentials()
  if (creds?.sb_token && creds.sb_expires_at && creds.sb_expires_at * 1000 > Date.now()) {
    sbToken = creds.sb_token
    sbTokenExpiresAt = creds.sb_expires_at * 1000
  } else {
    sbToken = null
    sbTokenExpiresAt = null
  }
}

export async function loadOAuthSession(): Promise<void> {
  const creds = readCredentials()
  if (!creds) {
    setAuthState(null, null, null, null)
    return
  }
  const now = Date.now()
  if (creds.expires_at * 1000 > now) {
    setAuthState(creds.token, creds.email, creds.expires_at * 1000, creds.anon_key || null)
  } else {
    try { fs.rmSync(CREDENTIALS_PATH, { force: true }) } catch {}
    setAuthState(null, null, null, null)
  }
}

export async function clearOAuthSession(): Promise<void> {
  try { fs.rmSync(CREDENTIALS_PATH, { force: true }) } catch {}
  setAuthState(null, null, null, null)
}

export function getCredentialsPath(): string {
  return CREDENTIALS_PATH
}

export function writeSbTokenFromUrl(jwt: string): void {
  // Supabase JWTs live ~1h; persist with a conservative 55-minute shelf life.
  const exp = Math.floor((Date.now() + 55 * 60 * 1000) / 1000)
  try {
    const creds = readCredentials() ?? ({ token: '', email: 'unknown', expires_at: 0 } as CredFile)
    writeCredentials({ ...creds, sb_token: jwt, sb_expires_at: exp })
  } catch {}
  sbToken = jwt
  sbTokenExpiresAt = exp * 1000
}

export function writeCredentials(creds: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 })
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds), { mode: 0o600 })
}
