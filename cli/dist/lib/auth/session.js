
import { storeSession, getSession, deleteSession } from './keychain.js'

export async function loadSession() {
  try {
    const raw = await getSession()
    if (!raw) return null
    const session = JSON.parse(raw) 
    if (!session.session_id || !session.access_token) {
      await deleteSession()
      return null
    }
    return session
  } catch (e) {
    await deleteSession()
    return null
  }
}

export async function saveSession(session) {
  await storeSession(JSON.stringify(session))
}

export async function clearSession() {
  await deleteSession()
}

export function isSessionExpired(session) {
  return Date.now() >= session.expires_at
}

export function shouldRefreshToken(session) {
  const twoMinutes = 2 * 60 * 1000
  return (session.expires_at - Date.now()) <= twoMinutes
}

export function getTimeUntilExpiry(session) {
  return session.expires_at - Date.now()
}
