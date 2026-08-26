 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { computeDeviceFingerprint } from './fingerprint.js'
import { loadSession, saveSession, clearSession } from './session.js'
import { SUPABASE_URL, getAnonKey } from './constants.js'

const LOCK_FILE = path.join(os.homedir(), '.squidcloud', '.refresh.lock')

function ensureLockDir() {
  const dir = path.dirname(LOCK_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

async function acquireLock() {
  ensureLockDir()
  let acquired = false
  let attempts = 0
  while (!acquired && attempts < 50) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      acquired = true
    } catch (e) {
      const stat = fs.statSync(LOCK_FILE)
      const age = Date.now() - stat.mtimeMs
      if (age > 10000) {
        try { fs.unlinkSync(LOCK_FILE) } catch (e2) {}
      }
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
  }
  return () => {
    try { fs.unlinkSync(LOCK_FILE) } catch (e3) {}
  }
}














export async function refreshAccessToken() {
  const release = await acquireLock()
  try {
    const session = await loadSession()
    if (!session) return null

    const fingerprint = computeDeviceFingerprint()
    if (session.device_fingerprint !== fingerprint) {
      await clearSession()
      return null
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': getAnonKey(),
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })

    if (!response.ok) {
      await clearSession()
      return null
    }

    const data = await response.json()

    const newSession = {
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at * 1000,
      issued_at: Date.now(),
      device_fingerprint: fingerprint,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: (_optionalChain([data, 'access', _ => _.user, 'access', _2 => _2.user_metadata, 'optionalAccess', _3 => _3.username]) ) || data.user.email.split('@')[0] || 'user',
        plan: 'free',
      },
    }
    await saveSession(newSession)
    return newSession
  } catch (e4) {
    await clearSession()
    return null
  } finally {
    release()
  }
}
