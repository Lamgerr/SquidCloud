 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import crypto from 'node:crypto'


/* Security layer for the local API host — prebuilt profiles pushed to the
   limit: signed requests, replay guards, per-key scopes, lockouts, IP pins. */

 
















const PROFILES = {
  standard: {
    requireKey: false, requireHmac: false, requireTimestamp: false,
    maxBodyBytes: 512 * 1024 * 1024, rpsPerKey: 50, burstPerKey: 100,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 60000,
    lockoutThreshold: 25, lockoutMs: 60000, cacheTtlMs: 5000,
  },
  hardened: {
    requireKey: true, requireHmac: false, requireTimestamp: true,
    maxBodyBytes: 512 * 1024 * 1024, rpsPerKey: 120, burstPerKey: 240,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 300000,
    lockoutThreshold: 10, lockoutMs: 300000, cacheTtlMs: 15000,
  },
  paranoid: {
    requireKey: true, requireHmac: true, requireTimestamp: true,
    maxBodyBytes: 64 * 1024 * 1024, rpsPerKey: 200, burstPerKey: 400,
    allowIps: ['127.0.0.1', '::1'], nonceTtlMs: 600000,
    lockoutThreshold: 3, lockoutMs: 900000, cacheTtlMs: 30000,
  },
}

export function resolveProfile(
  profileName,
  overrides = {},
) {
  const base = PROFILES[(profileName ) in PROFILES ? (profileName ) : 'standard']
  const cfg = {
    profile: (profileName ) in PROFILES ? (profileName ) : 'standard',
    ...base,
  }
  if (overrides.mode === 'open') cfg.requireKey = false
  if (overrides.mode === 'keyed') cfg.requireKey = true
  if (overrides.hmac) cfg.requireHmac = true
  if (overrides.rps) cfg.rpsPerKey = overrides.rps
  if (overrides.maxBody) {
    const m = overrides.maxBody.match(/^(\d+)([kmg]?)b?$/i)
    if (m) {
      const mult = _optionalChain([m, 'access', _ => _[2], 'optionalAccess', _2 => _2.toLowerCase, 'call', _3 => _3()]) === 'g' ? 1024 ** 3 : _optionalChain([m, 'access', _4 => _4[2], 'optionalAccess', _5 => _5.toLowerCase, 'call', _6 => _6()]) === 'm' ? 1024 ** 2 : _optionalChain([m, 'access', _7 => _7[2], 'optionalAccess', _8 => _8.toLowerCase, 'call', _9 => _9()]) === 'k' ? 1024 : 1
      cfg.maxBodyBytes = Number(m[1]) * mult
    }
  }
  if (overrides.ips && overrides.ips.length > 0) cfg.allowIps = overrides.ips
  return cfg
}

/** Local API keys — sk_live-…, stored hashed inside MicroRedis. */
export function generateApiKey() {
  const raw = crypto.randomBytes(24).toString('hex')
  const key = `sk_local-${raw}`
  return { key, hash: sha256(key), prefix: key.slice(0, 14) }
}

export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function hmacSignature(secret, method, path, timestamp, bodyHash) {
  return crypto.createHmac('sha256', secret).update(`${method.toUpperCase()}|${path}|${timestamp}|${bodyHash}`).digest('hex')
}








export function authenticateRequest(
  req,
  cfg,
  redis,
  bodyBuffer,
) {
  const ip = normalizeIp(req.socket.remoteAddress)

  // IP pinning — loopback unless explicitly widened.
  if (!cfg.allowIps.some((a) => a === '*' || a === ip)) {
    return { ok: false, status: 403, error: `IP ${ip} is not allowed by this profile` }
  }

  const hdr = (n) => {
    const v = req.headers[n]
    return Array.isArray(v) ? _nullishCoalesce(v[0], () => ( '')) : _nullishCoalesce(v, () => ( ''))
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
    if (!ts || Math.abs(Date.now() - ts) > 60000) {
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

function bodyHashOf(buf) {
  return buf && buf.length > 0 ? crypto.createHash('sha256').update(buf).digest('hex') : 'empty'
}

function safeEqual(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

function normalizeIp(ip) {
  if (!ip) return ''
  return ip.replace(/^::ffff:/, '')
}
