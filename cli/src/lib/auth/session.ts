import { SquidSession } from '../crypto/ssp.js'
import { storeSession, getSession, deleteSession } from './keychain.js'

export async function loadSession(): Promise<SquidSession | null> {
  try {
    const raw = await getSession()
    if (!raw) return null
    const session = JSON.parse(raw) as SquidSession
    if (!session.session_id || !session.access_token) {
      await deleteSession()
      return null
    }
    return session
  } catch {
    await deleteSession()
    return null
  }
}

export async function saveSession(session: SquidSession): Promise<void> {
  await storeSession(JSON.stringify(session))
}

export async function clearSession(): Promise<void> {
  await deleteSession()
}

export function isSessionExpired(session: SquidSession): boolean {
  return Date.now() >= session.expires_at
}

export function shouldRefreshToken(session: SquidSession): boolean {
  const twoMinutes = 2 * 60 * 1000
  return (session.expires_at - Date.now()) <= twoMinutes
}

export function getTimeUntilExpiry(session: SquidSession): number {
  return session.expires_at - Date.now()
}
