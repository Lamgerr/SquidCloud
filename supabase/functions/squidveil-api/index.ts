// ============================================================
// squidveil-api — entry point
// Standalone secrets manager edge function. Fully decoupled
// from cloudbliss-api. Own access tokens (sv_*), Vault-style
// policies, HMAC-chained audit, envelope encryption.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  CORS_HEADERS, jsonResponse, errorResponse,
  getMasterKey, hashAccessToken, constantTimeEqual, appendAudit,
  generateAccessToken, rateLimit, type PolicyRule,
} from './lib.ts'
import {
  handleTokensAPI, handlePoliciesAPI, handleSecretsAPI,
  handleVersionsAPI, handleVeilRefAPI, handleAuditAPI,
  handleKeysAPI, handleRotateDue, handleStatsAPI, handleMonitorAPI,
  type AuthContext,
} from './handlers.ts'

const MAX_BODY = 256 * 1024

function makeClient(): any {
  const url = Deno.env.get('SQUIDVEIL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SQUIDVEIL_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase URL and service role key are required')
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'squidveil' },
    global: { headers: { 'x-application-name': 'squidveil-api' } },
  })
}

async function parseBody(req: Request): Promise<any> {
  const text = await req.text()
  if (!text) return {}
  if (text.length > MAX_BODY) throw new Error('BODY_TOO_LARGE')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}

// ------------------------------------------------------------
// Auth: X-SquidVeil-Token -> access_tokens row -> policy rules
// ------------------------------------------------------------
async function authenticate(supabase: any, req: Request): Promise<{ ok: boolean; status: number; code: string; message: string; ctx?: AuthContext }> {
  const header = req.headers.get('X-SquidVeil-Token') || req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!header) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Missing X-SquidVeil-Token header' }
  }
  const masterKey = await getMasterKey()
  const tokenHash = await hashAccessToken(masterKey, header)

  if (!rateLimit(tokenHash, 300, 60_000)) {
    return { ok: false, status: 429, code: 'RATE_LIMITED', message: 'Too many requests' }
  }

  const { data: token } = await supabase
    .from('access_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!token) {
    await appendAudit(supabase, masterKey, {
      action: 'auth.failed', actor_type: 'system', actor_id: 'unknown',
      path: 'auth', success: false, detail: 'INVALID_TOKEN',
    }, req)
    return { ok: false, status: 401, code: 'INVALID_TOKEN', message: 'Invalid access token' }
  }
  if (token.revoked_at) {
    await appendAudit(supabase, masterKey, {
      action: 'auth.failed', actor_type: 'system', actor_id: token.owner_id,
      path: 'auth', success: false, detail: 'REVOKED:' + (token.name || ''),
    }, req)
    return { ok: false, status: 401, code: 'REVOKED', message: 'Access token revoked' }
  }
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    await appendAudit(supabase, masterKey, {
      action: 'auth.failed', actor_type: 'system', actor_id: token.owner_id,
      path: 'auth', success: false, detail: 'EXPIRED:' + (token.name || ''),
    }, req)
    return { ok: false, status: 401, code: 'EXPIRED', message: 'Access token expired' }
  }

  const policyNames: string[] = Array.isArray(token.policies) ? token.policies : []
  let rules: PolicyRule[] = []
  if (policyNames.length > 0) {
    const { data: policies } = await supabase
      .from('policies')
      .select('name, rules')
      .eq('owner_id', token.owner_id)
      .in('name', policyNames)
    for (const p of (policies || [])) {
      if (Array.isArray(p.rules)) rules = [...rules, ...p.rules]
    }
  }

  supabase.from('access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', token.id)
    .then(() => {}).catch(() => {})

  return {
    ok: true, status: 200, code: '', message: '',
    ctx: {
      tokenId: token.id,
      ownerId: token.owner_id,
      tokenHash,
      tokenName: token.name,
      rules,
      isCron: false,
    },
  }
}

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const path = url.pathname
    .replace(/^\/(?:functions\/v1\/)?squidveil-api/, '')
    .replace(/\/\/+/g, '/')
    .replace(/\/+$/, '') || '/'
  const method = req.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (path === '/health' && method === 'GET') {
    return jsonResponse({ ok: true, service: 'squidveil-api', version: 10 })
  }

  const supabase = makeClient()

  // Bootstrap: valid Supabase user JWT + zero access tokens => issue first admin token.
  if (path === '/v1/bootstrap' && method === 'POST') {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return errorResponse('Provide a Supabase session JWT in the Authorization header', 401, 'UNAUTHORIZED')
    const body = await req.json().catch(() => ({}))
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) return errorResponse('Invalid Supabase session', 401, 'UNAUTHORIZED')
    const ownerId = userData.user.id

    // Recovery-aware guard: only block when at least one token is still
    // usable. Expired or revoked rows must not lock the owner out — a user
    // whose local copy is gone and whose tokens all lapsed needs a fresh
    // bootstrap to regain access (their Supabase session is the root of trust).
    const { data: existingTokens } = await supabase.from('access_tokens').select('id, expires_at, revoked_at').eq('owner_id', ownerId).limit(50)
    const now = Date.now()
    const hasActive = (existingTokens || []).some((t: any) => !t.revoked_at && (!t.expires_at || new Date(t.expires_at).getTime() > now))
    if (hasActive) {
      return errorResponse('An active token already exists — use its saved value, or rotate it from the Tokens tab', 409, 'ALREADY_BOOTSTRAPPED')
    }

    const masterKey = await getMasterKey()
    const tokenName = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : 'default-admin'

    const { data: existingPolicy } = await supabase
      .from('policies')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('name', 'default')
      .maybeSingle()
    if (!existingPolicy) {
      const { error: polErr } = await supabase
        .from('policies')
        .insert({
          owner_id: ownerId,
          name: 'default',
          rules: [{
            path: '*',
            capabilities: [
              'read', 'write', 'delete', 'list', 'verify', 'rotate', 'versions', 'destroy',
              'token_admin', 'policy_admin', 'audit',
            ],
            effect: 'allow',
          }],
        })
        .select('id')
        .single()
      if (polErr) return errorResponse('Failed to create default policy', 500, 'DB_ERROR')
    }

    const rawToken = generateAccessToken()
    const tokenHash = await hashAccessToken(masterKey, rawToken)
    const { error: tokErr } = await supabase.from('access_tokens').insert({
      owner_id: ownerId,
      token_hash: tokenHash,
      token_prefix: rawToken.slice(0, 8),
      name: tokenName,
      policies: ['default'],
    })
    if (tokErr) return errorResponse('Failed to create bootstrap token', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'system.bootstrapped', actor_type: 'user', actor_id: ownerId,
      path: '*', success: true, detail: 'first admin token issued via Supabase JWT',
    })

    return jsonResponse({
      success: true,
      token: { name: tokenName, policies: ['default'], token_prefix: rawToken.slice(0, 8) },
      raw_token: rawToken,
      note: 'raw_token is shown once',
    }, 201)
  }

  // Cron endpoint: authenticated by internal cron token, no sv_ token.
  if (path === '/rotate/due' && method === 'POST') {
    const { data: cfg } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'internal_cron_token')
      .maybeSingle()
    const provided = req.headers.get('x-squidveil-cron-token') || ''
    if (!cfg || !constantTimeEqual(String(cfg.value), provided)) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }
    return await handleRotateDue(supabase, req)
  }

  if (!path.startsWith('/v1/')) {
    return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
  }

  const auth = await authenticate(supabase, req)
  if (!auth.ok || !auth.ctx) {
    return errorResponse(auth.message, auth.status, auth.code)
  }
  const ctx = auth.ctx

  let body: any = {}
  try {
    if (['POST', 'PUT', 'PATCH'].includes(method)) body = await parseBody(req)
  } catch (e: any) {
    const msg = String(e.message || e)
    if (msg === 'BODY_TOO_LARGE') return errorResponse('Request body exceeds 256KB', 413, 'BODY_TOO_LARGE')
    return errorResponse('Invalid JSON body', 400, 'INVALID_JSON')
  }

  let res: Response
  try {
    if (path === '/v1/keys/rotate' && method === 'POST') {
      res = await handleKeysAPI(supabase, ctx, method, path)
    } else if (/^\/v1\/secrets\/.+\/versions\/\d+\/(restore|disable|enable|destroy)$/.test(path)) {
      res = await handleVersionsAPI(supabase, ctx, method, path, body)
    } else if (path.startsWith('/v1/tokens')) {
      res = await handleTokensAPI(supabase, ctx, method, path, path.split('/'), body)
    } else if (path.startsWith('/v1/policies')) {
      res = await handlePoliciesAPI(supabase, ctx, method, path, path.split('/'), body)
    } else if (path.startsWith('/v1/secrets')) {
      res = await handleSecretsAPI(supabase, ctx, method, path, path.split('/'), body, url.searchParams)
    } else if (path.startsWith('/v1/veilref')) {
      res = await handleVeilRefAPI(supabase, ctx, method, path, body, req)
    } else if (path.startsWith('/v1/audit')) {
      res = await handleAuditAPI(supabase, ctx, method, path, url.searchParams)
    } else if (path === '/v1/stats' && method === 'GET') {
      res = await handleStatsAPI(supabase, ctx, url.searchParams)
    } else if (path === '/v1/monitor' && method === 'GET') {
      res = await handleMonitorAPI(supabase, ctx)
    } else {
      res = errorResponse('Endpoint not found', 404, 'NOT_FOUND')
    }
  } catch (e: any) {
    console.error('squidveil-api unhandled error:', e)
    res = errorResponse('Internal error', 500, 'INTERNAL')
  }

  return withCors(res)
})
