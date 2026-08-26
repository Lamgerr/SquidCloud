import crypto from 'node:crypto'
import type { MicroRedis } from './microredis.js'

/* Security layer for the local API host — prebuilt profiles pushed to the
   limit: signed requests, replay guards, per-key scopes, lockouts, IP pins. */

export type SecurityProfile = 'standard' | 'hardened' | 'paranoid'

export interface SecurityConfig {
  profile: SecurityProfile
  requireKey: boolean
  requireHmac: boolean
  requireTimestamp: boolean
  maxBodyBytes: number
  rpsPerKey: number
  burstPerKey: number
  allowIps: string[]
  nonceTtlMs: number
  lockoutThreshold: number
  lockoutMs: number
  cacheTtlMs: number
}

const PROFILES: Record<SecurityProfile, Omit<SecurityConfig, 'profile'>> = {
  standard: {
    requireKey: false, requireHmac: false, requireTimestamp: false,
    maxBodyBytes: 512 * 1024 * 1024, rpsPerKey: 50, burstPerKey: 100,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 60_000,
    lockoutThreshold: 25, lockoutMs: 60_000, cacheTtlMs: 5_000,
  },
  hardened: {
    requireKey: true, requireHmac: false, requireTimestamp: true,
    maxBodyBytes: 512 * 1024 * 1024, rpsPerKey: 120, burstPerKey: 240,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 300_000,
    lockoutThreshold: 10, lockoutMs: 300_000, cacheTtlMs: 15_000,
  },
  paranoid: {
    requireKey: true, requireHmac: true, requireTimestamp: true,
    maxBodyBytes: 64 * 1024 * 1024, rpsPerKey: 200, burstPerKey: 400,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 600_000,
    lockoutThreshold: 3, lockoutMs: 900_000, cacheTtlMs: 30_000,
  },
}

export function resolveProfile(
  profileName: string,
  overrides: { mode?: string; hmac?: boolean; rps?: number; maxBody?: string; ips?: string[] } = {},
): SecurityConfig {
  const base = PROFILES[(profileName as SecurityProfile) in PROFILES ? (profileName as SecurityProfile) : 'standard']
  const cfg: SecurityConfig = {
    profile: (profileName as SecurityProfile) in PROFILES ? (profileName as SecurityProfile) : 'standard',
    ...base,
  }
  if (overrides.mode === 'open') cfg.requireKey = false
  if (overrides.mode === 'keyed') cfg.requireKey = true
  if (overrides.hmac) cfg.requireHmac = true
  if (overrides.rps) cfg.rpsPerKey = overrides.rps
  if (overrides.maxBody) {
    const m = overrides.maxBody.match(/^(\d+)([kmg]?)b?$/i)
    if (m) {
      const mult = m[2]?.toLowerCase() === 'g' ? 1024 ** 3 : m[2]?.toLowerCase() === 'm' ? 1024 ** 2 : m[2]?.toLowerCase() === 'k' ? 1024 : 1
      cfg.maxBodyBytes = Number(m[1]) * mult
    }
  }
  if (overrides.ips && overrides.ips.length > 0) cfg.allowIps = overrides.ips
  return cfg
}

/** Local API keys — sk_live-…, stored hashed inside MicroRedis. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(24).toString('hex')
  const key = `sk_local-${raw}`
  return { key, hash: sha256(key), prefix: key.slice(0, 14) }
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function hmacSignature(secret: string, method: string, path: string, timestamp: string, bodyHash: string): string {
  return crypto.createHmac('sha256', secret).update(`${method.toUpperCase()}|${path}|${timestamp}|${bodyHash}`).digest('hex')
}

export interface AuthResult {
  ok: boolean
  status?: number
  error?: string
  keyId?: string
}

export function authenticateRequest(
  req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string }; method?: string; url?: string },
  cfg: SecurityConfig,
  redis: MicroRedis,
  bodyBuffer?: Buffer,
): AuthResult {
  const ip = normalizeIp(req.socket.remoteAddress)

  // IP pinning — loopback unless explicitly widened.
  if (!cfg.allowIps.some((a) => a === '*' || a === ip)) {
    return { ok: false, status: 403, error: `IP ${ip} is not allowed by this profile` }
  }

  const hdr = (n: string): string => {
    const v = req.headers[n]
    return Array.isArray(v) ? v[0] ?? '' : v ?? ''
  }
  const authHeader = hdr('authorization')

  let keyId = 'anonymous'

  if (cfg.requireKey) {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token.startsWith('sk_local-')) {
      return { ok: false, status: 401, error: 'Missing or malformed local key (expected: Authorization: Bearer sk_local-…)' }
    }
    const hash = sha256(token)
    if (!redis.get(`key:${hash}`)) {
      // Brute-force lockout per IP.
      const fails = redis.incr(`fail:${ip}`)
      redis.expire(`fail:${ip}`, cfg.lockoutMs)
      if (fails >= cfg.lockoutThreshold) {
        redis.set(`lock:${ip}`, '1', cfg.lockoutMs)
      }
      return { ok: false, status: 401, error: 'Invalid local key' }
    }
    if (redis.get(`lock:${ip}`)) {
      return { ok: false, status: 429, error: 'Locked out — too many invalid keys from this IP' }
    }
    keyId = redis.get(`key:${hash}`) || 'local'

    // Per-key rate bucket.
    const bucket = `rate:${hash}`
    const win = Math.max(1, cfg.burstPerKey > cfg.rpsPerKey ? 1000 : 1000)
    const rate = redis.hitRate(bucket, cfg.rpsPerKey * (win / 1000), win)
    if (!rate.ok) {
      return { ok: false, status: 429, error: `Local rate limit exceeded (${cfg.rpsPerKey} req/s/key)` }
    }
  } else {
    // Open mode still gets an anonymous bucket so one runaway client cannot
    // hammer SquidCloud through the host.
    const rate = redis.hitRate(`anon:${ip}`, cfg.rpsPerKey, 1000)
    if (!rate.ok) return { ok: false, status: 429, error: `Rate limit exceeded (${cfg.rpsPerKey} req/s)` }
  }

  // Timestamp + replay guard.
  if (cfg.requireTimestamp) {
    const ts = Number(hdr('x-timestamp'))
    if (!ts || Math.abs(Date.now() - ts) > 60_000) {
      return { ok: false, status: 401, error: 'Missing/stale X-Timestamp (±60s window)' }
    }
    const nonce = hdr('x-nonce') || `${ts}:${bodyHashOf(bodyBuffer)}`
    if (!redis.seenNonce(nonce, cfg.nonceTtlMs)) {
      return { ok: false, status: 409, error: 'Replayed request (nonce already seen)' }
    }
  }

  // HMAC request signing (paranoid / opt-in).
  if (cfg.requireHmac) {
    const secret = process.env.SQUIDCLOUD_HOST_HMAC_SECRET || redis.get('host:hmac-secret') || ''
    if (!secret) return { ok: false, status: 500, error: 'HMAC required but no secret configured (--hmac-secret)' }
    const sig = hdr('x-signature')
    const ts = hdr('x-timestamp') || String(Date.now())
    const expected = hmacSignature(secret, req.method || '', (req.url || '/').split('?')[0], ts, bodyHashOf(bodyBuffer))
    if (!sig || !safeEqual(sig, expected)) {
      return { ok: false, status: 401, error: 'Invalid X-Signature' }
    }
  }

  return { ok: true, keyId }
}

function bodyHashOf(buf?: Buffer): string {
  return buf && buf.length > 0 ? crypto.createHash('sha256').update(buf).digest('hex') : 'empty'
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

function normalizeIp(ip?: string): string {
  if (!ip) return ''
  return ip.replace(/^::ffff:/, '')
}
