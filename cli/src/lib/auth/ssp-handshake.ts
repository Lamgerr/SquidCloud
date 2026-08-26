import { createHash, randomBytes } from 'node:crypto'
import { SquidSession } from '../crypto/ssp.js'
import { saveSession } from './session.js'
import { computeDeviceFingerprint } from './fingerprint.js'
import { SUPABASE_URL, getAnonKey } from './constants.js'

interface SupabaseAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
  refresh_token: string
  user: {
    id: string
    email: string
    user_metadata: Record<string, unknown>
    aud: string
  }
}

function generateApiKey(): string {
  return 'sqc_' + randomBytes(32).toString('hex')
}

function hashApiKey(key: string): { hash: string; prefix: string; salt: string } {
  const salt = randomBytes(16).toString('base64')
  const saltBytes = Buffer.from(salt, 'base64')
  const combined = Buffer.concat([saltBytes, Buffer.from(key)])
  const hash = createHash('sha256').update(combined).digest('hex')
  return { hash, prefix: key.slice(0, 8), salt }
}

export async function performSSPHandshake(email: string, password: string): Promise<SquidSession> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': getAnonKey(),
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Authentication failed (HTTP ${response.status})`)
  }

  const data: SupabaseAuthResponse = await response.json()
  const fingerprint = computeDeviceFingerprint()

  const apiKey = generateApiKey()
  const { hash, prefix, salt } = hashApiKey(apiKey)

  const createKeyResponse = await fetch(`${SUPABASE_URL}/rest/v1/api_keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': getAnonKey(),
      'Authorization': `Bearer ${data.access_token}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      user_id: data.user.id,
      name: 'squidcloud-cli',
      key_hash: hash,
      key_prefix: prefix,
      key_salt: salt,
      scopes: ['all'],
      is_active: true,
    }),
  })

  if (!createKeyResponse.ok) {
    const text = await createKeyResponse.text()
    console.error('API key creation failed:', text)
  }

  const session: SquidSession = {
    session_id: data.user.id + '-' + Date.now(),
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    refresh_token_id: '',
    device_fingerprint: fingerprint,
    issued_at: Date.now(),
    expires_at: data.expires_at * 1000,
    user: {
      id: data.user.id,
      email: data.user.email,
      username: (data.user.user_metadata?.username as string) || data.user.email.split('@')[0] || 'user',
      plan: 'free',
    },
    api_key: apiKey,
  }

  await saveSession(session)
  return session
}
