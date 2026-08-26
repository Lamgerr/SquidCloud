import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cip, x-f2fa, x-prel-token, x-prel-session, x-prel-op, x-prel-long-op, x-kza-session, x-kza-geo, x-kza-sc-ts, x-kza-sc-sig, x-kza-sc-client, x-forwarded-for',
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
  kid: string
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
  binding: string
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
      case '/veil/export':
        return await handleVeilExport(req, supabase)
      case '/veil/delete':
        return await handleVeilDelete(req, supabase)
      default:
        return jsonResponse({ error: 'Unknown endpoint', code: 'KZA_PREL_UNKNOWN' }, 404)
    }
  } catch (err) {
    console.error('kza-prel error:', err)
    return jsonResponse({ error: 'Internal error', code: 'KZA_PREL_ERROR' }, 500)
  }
})

// ========== GATEWAY ==========

async function handleGateway(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const cipHeader = req.headers.get('X-CIP') ?? ''
  const f2faHeader = req.headers.get('X-F2FA') ?? ''
  const sessionHeader = req.headers.get('X-PREL-Session') ?? ''
  const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''
  const geoHeader = req.headers.get('x-kza-geo') ?? ''

  const body = await req.json().catch(() => ({}))
  const requestFunctionId = typeof body.function_id === 'string' ? body.function_id : ''
  const requestOperation = typeof body.operation === 'string' ? body.operation : 'default'

  if (!requestFunctionId) {
    return jsonResponse({ error: 'function_id required', code: 'KZA_PREL_MISSING_FN' }, 400)
  }

  // ========== OPERATION SCOPING ==========
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

  const allowedOps = registry.allowed_operations ?? []
  if (allowedOps.length > 0 && !allowedOps.includes(requestOperation)) {
    return jsonResponse({
      error: `Operation '${requestOperation}' not allowed for ${requestFunctionId}`,
      code: 'KZA_PREL_OPERATION_DENIED',
    }, 403)
  }

  if (registry.required_auth_level === 'none') {
    return issueToken(supabase, requestFunctionId, requestOperation, {
      userId: 'anonymous',
      sessionId: sessionHeader || crypto.randomUUID(),
      cipScore: null,
      f2faWindow: null,
      geoScore: null,
      isLongOp: false,
      ttlSeconds: registry.ttl_seconds,
      longOpTtlSeconds: registry.long_op_ttl_seconds,
      chainDepth: 0,
      parentTokenHash: null,
      binding: await computeBinding(ipAddress, userAgent),
    })
  }

  // ========== LAYER 1: IDENTITY ==========
  let userId: string | null = null
  let authMethod = ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (registry.required_auth_level === 'jwt' || registry.required_auth_level === 'hmac_jwt' || registry.required_auth_level === 'any') {
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (!authError && user) {
        userId = user.id
        authMethod = 'jwt'
      }
    }
  }

  if (!userId && (registry.required_auth_level === 'api_key' || registry.required_auth_level === 'any')) {
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

  // Opaque SquidCloud CLI device token (no dots, no cb_ prefix): resolved via
  // cli_devices.token_hash so squidcloudctl privileged commands can obtain
  // PREL tokens through the same gateway as browser sessions.
  if (!userId && token && !token.includes('.') && !token.startsWith('cb_')) {
    const cliTokenHash = await sha256(token)
    const { data: cliDevice } = await supabase
      .from('cli_devices')
      .select('id, user_id, machine_id, is_banned')
      .eq('token_hash', cliTokenHash)
      .maybeSingle()
    if (cliDevice?.user_id) {
      // Banned instruments cannot mint leases — otherwise a stolen seed from
      // a banned device would keep renewing privileged access forever.
      const banOr: string[] = [`and(entity_type.eq.DEVICE,entity_value.eq.${cliDevice.id})`]
      if (cliDevice.machine_id) banOr.push(`and(entity_type.eq.MACHINE,entity_value.eq.${cliDevice.machine_id})`)
      const { count: devBanCount } = await supabase
        .from('kza_banned_entities')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(banOr.join(','))
      if ((devBanCount ?? 0) > 0 || cliDevice.is_banned) {
        return jsonResponse({
          error: 'This device has been permanently banned after repeated TOTP failures.',
          code: 'KZA_DEVICE_BANNED',
        }, 403)
      }
      userId = cliDevice.user_id
      authMethod = 'cli_device'
    }
  }

  // Real HMAC: verified server-side with the function's per-function key
  if (!userId && (registry.required_auth_level === 'hmac' || registry.required_auth_level === 'hmac_gateway' || registry.required_auth_level === 'hmac_jwt')) {
    if (registry.required_auth_level === 'hmac_gateway') {
      const hmacUserId = await verifyHmacSignature(req, supabase, requestFunctionId)
      if (hmacUserId) {
        userId = hmacUserId
        authMethod = 'hmac'
      }
    } else if (registry.required_auth_level === 'hmac') {
      // Self-verified hmac: function performs its own signature check.
      // Gateway issues a bound placeholder so userId can never be spoofed.
      if (token) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!authError && user) {
          userId = user.id
          authMethod = 'jwt'
        }
      }
      if (!userId) {
        userId = 'hmac'
        authMethod = 'hmac'
      }
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

  // Session binding (server-chosen when absent)
  const sessionId = sessionHeader || crypto.randomUUID()
  const binding = await computeBinding(ipAddress, userAgent)

  // ========== LAYER 1b: RATE LIMITING (user + IP) ==========
  if (registry.rate_limit_rps > 0 && userId !== 'anonymous') {
    const { data: rateResult } = await supabase.rpc('kza_check_rate_limit', {
      p_user_id: userId,
      p_function_id: requestFunctionId,
      p_max_rps: registry.rate_limit_rps,
      p_burst_size: registry.rate_limit_burst,
    })

    if (rateResult && rateResult.allowed === false) {
      await logThreat(supabase, userId, ipAddress, req, 'YELLOW', 'RATE_LIMIT',
        `Rate limit exceeded for ${requestFunctionId}`, { rate_limit_exceeded: true })
      return jsonResponse({
        error: 'Rate limit exceeded',
        code: 'KZA_PREL_RATE_LIMIT',
        retry_after: rateResult.retry_after,
      }, 429)
    }
  }

  if (userId === 'anonymous' || authMethod === 'api_key' || authMethod === 'hmac') {
    const ipHash = await veilIpHash(supabase, ipAddress)
    if (ipHash) {
      const { data: ipRate } = await supabase.rpc('kza_check_ip_rate_limit', {
        p_ip_hash: ipHash,
        p_function_id: requestFunctionId,
        p_max_rps: registry.rate_limit_rps,
        p_burst_size: registry.rate_limit_burst,
      })
      if (ipRate && ipRate.allowed === false) {
        return jsonResponse({
          error: 'Rate limit exceeded',
          code: 'KZA_PREL_IP_RATE_LIMIT',
          retry_after: ipRate.retry_after,
        }, 429)
      }
    }
  }

  // ========== LAYER 1c: GEO-VELOCITY + GEO-FENCE ==========
  let geoScore: number | null = null
  if ((registry.geo_velocity_check || registry.geo_fence_check) && userId !== 'anonymous') {
    const [lat, lng, acc] = parseGeoHeader(geoHeader)

    const geoResult = await supabase.rpc('kza_check_geo_velocity', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_latitude: lat,
      p_longitude: lng,
      p_max_speed_kmh: registry.geo_max_speed_kmh,
    }).then(r => r.data).catch(() => null)

    geoScore = geoResult?.score ?? 100

    if (geoResult?.alert === true) {
      await logThreat(supabase, userId, ipAddress, req, 'ORANGE', 'IMPOSSIBLE_TRAVEL',
        `Impossible travel detected for ${requestFunctionId}: ${JSON.stringify(geoResult)}`,
        { geo_score: geoScore })
      return jsonResponse({
        error: 'Suspicious activity detected',
        code: 'KZA_PREL_GEO_VELOCITY',
        geo_score: geoScore,
      }, 403)
    }

    if (registry.geo_fence_check) {
      const country = req.headers.get('cf-ipcountry') ?? req.headers.get('x-country') ?? 'UNKNOWN'
      const fence = await supabase.rpc('kza_check_geo_fence', { p_country: country })
        .then(r => r.data).catch(() => null)
      if (fence && fence.allowed === false) {
        await logThreat(supabase, userId, ipAddress, req, 'RED', 'GEO_FENCE',
          `Geo-fence blocked ${country}: ${fence.reason ?? ''}`, { country })
        return jsonResponse({
          error: 'Access denied',
          code: 'KZA_PREL_GEO_FENCE',
        }, fence.shadow ? 404 : 403)
      }
    }
  }

  // ========== LAYER 2: CIP (with proof-of-work) ==========
  let cipScore: number | null = null
  if (registry.cip_required) {
    if (!cipHeader) {
      return jsonResponse({
        error: 'Client integrity proof required',
        code: 'KZA_PREL_CIP_MISSING',
      }, 401)
    }
    cipScore = await verifyCIP(cipHeader, userId, sessionId, requestFunctionId, supabase, ipAddress, userAgent)
    if (cipScore === null || cipScore < 40) {
      if (cipScore === 1) {
        // PoW required — hand out the challenge (stateless, windowed)
        const challenge = await powChallenge(supabase, userId, requestFunctionId)
        return jsonResponse({
          error: 'Proof-of-work required',
          code: 'KZA_PREL_CIP_POW',
          challenge,
          pow_bits: await powBits(supabase),
        }, 401)
      }
      await logThreat(supabase, userId, ipAddress, req, 'RED', 'CIP_FAILURE',
        `CIP check failed for ${requestFunctionId}`, { cip_header: cipHeader })
      return jsonResponse({
        error: 'Client integrity check failed',
        code: 'KZA_PREL_CIP_FAILED',
        score: cipScore,
      }, 403)
    }
  }

  // ========== LAYER 3: F2FA (server-issued seed only) ==========
  let f2faWindow: number | null = null
  if (registry.f2fa_required) {
    if (!f2faHeader) {
      return jsonResponse({
        error: 'F2FA code required',
        code: 'KZA_PREL_F2FA_MISSING',
      }, 401)
    }
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
    binding,
  })
}

// ========== VALIDATE ==========

async function handleValidate(req: Request, supabase: any): Promise<Response> {
  const prelToken = req.headers.get('X-PREL-Token') ?? ''
  const targetFunctionId = req.headers.get('X-PREL-Function') ?? ''
  const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRole = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const isInternal = serviceRole === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') && serviceRole !== ''

  if (!prelToken) {
    return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
  }

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

  const now = Date.now()
  const effectiveExpiry = token.isLongOp && token.longOpExpiresAt
    ? token.longOpExpiresAt
    : token.expiresAt

  if (now > effectiveExpiry) {
    return jsonResponse({ error: 'Token expired', code: 'KZA_PREL_EXPIRED' }, 401)
  }

  // Binding: token is bound to the network fingerprint it was issued to.
  // Internal (service-role) chain calls are exempt.
  if (!isInternal && token.binding) {
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''
    const incomingBinding = await computeBinding(ipAddress, userAgent)
    if (incomingBinding !== token.binding) {
      return jsonResponse({ error: 'Token binding mismatch', code: 'KZA_PREL_BINDING' }, 403)
    }
  }

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

  const { data: registry } = await supabase
    .from('kza_prel_registry')
    .select('*')
    .eq('function_id', targetFunctionId)
    .single()

  if (!registry || !registry.is_active) {
    return jsonResponse({ error: 'Target function not registered', code: 'KZA_PREL_UNREGISTERED' }, 501)
  }

  if (registry.allowed_callers?.length > 0) {
    if (!registry.allowed_callers.includes(token.functionId)) {
      return jsonResponse({
        error: `Caller ${token.functionId} not authorized for ${targetFunctionId}`,
        code: 'KZA_PREL_UNAUTHORIZED_CALLER'
      }, 403)
    }
  }

  const newDepth = (token.chainDepth || 0) + 1
  if (newDepth > registry.chain_depth_limit) {
    return jsonResponse({
      error: `Chain depth ${newDepth} exceeds limit ${registry.chain_depth_limit}`,
      code: 'KZA_PREL_CHAIN_DEPTH'
    }, 403)
  }

  await supabase
    .from('kza_prel_sessions')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token_hash', await sha256(prelToken))

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
    binding: token.binding,
  })
}

// ========== REFRESH (verified + capped) ==========

async function handleRefresh(req: Request, supabase: any): Promise<Response> {
  const prelToken = req.headers.get('X-PREL-Token') ?? ''
  const extendSeconds = Math.min(parseInt(req.headers.get('X-PREL-Extend') ?? '300') || 300, 600)

  if (!prelToken) {
    return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
  }

  // Signature must verify before any extension
  const { data: payload } = await supabase.rpc('kza_prel_verify_token', {
    p_token: prelToken,
    p_function_id: ''
  })
  if (!payload) {
    return jsonResponse({ error: 'Invalid token signature', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  let token: PrelToken
  try {
    token = JSON.parse(payload)
  } catch {
    return jsonResponse({ error: 'Invalid token payload', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  if (token.expiresAt < Date.now() && !(token.isLongOp && token.longOpExpiresAt > Date.now())) {
    return jsonResponse({ error: 'Token expired', code: 'KZA_PREL_EXPIRED' }, 401)
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

// ========== REVOKE (owner or service role only) ==========

async function handleRevoke(req: Request, supabase: any): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const userId = body.user_id ?? ''
  const sessionId = body.session_id ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''

  if (!userId) {
    return jsonResponse({ error: 'user_id required', code: 'KZA_PREL_MISSING' }, 400)
  }

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isService = authHeader === `Bearer ${serviceRole}`

  if (!isService) {
    const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    const { data: { user }, error } = await supabase.auth.getUser(jwtToken)
    if (error || !user || user.id !== userId) {
      return jsonResponse({ error: 'Not authorized to revoke this user', code: 'KZA_PREL_REVOKE_FORBIDDEN' }, 403)
    }
  }

  const query = supabase.from('kza_prel_sessions').update({ consumed_at: new Date().toISOString() })
  if (sessionId) {
    query.eq('session_id', sessionId)
  }
  query.eq('user_id', userId)
  await query

  const f2faQuery = supabase.from('kza_prel_f2fa_seeds').update({ is_active: false })
  if (sessionId) {
    f2faQuery.eq('session_nonce', sessionId)
  }
  f2faQuery.eq('user_id', userId)
  await f2faQuery

  return jsonResponse({ ok: true, revoked: true })
}

// ========== VEIL (user privacy endpoints) ==========

async function handleVeilExport(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const { data: { user }, error } = await supabase.auth.getUser(jwtToken)
  if (error || !user) {
    return jsonResponse({ error: 'Authentication required', code: 'KZA_PREL_MISSING' }, 401)
  }
  const { data, error: rpcError } = await supabase.rpc('kza_veil_export_profile', { p_user_id: user.id })
  if (rpcError) {
    return jsonResponse({ error: 'Export failed', code: 'KZA_PREL_INTERNAL' }, 500)
  }
  return jsonResponse({ ok: true, data })
}

async function handleVeilDelete(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const { data: { user }, error } = await supabase.auth.getUser(jwtToken)
  if (error || !user) {
    return jsonResponse({ error: 'Authentication required', code: 'KZA_PREL_MISSING' }, 401)
  }
  const { data, error: rpcError } = await supabase.rpc('kza_veil_delete_profile', { p_user_id: user.id })
  if (rpcError) {
    return jsonResponse({ error: 'Delete failed', code: 'KZA_PREL_INTERNAL' }, 500)
  }
  return jsonResponse({ ok: true, deleted: true })
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
    binding: string
  }
): Promise<Response> {
  const now = Date.now()
  const token: PrelToken = {
    version: 2,
    kid: 'kza_prel_hmac_v2',
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
    binding: opts.binding,
  }

  const payload = JSON.stringify(token)

  const { data: signedToken, error: signError } = await supabase.rpc('kza_prel_sign_token', {
    p_function_id: functionId,
    p_payload: payload,
  })

  if (signError || !signedToken) {
    console.error('Token signing error:', signError)
    return jsonResponse({ error: 'Failed to sign token', code: 'KZA_PREL_INTERNAL' }, 500)
  }

  const tokenHash = await sha256(signedToken)

  await supabase.from('kza_prel_sessions').insert({
    token_hash: tokenHash,
    user_id: opts.userId === 'anonymous' || opts.userId === 'hmac' ? null : opts.userId,
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
    binding_hash: opts.binding || null,
  })

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

// ========== REAL HMAC (gateway-verified) ==========

async function verifyHmacSignature(req: Request, supabase: any, functionId: string): Promise<string | null> {
  const qp = new URL(req.url).searchParams
  const sig = qp.get('gsig')
  const ts = qp.get('gts')
  const userId = qp.get('guser')
  const path = qp.get('gpath')

  if (!sig || !ts || !userId || !path) return null
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return null

  const { data: verified } = await supabase.rpc('kza_prel_hmac_verify', {
    p_function_id: functionId,
    p_ts: ts,
    p_method: req.method,
    p_path: path,
    p_user_id: userId,
    p_signature: sig,
  })

  return verified === true ? userId : null
}

// ========== CIP VERIFICATION (with proof-of-work) ==========

async function powChallenge(supabase: any, userId: string, functionId: string): Promise<string> {
  const secret = Deno.env.get('KZA_CIP_CHALLENGE_KEY') ?? ''
  if (!secret) return ''
  const window = Math.floor(Date.now() / (15 * 60 * 1000))
  return sha256(`${secret}:${userId}:${functionId}:${window}`)
}

async function powBits(supabase: any): Promise<number> {
  const { data } = await supabase.rpc('kza_validate_cip_version', { p_version: '1.0.0' }).catch(() => ({ data: null }))
  return data?.pow_bits ?? 0
}

function powSolved(challenge: string, entropyHash: string, solution: string, bits: number): boolean {
  if (!challenge || bits <= 0) return false
  const target = Math.ceil(bits / 4)
  if (!solution || solution.length === 0 || solution.length > 64) return false
  // verify solution actually solves the hash prefix
  return sha256(`${challenge}:${entropyHash}:${solution}`).then((h) => h.startsWith('0'.repeat(target)))
}

async function verifyCIP(
  cipHeader: string,
  userId: string,
  sessionId: string,
  functionId: string,
  supabase: any,
  ipAddress: string,
  userAgent: string
): Promise<number | null> {
  try {
    const parts = cipHeader.split('.')
    if (parts.length < 3) return null

    const buildVersion = parts[0]
    const entropyHash = parts[1]
    const timingDelta = parseInt(parts[2])
    const powSolution = parts[3] ?? ''

    if (timingDelta < 50 || timingDelta > 5000) return 0

    const { data: cipConfig } = await supabase.rpc('kza_validate_cip_version', {
      p_version: buildVersion,
    })

    if (!cipConfig?.valid) return 10

    const timingMinMs = cipConfig.timing_min_ms ?? 80
    const timingMaxMs = cipConfig.timing_max_ms ?? 500
    const entropyRequired = cipConfig.entropy_required ?? 64
    const powRequired = Boolean(cipConfig.pow_required)

    // Proof-of-work gate: challenge is windowed-HMAC(secret), verified server-side
    if (powRequired) {
      const challenge = await powChallenge(supabase, userId, functionId)
      if (challenge && !(await powSolved(challenge, entropyHash, powSolution, cipConfig.pow_bits ?? 0))) {
        return 1 // signal: PoW required
      }
    }

    const entropyScore = entropyHash.length >= entropyRequired ? 100
      : entropyHash.length >= 32 ? 60
      : 20

    const timingScore = timingDelta >= timingMinMs && timingDelta <= timingMaxMs ? 100
      : timingDelta > 500 && timingDelta <= 2000 ? 60
      : 20

    const finalScore = Math.min(100, Math.round((entropyScore + timingScore) / 2))

    await supabase.from('kza_threat_events').insert({
      user_id: userId === 'anonymous' || userId === 'hmac' ? null : userId,
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

// ========== F2FA VERIFICATION (server seed only) ==========

async function verifyF2FA(
  f2faCode: string,
  userId: string,
  functionId: string,
  sessionId: string,
  supabase: any
): Promise<{ valid: boolean; window: number | null; bruteForce: boolean }> {
  try {
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

    const currentWindow = Math.floor(Date.now() / 30000)
    for (const offset of [0, -1, 1]) {
      const window = currentWindow + offset
      const expected = await computeF2FACode(seed.seed_derived, functionId, window)
      if (expected === f2faCode) {
        return { valid: true, window, bruteForce: false }
      }
    }

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
  // True uint64 little-endian window. NB: `window >> (i*8)` would wrap at
  // int32 and repeat the low 4 bytes — the wire format was broken until this
  // fix, so both encoder and clients must use explicit unsigned division.
  const windowBytes = new Uint8Array(8)
  let w = Math.floor(window)
  for (let i = 0; i < 8; i++) {
    windowBytes[i] = w % 256
    w = Math.floor(w / 256)
  }

  const input = encoder.encode(seed + functionId)
  const combined = new Uint8Array(input.length + 8)
  combined.set(input)
  combined.set(windowBytes, input.length)

  const hashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', combined))
  const view = new DataView(hashBytes.buffer)

  let code = 0
  for (let i = 0; i < 3; i++) {
    code ^= view.getUint32(i * 8, true)
    code ^= view.getUint32((i * 8) + 4, true)
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

async function computeBinding(ipAddress: string, userAgent: string): Promise<string> {
  return sha256(`${ipAddress}|${userAgent}`)
}

async function veilIpHash(supabase: any, ipAddress: string): Promise<string | null> {
  if (!ipAddress || ipAddress === 'unknown') return null
  const { data } = await supabase.rpc('kza_veil_ip_hash', { p_ip: ipAddress }).catch(() => ({ data: null }))
  return data ?? null
}

async function logThreat(
  supabase: any,
  userId: string,
  ipAddress: string,
  req: Request,
  tier: string,
  type: string,
  description: string,
  extra: Record<string, unknown> = {}
) {
  const ipHash = await veilIpHash(supabase, ipAddress)
  await supabase.from('kza_threat_events').insert({
    user_id: userId === 'anonymous' || userId === 'hmac' ? null : userId,
    ip_hash: ipHash,
    threat_tier: tier,
    threat_type: type,
    description,
    endpoint_hit: req.url,
    method: req.method,
    ip_address: ipAddress,
    payload_snapshot: extra,
  }).catch(() => {})
}

function parseGeoHeader(value: string): [number | null, number | null, number | null] {
  try {
    const [lat, lng, acc] = value.split(',')
    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    if (isNaN(latN) || isNaN(lngN)) return [null, null, null]
    return [latN, lngN, parseFloat(acc) || null]
  } catch {
    return [null, null, null]
  }
}

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
