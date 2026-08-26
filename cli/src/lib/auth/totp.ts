import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import chalk from 'chalk'
import { SUPABASE_URL } from './constants.js'
import { authToken } from './oauth-session.js'
import { getSecret, setSecret, deleteSecret } from '../secrets/store.js'
import { success, error as errMark, muted } from '../output/brand.js'

/**
 * Supabase-TOTP step-up for privileged CLI commands (host api, fs mount,
 * fs webdav, keys add/rm, storage rm).
 *
 * Flow: 6-digit code → cli-totp edge fn verifies against the user's enrolled
 * factor → returns a KZA F2FA seed → CLI derives an X-F2FA code and exchanges
 * seed+code at kza-prel/gateway for a short-lived PREL token bound to this
 * machine. Privileged commands refuse to run without a live PREL token.
 */

export const ENROLL_URL = 'https://squidcloud.vercel.app/account/settings'
const GUARD_FN = 'cli-guard'
const ATTEST_TTL_MS = 15 * 60 * 1000
const DEVICE_ID_PATH = path.join(os.homedir(), '.squidcloud', 'device-id')

// ── permanent install identifier (never regenerated) ──
export function machineId(): string {
  try {
    const existing = fs.readFileSync(DEVICE_ID_PATH, 'utf-8').trim()
    if (existing) return existing
  } catch {}
  const id = crypto.randomUUID().replace(/-/g, '')
  fs.mkdirSync(path.dirname(DEVICE_ID_PATH), { recursive: true, mode: 0o700 })
  fs.writeFileSync(DEVICE_ID_PATH, id, { mode: 0o600 })
  return id
}

function deviceId(): string {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.squidcloud', 'credentials'), 'utf-8'))
    return String(meta.device_id || '')
  } catch { return '' }
}

async function totpFetch(action: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!authToken) throw new Error('not authenticated')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cli-totp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'X-SquidCloud-Machine': machineId(),
      ...(deviceId() ? { 'X-SquidCloud-Device-Id': deviceId() } : {}),
    },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  return { status: res.status, ...data }
}

export interface TotpStatus {
  enrolled: boolean
  banned?: boolean
}

export async function getTotpStatus(): Promise<TotpStatus> {
  const d = await totpFetch('status')
  if ((d as any).code === 'KZA_DEVICE_BANNED') return { enrolled: true, banned: true }
  return { enrolled: !!(d as any).enrolled }
}

/** Verify a code now; returns the KZA seed used for subsequent F2FA codes. */
export async function verifyTotpCode(code: string): Promise<{ seed: string; ttlSeconds: number }> {
  const d = await totpFetch('verify', { code }) as any
  if (!d.success) {
    const err = new Error(d.error || 'TOTP verification failed') as Error & { code?: string }
    err.code = d.code
    throw err
  }
  return { seed: String(d.seed), ttlSeconds: Number(d.ttl_seconds || 900) }
}

// ── KZA F2FA client-side derivation (mirrors kza-prel computeF2FACode) ──

function f2faCode(seed: string, functionId: string, window: number): string {
  // True uint64 LE window — must byte-match the server exactly.
  const windowBytes = Buffer.alloc(8)
  let w = Math.floor(window)
  for (let i = 0; i < 8; i++) {
    windowBytes[i] = w % 256
    w = Math.floor(w / 256)
  }
  const hash = crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from(seed + functionId), windowBytes]))
    .digest()
  let code = 0
  for (let i = 0; i < 3; i++) {
    code ^= hash.readInt32LE(i * 8)
    code ^= hash.readInt32LE((i * 8) + 4)
  }
  return String(code % 100000000).padStart(8, '0')
}

interface Attestation { seed: string; prel: string; exp: number }

async function loadAttestation(): Promise<Attestation | null> {
  const [seed, prel] = await Promise.all([getSecret('aal2_seed'), getSecret('aal2_prel')])
  if (!seed || !prel) return null
  // PREL ttl is server-side; keep a conservative local shelf life.
  let exp = 0
  try {
    const payload = JSON.parse(Buffer.from(prel.split('.')[0] === '{' ? prel : '', 'utf-8').toString())
    exp = payload.expiresAt ?? 0
  } catch { /* opaque token — rely on refresh below */ }
  // If we cannot read expiry locally, trust it for the attest window only.
  const storedExp = Number((await getSecret('aal2_exp')) || 0)
  const effective = exp || storedExp
  if (effective && Date.now() > effective) return null
  return { seed, prel, exp: effective }
}

async function saveAttestation(seed: string, prel: string, ttlSeconds: number): Promise<void> {
  await setSecret('aal2_seed', seed)
  await setSecret('aal2_prel', prel)
  await setSecret('aal2_exp', String(Date.now() + Math.min(ttlSeconds, 900) * 1000))
}

async function exchangeSeedForPrel(seed: string, operation: string): Promise<string> {
  // Single attempt: the server already accepts window drift of ±1, and every
  // rejected call counts against the brute-force budget — never loop here.
  const code = f2faCode(seed, GUARD_FN, Math.floor(Date.now() / 30_000))
  const res = await fetch(`${SUPABASE_URL}/functions/v1/kza-prel/gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'X-F2FA': code,
    },
    body: JSON.stringify({ function_id: GUARD_FN, operation }),
  })
  const data = await res.json().catch(() => ({}) as any)
  if (res.ok && data.prel_token) return String(data.prel_token)
  const err = new Error(String(data.error || `HTTP ${res.status}`)) as Error & { code?: string }
  err.code = data.code
  throw err
}

function promptCode(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question('  TOTP code (6 digits): ', a => { rl.close(); resolve(a.replace(/\D/g, '').slice(0, 6)) }))
}

/**
 * Login-time gate: TOTP enrollment is mandatory for CLI/devtools accounts,
 * and every login performs one fresh verification.
 */
export async function enforceTotpAtLogin(): Promise<void> {
  const status = await getTotpStatus()
  if (status.banned) {
    console.error(errMark('This device has been permanently banned after repeated TOTP failures.'))
    process.exit(1)
  }
  if (!status.enrolled) {
    console.error(errMark('TOTP two-factor authentication is mandatory for SquidCloud CLI access.'))
    console.error(muted(`  Enroll at ${ENROLL_URL} → Security Center, then run login again.`))
    process.exit(1)
  }
  if (process.env.SQUIDCLOUD_NONINTERACTIVE === '1' || !process.stdin.isTTY) {
    // Headless login cannot prompt; allow it, but privileged commands will
    // still demand a live verification (stepUp) before doing anything.
    console.log(muted('  headless session — TOTP will be required on first privileged command'))
    return
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await promptCode()
    if (code.length !== 6) continue
    try {
      const { seed } = await verifyTotpCode(code)
      await setSecret('aal2_seed', seed)
      await deleteSecret('aal2_prel')
      console.log(success('Two-factor verified'))
      return
    } catch (e) {
      const err = e as Error & { code?: string }
      console.error(errMark(err.message))
      if (err.code === 'KZA_DEVICE_BANNED') process.exit(1)
    }
  }
  console.error(errMark('TOTP verification failed three times — login aborted.'))
  process.exit(1)
}

/**
 * Mandatory gate for privileged commands. Returns a live PREL token proving
 * a recent TOTP verification, or exits without running anything.
 */
export async function stepUp(operation: string): Promise<string> {
  const cached = await loadAttestation()
  if (cached) {
    try {
      const prel = await exchangeSeedForPrel(cached.seed, operation)
      await saveAttestation(cached.seed, prel, 900)
      return prel
    } catch { /* stale seed — fall through to full prompt */ }
  }

  const status = await getTotpStatus()
  if (status.banned) {
    console.error(errMark('This device is permanently banned (repeated TOTP failures).'))
    process.exit(1)
  }
  if (!status.enrolled) {
    console.error(errMark('TOTP two-factor authentication is mandatory for this command.'))
    console.error(muted(`  Enroll at ${ENROLL_URL} → Security Center, then retry.`))
    process.exit(1)
  }

  if (process.env.SQUIDCLOUD_NONINTERACTIVE === '1' || !process.stdin.isTTY) {
    console.error(errMark(`Privileged command '${operation}' requires a fresh TOTP verification.`))
    console.error(muted('  Re-run interactively to enter your 6-digit authenticator code.'))
    process.exit(1)
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await promptCode()
    if (code.length !== 6) continue
    try {
      const { seed, ttlSeconds } = await verifyTotpCode(code)
      const prel = await exchangeSeedForPrel(seed, operation)
      await saveAttestation(seed, prel, ttlSeconds)
      console.log(success('AAL2 verified'))
      return prel
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'KZA_DEVICE_BANNED') {
        console.error(errMark(err.message))
        await deleteSecret('aal2_seed'); await deleteSecret('aal2_prel')
        process.exit(1)
      }
      console.error(errMark(err.message))
    }
  }
  console.error(errMark('TOTP verification failed three times.'))
  process.exit(1)
}
