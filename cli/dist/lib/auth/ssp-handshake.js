 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { createHash, randomBytes } from 'node:crypto'

import { saveSession } from './session.js'
import { computeDeviceFingerprint } from './fingerprint.js'
import { SUPABASE_URL, getAnonKey } from './constants.js'















function generateApiKey() {
  return 'sqc_' + randomBytes(32).toString('hex')
}

function hashApiKey(key) {
  const salt = randomBytes(16).toString('base64')
  const saltBytes = Buffer.from(salt, 'base64')
  const combined = Buffer.concat([saltBytes, Buffer.from(key)])
  const hash = createHash('sha256').update(combined).digest('hex')
  return { hash, prefix: key.slice(0, 8), salt }
}

export async function performSSPHandshake(email, password) {
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

  const data = await response.json()
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

  const session = {
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
      username: (_optionalChain([data, 'access', _ => _.user, 'access', _2 => _2.user_metadata, 'optionalAccess', _3 => _3.username]) ) || data.user.email.split('@')[0] || 'user',
      plan: 'free',
    },
    api_key: apiKey,
  }

  await saveSession(session)
  return session
}
