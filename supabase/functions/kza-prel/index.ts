import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cip, x-f2fa, x-prel-token, x-prel-session, x-prel-op, x-prel-long-op, x-kza-session, x-forwarded-for',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface PrelContext {
  userId: string
  sessionId: string
  functionId: string
  operationScope: string[]
  chainDepth: number
  parentTokenHash: string | null
  cipScore: number | null
  f2faWindow: number | null
  issuedAt: number
  expiresAt: number
  isLongOp: boolean
  longOpExpiresAt: number | null
}

interface PrelToken {
  version: number
  userId: string
  sessionId: string
  functionId: string
  operation: string
  chainDepth: number
  parentHash: string | null
  issuedAt: number
  expiresAt: number
  cipHash: string
  f2faWindow: number
  isLongOp: boolean
  longOpExpiresAt: number | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const endpoint = url.pathname.replace('/kza-prel', '').replace(/\/+$/, '') || '/gateway'

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const KZA_PREL_ENABLED = (Deno.env.get('KZA_PREL_ENABLED') ?? 'true').toLowerCase() === 'true'

  if (!KZA_PREL_ENABLED) {
    return jsonResponse({ ok: true, disabled: true })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    switch (endpoint) {
      case '/gateway':
        return await handleGateway(req, supabase)
      case '/validate':
        return await handleValidate(req, supabase)
      case '/refresh':
        return await handleRefresh(req, supabase)
      case '/revoke':
        return await handleRevoke(req, supabase)
      default:
        return jsonResponse({ error: 'Unknown endpoint', code: 'KZA_PREL_UNKNOWN' }, 404)
    }
  } catch (err) {
    console.error('kza-prel error:', err)
    return jsonResponse({ error: 'Internal error', code: 'KZA_PREL_ERROR' }, 500)
  }
})

async function handleGateway(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const cipHeader = req.headers.get('X-CIP') ?? ''
  const f2faHeader = req.headers.get('X-F2FA') ?? ''
  const sessionHeader = req.headers.get('X-PREL-Session') ?? ''
  const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''

  const body = await req.json().catch(() => ({}))
  const requestFunctionId = typeof body.function_id === 'string' ? body.function_id : ''
  const requestOperation = typeof body.operation === 'string' ? body.operation : 'default'

  if (!requestFunctionId) {
    return jsonResponse({ error: 'function_id required', code: 'KZA_PREL_MISSING_FN' }, 400)
  }

  // Lookup function registry entry
  const { data: registry, error: regError } = await supabase
    .from('kza_prel_registry')
    .select('*')
    .eq('function_id', requestFunctionId)
    .single()

  if (regError || !registry || !registry.is_active) {
    return jsonResponse({
      error: 'Function not registered or inactive',
      code: 'KZA_PREL_UNREGISTERED'
    }, 501)
  }

  if (registry.required_auth_level === 'none') {
    return issueToken(supabase, requestFunctionId, requestOperation, {
      userId: 'anonymous',
      sessionId: sessionHeader || crypto.randomUUID(),
      cipScore: null,
      f2faWindow: null,
      isLongOp: false,
      ttlSeconds: registry.ttl_seconds,
      longOpTtlSeconds: registry.long_op_ttl_seconds,
      chainDepth: 0,
      parentTokenHash: null,
    })
  }

  // ========== LAYER 1: IDENTITY ==========
  let userId: string | null = null
  let authMethod = ''

  if (registry.required_auth_level === 'jwt' || registry.required_auth_level === 'hmac_jwt' || registry.required_auth_level === 'any') {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (!authError && user) {
        userId = user.id
        authMethod = 'jwt'
      }
    }
  }

  if (!userId && (registry.required_auth_level === 'api_key' || registry.required_auth_level === 'any')) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (token && token.startsWith('cb_')) {
      const keyPrefix = token.substring(0, 11)
      const { data: candidates } = await supabase
        .from('api_keys')
        .select('id, user_id, is_active, key_hash, key_salt')
        .eq('key_prefix', keyPrefix)
        .eq('is_active', true)

      if (candidates?.length) {
        for (const candidate of candidates) {
          const saltBytes = candidate.key_salt
            ? Uint8Array.from(atob(candidate.key_salt), c => c.charCodeAt(0))
            : new Uint8Array(0)
          const apiKeyBytes = new TextEncoder().encode(token)
          const combined = new Uint8Array(saltBytes.length + apiKeyBytes.length)
          combined.set(saltBytes)
          combined.set(apiKeyBytes, saltBytes.length)
          const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          if (computedHash === candidate.key_hash) {
            userId = candidate.user_id
            authMethod = 'api_key'
            break
          }
        }
      }
    }
  }

  if (!userId && (registry.required_auth_level === 'hmac' || registry.required_auth_level === 'hmac_jwt')) {
    const queryParams = urlSearchParamsFromReq(req)
    if (queryParams?.get('signature')) {
      userId = queryParams.get('userId') || null
      authMethod = 'hmac'
    }
  }

  if (!userId && registry.required_auth_level !== 'any' && registry.required_auth_level !== 'none') {
    return jsonResponse({
      error: 'Authentication required',
      code: authHeader ? 'KZA_PREL_AUTH_FAILED' : 'KZA_PREL_MISSING'
    }, 401)
  }

  if (!userId) {
    userId = 'anonymous'
  }

  // Session binding
  const sessionId = sessionHeader || crypto.randomUUID()

  // ========== LAYER 1b: RATE LIMITING ==========
  if (registry.rate_limit_rps > 0 && userId !== 'anonymous') {
    const { data: rateResult } = await supabase.rpc('kza_check_rate_limit', {
      p_user_id: userId,
      p_function_id: requestFunctionId,
      p_max_rps: registry.rate_limit_rps,
      p_burst_size: registry.rate_limit_burst,
    })

    if (rateResult && rateResult.allowed === false) {
      await supabase.from('kza_threat_events').insert({
        user_id: userId,
        threat_tier: 'YELLOW',
        threat_type: 'RATE_LIMIT',
        description: `Rate limit exceeded for ${requestFunctionId}`,
        endpoint_hit: req.url,
        method: req.method,
        ip_address: ipAddress,
        rate_limit_exceeded: true,
      })
      return jsonResponse({
        error: 'Rate limit exceeded',
        code: 'KZA_PREL_RATE_LIMIT',
        retry_after: rateResult.retry_after,
      }, 429)
    }
  }

  // ========== LAYER 1c: GEO-VELOCITY ==========
  let geoScore: number | null = null
  if (registry.geo_velocity_check && userId !== 'anonymous') {
    const { data: geoResult } = await supabase.rpc('kza_check_geo_velocity', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_latitude: null,
      p_longitude: null,
      p_max_speed_kmh: registry.geo_max_speed_kmh,
    })

    geoScore = geoResult?.score ?? 100

    if (geoResult?.alert === true) {
      await supabase.from('kza_threat_events').insert({
        user_id: userId,
        threat_tier: 'ORANGE',
        threat_type: 'IMPOSSIBLE_TRAVEL',
        description: `Impossible travel detected for ${requestFunctionId}: ${JSON.stringify(geoResult)}`,
        endpoint_hit: req.url,
        method: req.method,
        ip_address: ipAddress,
        geo_score: geoScore,
      })
      return jsonResponse({
        error: 'Suspicious activity detected',
        code: 'KZA_PREL_GEO_VELOCITY',
        geo_score: geoScore,
      }, 403)
    }
  }

  // ========== LAYER 2: CIP ==========
  let cipScore: number | null = null
  if (registry.cip_required && cipHeader) {
    cipScore = await verifyCIP(cipHeader, userId, sessionId, requestFunctionId, supabase)
    if (cipScore === null || cipScore < 40) {
      await supabase.from('kza_threat_events').insert({
        user_id: userId,
        threat_tier: 'RED',
        threat_type: 'CIP_FAILURE',
        description: `CIP check failed for ${requestFunctionId}`,
        endpoint_hit: req.url,
        method: req.method,
        ip_address: ipAddress,
        payload_snapshot: { cip_header: cipHeader },
      })
      return jsonResponse({
        error: 'Client integrity check failed',
        code: 'KZA_PREL_CIP_FAILED',
        score: cipScore,
      }, 403)
    }
  } else if (registry.cip_required && !cipHeader) {
    return jsonResponse({
      error: 'Client integrity proof required',
      code: 'KZA_PREL_CIP_MISSING',
    }, 401)
  }

  // ========== LAYER 3: F2FA ==========
  let f2faWindow: number | null = null
  if (registry.f2fa_required && f2faHeader) {
    const f2faResult = await verifyF2FA(f2faHeader, userId, requestFunctionId, sessionId, supabase)
    if (!f2faResult.valid) {
      if (f2faResult.bruteForce) {
        await banSession(supabase, userId, ipAddress, 'F2FA_BRUTE_FORCE')
        return jsonResponse({
          error: 'Too many F2FA failures',
          code: 'KZA_PREL_F2FA_BRUTE',
        }, 429)
      }
      return jsonResponse({
        error: 'F2FA code invalid',
        code: 'KZA_PREL_F2FA_FAILED',
      }, 403)
    }
    f2faWindow = f2faResult.window
  } else if (registry.f2fa_required && !f2faHeader) {
    return jsonResponse({
      error: 'F2FA code required',
      code: 'KZA_PREL_F2FA_MISSING',
    }, 401)
  }

  // ========== ISSUE TOKEN ==========
  return await issueToken(supabase, requestFunctionId, requestOperation, {
    userId,
    sessionId,
    cipScore,
    f2faWindow,
    geoScore,
    isLongOp: longOpHeader,
    ttlSeconds: longOpHeader ? registry.long_op_ttl_seconds : registry.ttl_seconds,
    longOpTtlSeconds: registry.long_op_ttl_seconds,
    chainDepth: 0,
    parentTokenHash: null,
  })
}

async function handleValidate(req: Request, supabase: any): Promise<Response> {
  const prelToken = req.headers.get('X-PREL-Token') ?? ''
  const targetFunctionId = req.headers.get('X-PREL-Function') ?? ''
  const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'

  if (!prelToken) {
    return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
  }

  // Verify token HMAC
  const { data: payload, error: verifyError } = await supabase.rpc('kza_prel_verify_token', {
    p_token: prelToken,
    p_function_id: targetFunctionId || ''
  })

  if (verifyError || !payload) {
    return jsonResponse({ error: 'Invalid token signature', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  let token: PrelToken
  try {
    token = JSON.parse(payload)
  } catch {
    return jsonResponse({ error: 'Invalid token payload', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  // Check expiry
  const now = Date.now()
  const effectiveExpiry = token.isLongOp && token.longOpExpiresAt
    ? token.longOpExpiresAt
    : token.expiresAt

  if (now > effectiveExpiry) {
    return jsonResponse({ error: 'Token expired', code: 'KZA_PREL_EXPIRED' }, 401)
  }

  // Check token not consumed
  const { data: session } = await supabase
    .from('kza_prel_sessions')
    .select('consumed_at, chain_depth')
    .eq('token_hash', await sha256(prelToken))
    .single()

  if (!session) {
    return jsonResponse({ error: 'Token not found', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  if (session.consumed_at) {
    return jsonResponse({ error: 'Token already consumed', code: 'KZA_PREL_CONSUMED' }, 409)
  }

  // Lookup target function registry
  const { data: registry } = await supabase
    .from('kza_prel_registry')
    .select('*')
    .eq('function_id', targetFunctionId)
    .single()

  if (!registry || !registry.is_active) {
    return jsonResponse({ error: 'Target function not registered', code: 'KZA_PREL_UNREGISTERED' }, 501)
  }

  // Check allowed_callers
  if (registry.allowed_callers?.length > 0) {
    if (!registry.allowed_callers.includes(token.functionId)) {
      return jsonResponse({
        error: `Caller ${token.functionId} not authorized for ${targetFunctionId}`,
        code: 'KZA_PREL_UNAUTHORIZED_CALLER'
      }, 403)
    }
  }

  // Check chain depth
  const newDepth = (token.chainDepth || 0) + 1
  if (newDepth > registry.chain_depth_limit) {
    return jsonResponse({
      error: `Chain depth ${newDepth} exceeds limit ${registry.chain_depth_limit}`,
      code: 'KZA_PREL_CHAIN_DEPTH'
    }, 403)
  }

  // Mark current token as consumed
  await supabase
    .from('kza_prel_sessions')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token_hash', await sha256(prelToken))

  // Issue child token for target function
  return await issueToken(supabase, targetFunctionId, token.operation, {
    userId: token.userId,
    sessionId: token.sessionId,
    cipScore: token.cipHash ? 100 : null,
    f2faWindow: token.f2faWindow,
    isLongOp: longOpHeader,
    ttlSeconds: longOpHeader ? registry.long_op_ttl_seconds : registry.ttl_seconds,
    longOpTtlSeconds: registry.long_op_ttl_seconds,
    chainDepth: newDepth,
    parentTokenHash: await sha256(prelToken),
  })
}

async function handleRefresh(req: Request, supabase: any): Promise<Response> {
  const prelToken = req.headers.get('X-PREL-Token') ?? ''
  const extendSeconds = parseInt(req.headers.get('X-PREL-Extend') ?? '300')

  if (!prelToken) {
    return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
  }

  const tokenHash = await sha256(prelToken)

  const { data: session } = await supabase
    .from('kza_prel_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .single()

  if (!session || session.consumed_at) {
    return jsonResponse({ error: 'Token not found or consumed', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  const newExpiry = new Date(Date.now() + extendSeconds * 1000).toISOString()
  const newLongOpExpiry = new Date(Date.now() + Math.max(extendSeconds, 600) * 1000).toISOString()

  await supabase
    .from('kza_prel_sessions')
    .update({
      expires_at: newExpiry,
      is_long_op: true,
      long_op_expires_at: newLongOpExpiry,
    })
    .eq('token_hash', tokenHash)

  return jsonResponse({
    ok: true,
    expires_at: newExpiry,
    long_op_expires_at: newLongOpExpiry,
  })
}

async function handleRevoke(req: Request, supabase: any): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const userId = body.user_id ?? ''
  const sessionId = body.session_id ?? ''

  if (!userId) {
    return jsonResponse({ error: 'user_id required', code: 'KZA_PREL_MISSING' }, 400)
  }

  const query = supabase.from('kza_prel_sessions').update({ consumed_at: new Date().toISOString() })
  if (sessionId) {
    query.eq('session_id', sessionId)
  }
  query.eq('user_id', userId)
  await query

  // Also revoke F2FA seeds
  const f2faQuery = supabase.from('kza_prel_f2fa_seeds').update({ is_active: false })
  if (sessionId) {
    f2faQuery.eq('session_nonce', sessionId)
  }
  f2faQuery.eq('user_id', userId)
  await f2faQuery

  return jsonResponse({ ok: true, revoked: true })
}

// ========== TOKEN ISSUANCE ==========

async function issueToken(
  supabase: any,
  functionId: string,
  operation: string,
  opts: {
    userId: string
    sessionId: string
    cipScore: number | null
    f2faWindow: number | null
    geoScore: number | null
    isLongOp: boolean
    ttlSeconds: number
    longOpTtlSeconds: number
    chainDepth: number
    parentTokenHash: string | null
  }
): Promise<Response> {
  const now = Date.now()
  const token: PrelToken = {
    version: 1,
    userId: opts.userId,
    sessionId: opts.sessionId,
    functionId,
    operation,
    chainDepth: opts.chainDepth,
    parentHash: opts.parentTokenHash,
    issuedAt: now,
    expiresAt: now + opts.ttlSeconds * 1000,
    cipHash: opts.cipScore ? await sha256(String(opts.cipScore)) : '',
    f2faWindow: opts.f2faWindow ?? 0,
    isLongOp: opts.isLongOp,
    longOpExpiresAt: opts.isLongOp ? now + opts.longOpTtlSeconds * 1000 : null,
  }

  const payload = JSON.stringify(token)

  // Sign via pgsodium
  const { data: signedToken, error: signError } = await supabase.rpc('kza_prel_sign_token', {
    p_function_id: functionId,
    p_payload: payload,
  })

  if (signError || !signedToken) {
    console.error('Token signing error:', signError)
    return jsonResponse({ error: 'Failed to sign token', code: 'KZA_PREL_INTERNAL' }, 500)
  }

  const tokenHash = await sha256(signedToken)

  // Store session
  await supabase.from('kza_prel_sessions').insert({
    token_hash: tokenHash,
    user_id: opts.userId === 'anonymous' ? null : opts.userId,
    session_id: opts.sessionId,
    parent_token_hash: opts.parentTokenHash,
    function_id: functionId,
    operation_scope: [operation],
    issued_at: new Date(token.issuedAt).toISOString(),
    expires_at: new Date(token.expiresAt).toISOString(),
    chain_depth: opts.chainDepth,
    cip_score: opts.cipScore,
    f2fa_window: opts.f2faWindow,
    geo_score: opts.geoScore,
    is_long_op: opts.isLongOp,
    long_op_expires_at: token.longOpExpiresAt
      ? new Date(token.longOpExpiresAt).toISOString()
      : null,
  })

  // Add geo_score to response context
  const responseContext: Record<string, unknown> = {
    user_id: opts.userId,
    session_id: opts.sessionId,
    function_id: functionId,
    operation_scope: [operation],
    chain_depth: opts.chainDepth,
    is_long_op: opts.isLongOp,
    expires_at: new Date(token.expiresAt).toISOString(),
    long_op_expires_at: token.longOpExpiresAt
      ? new Date(token.longOpExpiresAt).toISOString()
      : null,
  }
  if (opts.geoScore !== null) responseContext.geo_score = opts.geoScore

  return jsonResponse({
    ok: true,
    prel_token: signedToken,
    context: responseContext,
  })
}

// ========== CIP VERIFICATION ==========

async function verifyCIP(
  cipHeader: string,
  userId: string,
  sessionId: string,
  functionId: string,
  supabase: any
): Promise<number | null> {
  try {
    const parts = cipHeader.split('.')
    if (parts.length < 3) return null

    const buildVersion = parts[0]
    const entropyHash = parts[1]
    const timingDelta = parseInt(parts[2])

    // Validate timing window (50-500ms for browser, rejects curl/scripts)
    if (timingDelta < 50 || timingDelta > 5000) return 0

    // Verify CIP version from registry
    const { data: cipConfig } = await supabase.rpc('kza_validate_cip_version', {
      p_version: buildVersion,
    })

    if (!cipConfig?.valid) return 10

    const timingMinMs = cipConfig.timing_min_ms ?? 80
    const timingMaxMs = cipConfig.timing_max_ms ?? 500
    const entropyRequired = cipConfig.entropy_required ?? 64

    // Score based on entropy hash quality against current requirements
    const entropyScore = entropyHash.length >= entropyRequired ? 100
      : entropyHash.length >= 32 ? 60
      : 20

    // Timing bonus against current config
    const timingScore = timingDelta >= timingMinMs && timingDelta <= timingMaxMs ? 100
      : timingDelta > 500 && timingDelta <= 2000 ? 60
      : 20

    const finalScore = Math.min(100, Math.round((entropyScore + timingScore) / 2))

    // Log CIP usage for audit
    await supabase.from('kza_threat_events').insert({
      user_id: userId,
      threat_tier: 'GREEN',
      threat_type: 'CIP_CHECK',
      description: `CIP v${buildVersion} score ${finalScore} for ${functionId}`,
      endpoint_hit: `/kza-prel/gateway`,
      method: 'POST',
      cip_version: buildVersion,
    }).catch(() => {})

    return finalScore
  } catch {
    return null
  }
}

// ========== F2FA VERIFICATION ==========

async function verifyF2FA(
  f2faCode: string,
  userId: string,
  functionId: string,
  sessionId: string,
  supabase: any
): Promise<{ valid: boolean; window: number | null; bruteForce: boolean }> {
  try {
    // Count recent failures
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count: failCount } = await supabase
      .from('kza_threat_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('threat_type', 'F2FA_FAILURE')
      .gte('created_at', since)

    if (failCount && failCount >= 3) {
      return { valid: false, window: null, bruteForce: true }
    }

    // Get active seed for this user+function
    const { data: seed } = await supabase
      .from('kza_prel_f2fa_seeds')
      .select('seed_derived')
      .eq('user_id', userId)
      .eq('function_id', functionId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!seed) {
      return { valid: false, window: null, bruteForce: false }
    }

    // Check current and ±1 window
    const currentWindow = Math.floor(Date.now() / 30000)
    for (const offset of [0, -1, 1]) {
      const window = currentWindow + offset
      const expected = await computeF2FACode(seed.seed_derived, functionId, window)
      if (expected === f2faCode) {
        return { valid: true, window, bruteForce: false }
      }
    }

    // Log failure
    await supabase.from('kza_threat_events').insert({
      user_id: userId,
      threat_tier: 'YELLOW',
      threat_type: 'F2FA_FAILURE',
      description: 'F2FA code mismatch',
      payload_snapshot: { function_id: functionId, session_id: sessionId },
      endpoint_hit: '/kza-prel/gateway',
      method: 'POST',
    })

    return { valid: false, window: null, bruteForce: false }
  } catch {
    return { valid: false, window: null, bruteForce: false }
  }
}

async function computeF2FACode(seed: string, functionId: string, window: number): Promise<string> {
  const encoder = new TextEncoder()
  const windowBytes = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    windowBytes[i] = (window >> (i * 8)) & 0xff
  }

  const input = encoder.encode(seed + functionId)
  const combined = new Uint8Array(input.length + 8)
  combined.set(input)
  combined.set(windowBytes, input.length)

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
  const hashArray = new Uint8Array(hashBuffer)

  // Proprietary reduction: XOR first 24 bytes into 8 bytes
  let code = 0
  for (let i = 0; i < 3; i++) {
    const block = new DataView(hashArray.slice(i * 8, i * 8 + 8).buffer)
    code ^= block.getUint32(0, true)
    code ^= block.getUint32(4, true)
  }

  return String(code % 100000000).padStart(8, '0')
}

async function banSession(supabase: any, userId: string, ipAddress: string, reason: string) {
  await supabase.from('kza_banned_entities').insert({
    user_id: userId,
    ip_address: ipAddress,
    ban_type: 'TEMP',
    ban_reason: `KZA-PREL auto-ban: ${reason}`,
    ban_tier: 'BLACK',
    banned_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  })

  await supabase.from('kza_threat_events').insert({
    user_id: userId,
    ip_address: ipAddress,
    threat_tier: 'BLACK',
    threat_type: reason,
    description: `KZA-PREL auto-ban for ${reason}`,
    endpoint_hit: '/kza-prel/gateway',
    method: 'POST',
    automated_action_taken: 'KZA_BLACK_BAN',
  })

  try {
    await supabase.auth.admin.signOut(userId)
  } catch {}
}

// ========== UTILITIES ==========

function jsonResponse(payload: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

async function sha256(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function urlSearchParamsFromReq(req: Request): URLSearchParams | null {
  try {
    return new URL(req.url).searchParams
  } catch {
    return null
  }
}
