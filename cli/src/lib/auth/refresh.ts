import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SquidSession } from '../crypto/ssp.js'
import { computeDeviceFingerprint } from './fingerprint.js'
import { loadSession, saveSession, clearSession } from './session.js'
import { SUPABASE_URL, getAnonKey } from './constants.js'

const LOCK_FILE = path.join(os.homedir(), '.squidcloud', '.refresh.lock')

function ensureLockDir(): void {
  const dir = path.dirname(LOCK_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

async function acquireLock(): Promise<() => void> {
  ensureLockDir()
  let acquired = false
  let attempts = 0
  while (!acquired && attempts < 50) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      acquired = true
    } catch {
      const stat = fs.statSync(LOCK_FILE)
      const age = Date.now() - stat.mtimeMs
      if (age > 10000) {
        try { fs.unlinkSync(LOCK_FILE) } catch {}
      }
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
  }
  return () => {
    try { fs.unlinkSync(LOCK_FILE) } catch {}
  }
}

interface SupabaseRefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
  refresh_token: string
  user: {
    id: string
    email: string
    user_metadata: Record<string, unknown>
  }
}

export async function refreshAccessToken(): Promise<SquidSession | null> {
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

    const data: SupabaseRefreshResponse = await response.json()

    const newSession: SquidSession = {
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at * 1000,
      issued_at: Date.now(),
      device_fingerprint: fingerprint,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: (data.user.user_metadata?.username as string) || data.user.email.split('@')[0] || 'user',
        plan: 'free',
      },
    }
    await saveSession(newSession)
    return newSession
  } catch {
    await clearSession()
    return null
  } finally {
    release()
  }
}
