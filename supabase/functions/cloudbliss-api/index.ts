// CloudBliss API v4.0 — Entry Point

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendSignal } from '../_shared/signals.ts'
import { emitWebhookEvent } from '../_shared/webhook-emitter.ts'

import {
  CORS_HEADERS, jsonResponse, errorResponse, apiError, verifyRequestSignature,
  ROLE_RANK, generateStreamToken, generateDeviceFingerprint,
} from './lib.ts'

import {
  handleFilesAPI, handleSearchAPI, handleBatchAPI,
  handleStatsAPI, handleExportAPI, handleHealthAPI, handleKeysAPI,
  handleStorageAPI, handleUserAPI, handleSecretsAPI, handleSquidShakeAPI,
  handleVeilRefAPI, handleRootAPI, handleStreamAPI, getOperationForPath,
} from './handlers.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const startTime = Date.now()
  let supabase: any
  let keyData: any = null
  let apiResponse: Response
  let lastError = ''
  const logMeta: { reqFileName: string | null; reqFileSize: number | null } = { reqFileName: null, reqFileSize: null }

  try {
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const rawApiKey = req.headers.get('x-squidcloud-key') ||
      req.headers.get('X-SquidCloud-Key') ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    const path = url.pathname
      .replace('/cloudbliss-api', '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
    const pathParts = path.split('/').filter(p => p.length > 0)
    const firstPathSegment = pathParts[0] || ''

    if (firstPathSegment === 'health') {
      return await handleHealthAPI(req, supabase)
    }

    if (!rawApiKey) {
      return errorResponse('SquidCloud API key required. Include it in X-SquidCloud-Key header.', 401, 'MISSING_API_KEY')
    }

    // ===== AUTH LAYER =====
    keyData = await authenticateApiKey(supabase, rawApiKey)
    if (!keyData) {
      keyData = await authenticateCliToken(supabase, rawApiKey)
    }
    if (!keyData) {
      return errorResponse('Invalid SquidCloud API key', 401, 'INVALID_API_KEY')
    }

    const userId = keyData.user_id

    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id)

    // ===== GUARD LAYER =====
    const guardResult = await checkGuards(supabase, userId, keyData.id)
    if (!guardResult.allowed) {
      return errorResponse(guardResult.reason, guardResult.status, guardResult.code)
    }

    // ===== REQUEST SIGNATURE VERIFICATION (optional) =====
    if (keyData.allow_hmac) {
      const validSig = await verifyRequestSignature(req, rawApiKey)
      if (!validSig) {
        return errorResponse('Invalid request signature', 401, 'INVALID_SIGNATURE')
      }
    }

    // ===== DETERMINE OPERATION & CREDITS =====
    const operation = getOperationForPath(req.method, path, pathParts)
    const workspaceId = url.searchParams.get('workspace_id') || undefined

    let fileSize = 0
    if (req.method === 'POST' && (path === '/upload' || path === '/files/upload/init')) {
      try { const body = await req.clone().json(); fileSize = body.size || 0 } catch { /* ignore */ }
    }
    if (req.method === 'POST' && path === '/upload/complete') {
      // Size is known from the session, use 0 for credit calc (same as init)
      fileSize = 0
    }
    if (req.method === 'GET' && (path.startsWith('/download/') || path.match(/^\/files\/[a-f0-9-]+\/download$/))) {
      const match = path.match(/\/([a-f0-9-]+)\/download$/) || path.match(/\/download\/([a-f0-9-]+)/)
      if (match) {
        const { data: f } = await supabase.from('files').select('size').eq('id', match[1]).maybeSingle()
        fileSize = f?.size || 0
      }
    }

    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_api_credits', {
      p_user_id: userId,
      p_api_key_id: keyData.id,
      p_operation: operation,
      p_file_size: fileSize,
    })

    if (deductError || !deductResult?.allowed) {
      const reason = deductResult?.reason || 'Credit check failed'
      const code = deductResult?.code || 'CREDIT_ERROR'
      return apiError(reason, code, 402, null)
    }

    // Notify the owner once per day when credits drop to 20% of the daily limit.
    const remaining = Number(deductResult?.credits_remaining)
    const dailyLimit = Number(deductResult?.daily_limit)
    if (Number.isFinite(remaining) && remaining >= 0 && Number.isFinite(dailyLimit) && dailyLimit > 0 && remaining <= dailyLimit * 0.2) {
      void sendSignal({
        service_id: 'cloudbliss',
        user_id: userId,
        type: 'credits_low',
        severity: 'warning',
        title: 'API credits running low',
        body: `${remaining} credits remaining (${dailyLimit} daily limit). Top up or your API calls will start failing.`,
        link: '/developer-api',
        idempotency_key: `credits_low:${userId}:${new Date().toISOString().slice(0, 10)}`,
      })

      void emitWebhookEvent({
        userId,
        event: 'api_tokens.quota_warning',
        data: {
          used: Math.max(0, dailyLimit - remaining),
          limit: dailyLimit,
          remaining,
          reset_at: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString(),
        },
      })
    }

    // ===== ROUTING LAYER =====
    try {
      switch (firstPathSegment) {
        case 'upload':
          // Simple upload endpoints: POST /upload, POST /upload/complete, POST /upload/encrypted
          apiResponse = await handleFilesAPI(req, supabase, userId, path, pathParts, workspaceId, rawApiKey)
          break
        case 'download':
          // Simple download: GET /download/:id
          apiResponse = await handleFilesAPI(req, supabase, userId, path, pathParts, workspaceId, rawApiKey)
          break
        case 'files':
          apiResponse = await handleFilesAPI(req, supabase, userId, path, pathParts, workspaceId, rawApiKey)
          break
        case 'stream':
          if (req.method === 'POST' && path === '/stream/init') {
            const body = await req.clone().json().catch(() => ({})) as Record<string, unknown>
            const streamFileId = (body.file_id as string) || ''
            if (!streamFileId) {
              apiResponse = errorResponse('file_id is required', 400, 'MISSING_FILE_ID')
              break
            }
            const { data: streamFile } = await supabase
              .from('files')
              .select('id, is_deleted')
              .eq('id', streamFileId)
              .single()
            if (!streamFile || streamFile.is_deleted) {
              apiResponse = errorResponse('File not found', 404, 'FILE_NOT_FOUND')
              break
            }
            const streamSecret = Deno.env.get('STREAM_SESSION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
            const deviceFp = generateDeviceFingerprint(req)
            const token = await generateStreamToken(streamFileId, userId, deviceFp, streamSecret, 120)
            apiResponse = jsonResponse({
              success: true,
              token,
              stream_url: `/stream?id=${streamFileId}&token=${encodeURIComponent(token)}`,
              expires_in: 120,
            })
          } else {
            apiResponse = await handleStreamAPI(req, supabase, userId, path, pathParts)
          }
          break
        case 'search':
          apiResponse = await handleSearchAPI(req, supabase, userId, path, pathParts, workspaceId)
          break
        case 'batch':
          apiResponse = await handleBatchAPI(req, supabase, userId, path, pathParts, workspaceId)
          break
        case 'stats':
          apiResponse = await handleStatsAPI(req, supabase, userId, path, pathParts)
          break
        case 'export':
          apiResponse = await handleExportAPI(req, supabase, userId, path, pathParts, workspaceId)
          break
        case 'keys':
          apiResponse = await handleKeysAPI(req, supabase, userId, path, pathParts)
          break
        case 'storage':
          apiResponse = await handleStorageAPI(req, supabase, userId, path, pathParts, workspaceId)
          break
        case 'user':
        case 'whoami':
          apiResponse = await handleUserAPI(req, supabase, userId, path, pathParts)
          break
        case 'secrets':
          apiResponse = await handleSecretsAPI(req, supabase, userId, path, pathParts, rawApiKey, keyData.id)
          break
        case 'squidshake':
          apiResponse = await handleSquidShakeAPI(req, supabase, userId, path, pathParts, rawApiKey)
          break
        case 'veilref':
          apiResponse = await handleVeilRefAPI(req, supabase, userId, path, pathParts, rawApiKey)
          break
        default:
          apiResponse = handleRootAPI()
      }
    } catch (handlerError: any) {
      console.error('Handler error:', handlerError)
      lastError = handlerError.message || 'Handler error'
      apiResponse = errorResponse(lastError, 500, 'HANDLER_ERROR')
    }

    // ===== RESPONSE ENRICHMENT =====
    if (deductResult && deductResult.allowed) {
      apiResponse = enrichResponseWithCredits(apiResponse, deductResult)
    }

    return apiResponse

  } catch (error: any) {
    console.error('CloudBliss API Error:', error)
    lastError = error.message || 'Internal server error'
    return errorResponse(lastError, 500, 'INTERNAL_ERROR')
  } finally {
    // ===== AUDIT LOG =====
    try {
      const statusCode = apiResponse?.status || 500
      await supabase.from('api_request_logs').insert({
        api_key_id: keyData?.id || null,
        user_id: keyData?.user_id || null,
        endpoint: new URL(req.url).pathname,
        method: req.method,
        ip_address: req.headers.get('x-forwarded-for') || null,
        user_agent: req.headers.get('user-agent') || null,
        status_code: statusCode,
        response_time_ms: Date.now() - startTime,
        error_message: lastError || null,
        file_name: logMeta.reqFileName,
        file_size: logMeta.reqFileSize,
      })
    } catch (logError) {
      console.error('Failed to log API request:', logError)
    }
  }
})

async function authenticateApiKey(supabase: any, apiKey: string): Promise<any | null> {
  const keyPrefix = apiKey.substring(0, 8)

  const { data: candidates, error } = await supabase
    .from('api_keys')
    .select('id, user_id, is_active, scopes, key_hash, key_salt, allow_hmac, request_timestamp_max_age')
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true)

  if (error || !candidates || candidates.length === 0) return null

  const encoder = new TextEncoder()

  for (const candidate of candidates) {
    const saltBase64 = candidate.key_salt || ''
    const saltBytes = saltBase64 ? Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)) : new Uint8Array(0)
    const apiKeyBytes = encoder.encode(apiKey)
    const combined = new Uint8Array(saltBytes.length + apiKeyBytes.length)
    combined.set(saltBytes)
    combined.set(apiKeyBytes, saltBytes.length)
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (computedHash === candidate.key_hash) {
      return candidate
    }
  }

  return null
}

async function hashCliToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function authenticateCliToken(supabase: any, token: string): Promise<any | null> {
  const tokenHash = await hashCliToken(token)

  const { data: device, error } = await supabase
    .from('cli_devices')
    .select('id, user_id, status, token_hash, scope')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !device || device.status !== 'active' || !device.user_id) return null

  return {
    id: device.id,
    user_id: device.user_id,
    is_active: true,
    scopes: device.scope || 'read write',
    allow_hmac: false,
    request_timestamp_max_age: null,
    via_cli_oauth: true,
  }
}

function configToBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false
  }
  return null
}

async function checkGuards(supabase: any, userId: string, keyId: string): Promise<{ allowed: boolean; reason?: string; status?: number; code?: string }> {
  const { data: globalConfig } = await supabase
    .from('api_admin_config')
    .select('value')
    .eq('key', 'api_globally_enabled')
    .maybeSingle()

  if (globalConfig && configToBool(globalConfig.value) === false) {
    const { data: msg } = await supabase
      .from('api_admin_config')
      .select('value')
      .eq('key', 'maintenance_message')
      .maybeSingle()
    return { allowed: false, reason: msg?.value || 'API is temporarily disabled for maintenance', status: 503, code: 'API_DISABLED' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('api_disabled, tier')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.api_disabled) {
    return { allowed: false, reason: 'Your API access has been disabled', status: 403, code: 'USER_DISABLED' }
  }

  const { data: keyLimit } = await supabase
    .from('api_key_limits')
    .select('is_disabled')
    .eq('api_key_id', keyId)
    .maybeSingle()

  if (keyLimit?.is_disabled) {
    return { allowed: false, reason: 'This API key has been disabled', status: 403, code: 'KEY_DISABLED' }
  }

  if (profile?.tier && profile.tier !== 'free') {
    const { data: subCheck } = await supabase.rpc('check_subscription_validity', { user_id: userId })
    if (subCheck && subCheck.valid === false && subCheck.reason === 'subscription_expired') {
      return { allowed: false, reason: 'Your subscription has expired. Renew to continue using the API.', status: 402, code: 'SUBSCRIPTION_EXPIRED' }
    }
  }

  return { allowed: true }
}

function enrichResponseWithCredits(original: Response, creditInfo: any): Response {
  try {
    const ct = original.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return original

    const originalBody = original.clone()
    return originalBody.json().then(body => {
      const enriched = {
        ...body,
        credits: {
          deducted: creditInfo.credits_deducted || 0,
          remaining: creditInfo.credits_remaining,
          used_today: creditInfo.credits_used_today,
          daily_limit: creditInfo.daily_limit,
        },
      }
      return new Response(JSON.stringify(enriched), {
        status: original.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }).catch(() => original)
  } catch {
    return original
  }
}
