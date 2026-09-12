/**
 * KZA Client — SquidCloud
 * Drop in: src/lib/kzaClient.ts
 *
 * WHY VITE_ env vars and not Supabase secrets:
 *   Supabase secrets only exist inside edge functions (Deno server-side).
 *   The browser has zero access to them — they're never sent to clients.
 *   VITE_ vars are the correct approach for anything the browser needs.
 *   The KZA_CLIENT_SECRET in the bundle is intentional — it's a HMAC
 *   signing identity, not a password. Even if someone extracts it, they
 *   still can't bypass auth (JWT) or RLS. It just raises the bar for
 *   unsigned curl attacks.
 *
 * .env setup:
 *   VITE_KZA_CLIENT_SECRET=<copy from Supabase Dashboard → Edge Functions → Secrets>
 *   VITE_KZA_CLIENT_ID=squidcloud-web
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL as PROJECT_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseEnv';

const SECRET    = import.meta.env.VITE_KZA_CLIENT_SECRET as string
const CLIENT_ID = (import.meta.env.VITE_KZA_CLIENT_ID ?? 'squidcloud-web') as string

if (!SECRET) {
  console.warn('[KZA] VITE_KZA_CLIENT_SECRET is not set — requests will be unsigned')
}

// ── HMAC-SHA256 signing ──────────────────────────────────────────────────────
async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signedHeaders(method: string, pathname: string): Promise<Record<string, string>> {
  if (!SECRET) return {}
  const ts  = Date.now().toString()
  const sig = await hmacHex(SECRET, `${ts}:${CLIENT_ID}:${method}:${pathname}`)
  return { 'x-sc-ts': ts, 'x-sc-sig': sig, 'x-sc-client': CLIENT_ID }
}

// ── Result type ──────────────────────────────────────────────────────────────
export interface KzaResult {
  ok: boolean
  blocked: boolean
  score?: number
  tier?: string | null
  code?: string
  country?: string
  reason?: string
}

// ── Core check ──────────────────────────────────────────────────────────────
/**
 * Run a KZA threat check before any sensitive operation.
 *
 * @param url       The URL being requested (used for anomaly scoring)
 * @param method    HTTP method e.g. 'POST'
 * @param body      Optional request body string (redacted server-side)
 */
export async function kzaCheck(
  url: string,
  method = 'POST',
  body = ''
): Promise<KzaResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const projectUrl = PROJECT_URL
  const anonKey    = SUPABASE_ANON_KEY
  const sentinelUrl = `${projectUrl}/functions/v1/kza-sentinel`
  const pathname    = new URL(sentinelUrl).pathname

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(await signedHeaders('POST', pathname)),
  }

  try {
    const res = await fetch(sentinelUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, method, body_snapshot: body.substring(0, 500) }),
    })

    // Only an explicit 403/KZA_BLOCKED verdict blocks. Every other
    // non-OK status (404 shadow canary, 429 tracking, 5xx, unsigned
    // 401s, CORS/edge errors) is NOT a verdict — fail open so legit
    // users are never locked out by sentinel availability issues.
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, blocked: true, code: data.code ?? 'KZA_BLOCKED', country: data.country, reason: data.reason }
    }

    if (!res.ok) {
      console.warn(`[KZA] Sentinel status ${res.status} is not a block verdict — failing open`)
      return { ok: true, blocked: false }
    }

    const data = await res.json()
    return { ok: true, blocked: false, score: data.score, tier: data.tier }
  } catch {
    // Fail-open by default; VITE_KZA_FAIL_CLOSED=1 makes KZA a hard gate.
    const failClosed = (import.meta.env.VITE_KZA_FAIL_CLOSED as string) === '1'
    if (failClosed) {
      console.error('[KZA] Sentinel unreachable — failing closed')
      return { ok: false, blocked: true, code: 'KZA_UNAVAILABLE' }
    }
    console.warn('[KZA] Sentinel unreachable — failing open')
    return { ok: true, blocked: false }
  }
}

// ── Higher-order wrapper ─────────────────────────────────────────────────────
/**
 * Wrap any async function with a KZA gate.
 * If KZA blocks, fn is never called and an error is thrown.
 *
 * @example
 *   const result = await withKza(
 *     () => uploadFile(file),
 *     window.location.href, 'POST', JSON.stringify(meta)
 *   )
 */
export async function withKza<T>(
  fn: () => Promise<T>,
  url: string,
  method = 'POST',
  body = ''
): Promise<T> {
  const check = await kzaCheck(url, method, body)
  if (check.blocked) {
    throw new Error(`KZA_BLOCKED:${check.code ?? 'UNKNOWN'}`)
  }
  return fn()
}

// ── Convenience hooks ────────────────────────────────────────────────────────
/** Use before file upload */
export const kzaBeforeUpload = (filename: string) =>
  kzaCheck(window.location.href, 'POST', JSON.stringify({ filename }))

/** Use before file delete */
export const kzaBeforeDelete = (fileId: string) =>
  kzaCheck(window.location.href, 'DELETE', JSON.stringify({ fileId }))

/** Use before share link creation */
export const kzaBeforeShare = (fileId: string) =>
  kzaCheck(window.location.href, 'POST', JSON.stringify({ action: 'share', fileId }))

/** Use before admin dashboard load */
export const kzaBeforeAdmin = () =>
  kzaCheck(window.location.href, 'GET', '')
