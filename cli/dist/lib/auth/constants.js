import { anonKey as sessionAnonKey } from './oauth-session.js'

export const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co'

export function getAnonKey() {
  return sessionAnonKey || process.env.SQUIDCLOUD_ANON_KEY || ''
}

export { SUPABASE_URL as SUPABASE_URL_RAW }
