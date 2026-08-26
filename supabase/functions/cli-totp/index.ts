// cli-totp — Supabase-TOTP verification for SquidCloud CLI privileged commands.
//
// The CLI authenticates with an opaque device token (cli_devices.token_hash),
// so it cannot call supabase.auth.mfa.* itself. This function verifies the
// user's enrolled TOTP factor server-side (reading the factor secret directly
// from auth.mfa_factors), then:
//   • stamps cli_devices.aal2_verified_at
//   • issues a KZA F2FA seed (function_id='cli-guard') so the CLI can derive
//     X-F2FA codes for kza-prel /gateway — the actual enforcement layer
//
// Brute force: 3 failures / 5 min bans the DEVICE and the permanent MACHINE
// identifier — never the whole user account.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.5'
import { getCorsHeaders } from '../_shared/kza-prel.ts'

const GUARD_FN = 'cli-guard'
const FAIL_WINDOW_MS = 5 * 60 * 1000
const FAIL_LIMIT = 3

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Opaque SquidCloud CLI device token -> user_id + device row. */
async function resolveCliDevice(supabase: any, token: string) {
  if (!token || token.includes('.')) return null
  const hash = await sha256Hex(token)
  const { data: dev } = await supabase
    .from('cli_devices')
    .select('id, user_id, machine_id, is_banned, aal2_verified_at')
    .eq('token_hash', hash)
    .maybeSingle()
  return dev ?? null
}

// ── RFC 6238 (TOTP, SHA-1, 6 digits) against the enrolled factor secret ──

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hotp(secretB32: string, counter: number): Promise<string> {
  const key = base32Decode(secretB32)
  const msg = new Uint8Array(8)
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', keyObj, msg))
  const offset = sig[sig.length - 1] & 0x0f
  const bin =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}

async function verifyTotpSecret(secretB32: string, code: string): Promise<boolean> {
  const window = Math.floor(Date.now() / 30_000)
  for (const drift of [0, -1, 1]) {
    if (constantTimeEqual(await hotp(secretB32, window + drift), code)) return true
  }
  return false
}

/** Read verified TOTP secrets for a user straight from auth.mfa_factors. */
async function fetchTotpSecrets(userId: string): Promise<string[]> {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL')
  if (!dbUrl) throw new Error('SUPABASE_DB_URL not configured')
  const sql = postgres(dbUrl, { prepare: false, max: 1 })
  try {
    const rows = await sql`
      SELECT secret FROM auth.mfa_factors
      WHERE user_id = ${userId} AND status = 'verified' AND factor_type = 'totp'`
    return rows.map((r: { secret: string }) => r.secret)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function hasVerifiedTotpFactor(_admin: any, userId: string): Promise<boolean> {
  // Same SQL path as verification — admin MFA API shape varies across
  // supabase-js versions; auth.mfa_factors via service SQL is authoritative.
  try {
    const secrets = await fetchTotpSecrets(userId)
    return secrets.length > 0
  } catch (e) {
    console.error('[cli-totp] factor lookup:', e instanceof Error ? e.message : e)
    return false
  }
}

async function isDeviceBanned(supabase: any, deviceId: string, machineId: string): Promise<boolean> {
  const or = [`and(entity_type.eq.DEVICE,entity_value.eq.${deviceId})`]
  if (machineId) or.push(`and(entity_type.eq.MACHINE,entity_value.eq.${machineId})`)
  const { count } = await supabase
    .from('kza_banned_entities')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or(or.join(','))
  return (count ?? 0) > 0
}

async function recordFailureAndMaybeBan(
  supabase: any,
  ctx: { userId: string; deviceId: string; machineId: string; ip: string },
): Promise<{ bannedNow: boolean; failCount: number }> {
  await supabase.from('kza_threat_events').insert({
    user_id: ctx.userId,
    threat_tier: 'YELLOW',
    threat_type: 'F2FA_FAILURE',
    description: 'CLI TOTP verification failed',
    payload_snapshot: { device_id: ctx.deviceId, machine_id_hash: ctx.machineId ? await sha256Hex(ctx.machineId) : null },
    endpoint_hit: '/cli-totp/verify',
    method: 'POST',
    ip_address: ctx.ip,
  })

  const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('kza_threat_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('threat_type', 'F2FA_FAILURE')
    .gte('created_at', since)

  const failCount = count ?? 0
  if (failCount < FAIL_LIMIT) return { bannedNow: false, failCount }

  // Ban the device + machine — the account itself stays untouched.
  const rows: Array<Record<string, unknown>> = [
    {
      user_id: ctx.userId,
      entity_type: 'DEVICE',
      entity_value: ctx.deviceId,
      ban_type: 'PERMANENT',
      ban_reason: 'CLI_TOTP_BRUTE_FORCE',
      ban_tier: 'RED',
      attack_summary: `${failCount} TOTP failures in ${FAIL_WINDOW_MS / 1000}s from this device`,
      banned_by: 'KZA_AUTO',
    },
  ]
  if (ctx.machineId) {
    rows.push({
      user_id: ctx.userId,
      entity_type: 'MACHINE',
      entity_value: ctx.machineId,
      ban_type: 'PERMANENT',
      ban_reason: 'CLI_TOTP_BRUTE_FORCE',
      ban_tier: 'RED',
      attack_summary: `permanent install identifier of banned device ${ctx.deviceId}`,
      banned_by: 'KZA_AUTO',
    })
  }
  await supabase.from('kza_banned_entities').insert(rows)
  return { bannedNow: true, failCount }
}

serve(async (req) => {
  try {
    return await handle(req)
  } catch (e) {
    console.error('[cli-totp] unhandled:', e instanceof Error ? e.stack : e)
    return json({ success: false, error: 'Internal Server Error' }, 500)
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders() })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const deviceIdHdr = req.headers.get('x-squidcloud-device-id') ?? ''
  const machineHdr = req.headers.get('x-squidcloud-machine') ?? ''

  const dev = await resolveCliDevice(supabase, token)
  if (!dev?.user_id) return json({ success: false, error: 'Invalid CLI token' }, 401)

  const deviceId = dev.id || deviceIdHdr
  const machineId = dev.machine_id || machineHdr
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (await isDeviceBanned(supabase, deviceId, machineId)) {
    return json({
      success: false,
      error: 'This device has been permanently banned after repeated TOTP failures. Contact support.',
      code: 'KZA_DEVICE_BANNED',
    }, 403)
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body allowed for status */ }
  const action = String(body.action ?? (body.code != null ? 'verify' : 'status'))

  // ---------- STATUS ----------
  if (action === 'status') {
    const enrolled = await hasVerifiedTotpFactor(supabase, dev.user_id)
    return json({
      success: true,
      enrolled,
      aal2_recently: !!dev.aal2_verified_at &&
        Date.now() - new Date(dev.aal2_verified_at).getTime() < 15 * 60 * 1000,
    }, 200)
  }

  // ---------- VERIFY ----------
  if (action !== 'verify') return json({ success: false, error: 'Unknown action' }, 400)

  const code = String(body.code ?? '').replace(/\D/g, '')
  if (code.length !== 6) return json({ success: false, error: '6-digit code required' }, 400)

  let secrets: string[]
  try {
    secrets = await fetchTotpSecrets(dev.user_id)
  } catch (e) {
    console.error('[cli-totp]', e instanceof Error ? e.message : e)
    return json({ success: false, error: 'Server configuration error' }, 500)
  }

  let ok = false
  for (const secret of secrets) {
    if (await verifyTotpSecret(secret, code)) { ok = true; break }
  }

  if (!ok) {
    const { bannedNow, failCount } = await recordFailureAndMaybeBan(supabase, {
      userId: dev.user_id, deviceId, machineId, ip,
    })
    return json({
      success: false,
      error: bannedNow
        ? 'Too many failed codes — this device has been permanently banned.'
        : `Invalid verification code. ${FAIL_LIMIT - failCount} attempt${FAIL_LIMIT - failCount === 1 ? '' : 's'} left before this device is banned.`,
      code: bannedNow ? 'KZA_DEVICE_BANNED' : 'KZA_TOTP_FAILED',
    }, bannedNow ? 403 : 403)
  }

  // Success: attest the device + mint the KZA seed for cli-guard.
  await supabase
    .from('cli_devices')
    .update({ aal2_verified_at: new Date().toISOString() })
    .eq('id', deviceId)

  await supabase
    .from('kza_prel_f2fa_seeds')
    .update({ is_active: false })
    .eq('user_id', dev.user_id)
    .eq('function_id', GUARD_FN)
    .eq('is_active', true)

  const seed = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await supabase.from('kza_prel_f2fa_seeds').insert({
    user_id: dev.user_id,
    function_id: GUARD_FN,
    day_seed: crypto.randomUUID(),
    session_nonce: crypto.randomUUID(),
    seed_derived: seed,
    is_active: true,
    issued_by: 'cli-totp',
  })

  return json({ success: true, function_id: GUARD_FN, seed, ttl_seconds: 900 }, 200)
}
