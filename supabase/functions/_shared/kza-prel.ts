import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

export interface PrelContext {
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

export interface PrelOptions {
  functionId: string
  operation: string
  longOpSeconds?: number
  ttlSeconds?: number
}

// CORS is restricted to the SquidCloud app origin. A wildcard here lets any
// website that obtains a token read responses from our functions. Native/CLI
// clients are unaffected by CORS (they are not browsers).
const APP_ORIGIN = Deno.env.get('APP_ORIGIN')?.trim() ||
  'https://squidcloud.vercel.app';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cip, x-f2fa, x-prel-token, x-prel-session, x-prel-op, x-prel-long-op, x-kza-session, x-upload-chunkindex, x-upload-chunksize, x-upload-chunkcount, x-upload-totalchunks, x-upload-filename, x-upload-filetype, x-upload-totalsize, x-upload-userid, x-upload-path, x-upload-repo, x-upload-nodeid',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  })
}

async function lookupRegistry(supabase: any, functionId: string): Promise<{
  authLevel: string; requiredMinRole: string | null; f2faRequired: boolean; cipRequired: boolean
} | null> {
  const { data } = await supabase
    .from('kza_prel_registry')
    .select('required_auth_level, required_min_role, f2fa_required, cip_required')
    .eq('function_id', functionId)
    .single()
  if (!data) return null
  return {
    authLevel: data.required_auth_level,
    requiredMinRole: data.required_min_role,
    f2faRequired: data.f2fa_required,
    cipRequired: data.cip_required,
  }
}

function anonymousCtx(functionId: string, operation: string): PrelContext {
  return {
    userId: 'anonymous',
    sessionId: '',
    functionId,
    operationScope: [operation],
    chainDepth: 0,
    parentTokenHash: null,
    cipScore: null,
    f2faWindow: null,
    issuedAt: Date.now(),
    expiresAt: 0,
    isLongOp: false,
    longOpExpiresAt: null,
  }
}

export async function withPrelGateway(
  req: Request,
  options: PrelOptions,
  handler: (ctx: PrelContext) => Promise<Response>
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return corsResponse()
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const KZA_PREL_ENABLED = (Deno.env.get('KZA_PREL_ENABLED') ?? 'true').toLowerCase() === 'true'

  if (!KZA_PREL_ENABLED) {
    return handler(anonymousCtx(options.functionId, options.operation))
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const registry = await lookupRegistry(supabase, options.functionId)
  const authLevel = registry?.authLevel || 'prel_only'

  // auth_level = 'none' or 'any': allow anonymous
  if (authLevel === 'none' || authLevel === 'any') {
    return handler(anonymousCtx(options.functionId, options.operation))
  }

  const prelToken = req.headers.get('X-PREL-Token') ?? ''

  // PREL token present: validate via kza-prel/validate
  if (prelToken) {
    const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'

    const validateUrl = `${SUPABASE_URL}/functions/v1/kza-prel/validate`
    const validateRes = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'X-PREL-Token': prelToken,
        'X-PREL-Function': options.functionId,
        'X-PREL-Long-Op': String(longOpHeader),
      },
      body: JSON.stringify({}),
    })

    if (!validateRes.ok) {
      let err: Record<string, unknown> = {}
      try { err = await validateRes.json() } catch { /* ignore */ }
      return jsonResponse({
        error: err.error || 'PREL validation failed',
        code: err.code || 'KZA_PREL_INVALID',
      }, validateRes.status)
    }

    const data = await validateRes.json()

    const ctx: PrelContext = {
      userId: data.context?.user_id || 'anonymous',
      sessionId: data.context?.session_id || '',
      functionId: options.functionId,
      operationScope: data.context?.operation_scope || [options.operation],
      chainDepth: data.context?.chain_depth || 0,
      parentTokenHash: null,
      cipScore: null,
      f2faWindow: data.context?.f2fa_window || null,
      issuedAt: data.context?.issued_at ? new Date(data.context.issued_at).getTime() : Date.now(),
      expiresAt: data.context?.expires_at ? new Date(data.context.expires_at).getTime() : Date.now(),
      isLongOp: data.context?.is_long_op || false,
      longOpExpiresAt: data.context?.long_op_expires_at
        ? new Date(data.context.long_op_expires_at).getTime()
        : null,
    }

    const response = await handler(ctx)

    const newToken = response.headers.get('X-PREL-Token')
    if (newToken) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'X-PREL-Token': newToken,
          'X-PREL-Context': JSON.stringify(ctx),
        },
      })
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-PREL-Context': JSON.stringify(ctx),
      },
    })
  }

  // No PREL token — try Supabase JWT auth for 'jwt' / 'hmac_jwt' levels
  if (authLevel === 'jwt' || authLevel === 'hmac_jwt') {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (jwtToken) {
      const serviceRole = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
      if (serviceRole && jwtToken === serviceRole) {
        // Internal function-to-function call: service-role bearer passes through
        return handler(anonymousCtx(options.functionId, options.operation))
      }

      const { data: { user }, error } = await supabase.auth.getUser(jwtToken)

      if (!error && user) {
        return handler({
          userId: user.id,
          sessionId: '',
          functionId: options.functionId,
          operationScope: [options.operation],
          chainDepth: 0,
          parentTokenHash: null,
          cipScore: null,
          f2faWindow: null,
          issuedAt: Date.now(),
          expiresAt: 0,
          isLongOp: false,
          longOpExpiresAt: null,
        })
      }
    }
  }

  return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
}

export async function withPrelDirect(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  options: PrelOptions,
  handler: (ctx: PrelContext, supabase: ReturnType<typeof createClient>) => Promise<Response>
): Promise<Response> {
  const prelToken = req.headers.get('X-PREL-Token') ?? ''

  // No PREL token — try JWT
  if (!prelToken) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (jwtToken) {
      const { data: { user }, error } = await supabase.auth.getUser(jwtToken)
      if (!error && user) {
        return handler({
          userId: user.id,
          sessionId: '',
          functionId: options.functionId,
          operationScope: [options.operation],
          chainDepth: 0,
          parentTokenHash: null,
          cipScore: null,
          f2faWindow: null,
          issuedAt: Date.now(),
          expiresAt: 0,
          isLongOp: false,
          longOpExpiresAt: null,
        }, supabase)
      }
    }

    return jsonResponse({ error: 'PREL token required', code: 'KZA_PREL_MISSING' }, 401)
  }

  const longOpHeader = req.headers.get('X-PREL-Long-Op') === 'true'

  const { data: payload, error } = await supabase.rpc('kza_prel_verify_token', {
    p_token: prelToken,
    p_function_id: options.functionId,
  })

  if (error || !payload) {
    return jsonResponse({
      error: 'Invalid PREL token',
      code: error?.message?.includes('expired') ? 'KZA_PREL_EXPIRED' : 'KZA_PREL_INVALID_SIG',
    }, 403)
  }

  let parsed: PrelToken
  try {
    parsed = JSON.parse(payload)
  } catch {
    return jsonResponse({ error: 'Invalid token payload', code: 'KZA_PREL_INVALID_SIG' }, 403)
  }

  const now = Date.now()
  const effectiveExpiry = parsed.isLongOp && parsed.longOpExpiresAt
    ? parsed.longOpExpiresAt
    : parsed.expiresAt

  if (now > effectiveExpiry) {
    return jsonResponse({ error: 'Token expired', code: 'KZA_PREL_EXPIRED' }, 401)
  }

  // Check allowed_callers
  const { data: registry } = await supabase
    .from('kza_prel_registry')
    .select('allowed_callers, chain_depth_limit')
    .eq('function_id', options.functionId)
    .single()

  if (registry?.allowed_callers?.length > 0) {
    if (!registry.allowed_callers.includes(parsed.functionId)) {
      return jsonResponse({
        error: `Caller ${parsed.functionId} not authorized`,
        code: 'KZA_PREL_UNAUTHORIZED_CALLER',
      }, 403)
    }
  }

  // Binding: token is bound to the network fingerprint it was issued to.
  // Service-role callers (function-to-function) are exempt.
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRole = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const isInternal = serviceRole === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') && serviceRole !== ''
  if (!isInternal && parsed.binding) {
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''
    const incomingBinding = await sha256(`${ipAddress}|${userAgent}`)
    if (incomingBinding !== parsed.binding) {
      return jsonResponse({ error: 'Token binding mismatch', code: 'KZA_PREL_BINDING' }, 403)
    }
  }

  const ctx: PrelContext = {
    userId: parsed.userId,
    sessionId: parsed.sessionId,
    functionId: options.functionId,
    operationScope: [parsed.operation],
    chainDepth: parsed.chainDepth,
    parentTokenHash: parsed.parentHash,
    cipScore: parsed.cipHash ? 100 : null,
    f2faWindow: parsed.f2faWindow,
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    isLongOp: parsed.isLongOp,
    longOpExpiresAt: parsed.longOpExpiresAt,
  }

  return handler(ctx, supabase)
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

export function getCorsHeaders(): Record<string, string> {
  return CORS_HEADERS
}

export async function sha256(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
