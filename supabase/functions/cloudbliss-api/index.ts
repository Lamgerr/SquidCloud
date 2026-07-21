import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  jsonResponse, errorResponse, apiSuccess, apiError, CORS_HEADERS,
  getOptionalEncryptionKey, validateEncryptionKeyFormat,
  verifyRequestSignature,
  resolveWorkspaceId,
} from './utils.ts'

import {
  handleFilesAPI, handleCDNAPI, handleSearchAPI, handleBatchAPI,
  handleStatsAPI, handleExportAPI, handleHealthAPI,
  handleKeysAPI, handleStorageAPI, handleUserAPI,
  handleSecretsAPI, handleSquidShakeAPI, handleVeilRefAPI,
  handleRootAPI, getOperationForPath,
} from './handlers.ts'

const API_VERSION = '4.0'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const startTime = Date.now()
  let supabase: any
  let keyData: any = null
  let apiResponse: Response
  let apiError = ''
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

    // Health check is public
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
      return errorResponse('Invalid SquidCloud API key', 401, 'INVALID_API_KEY')
    }

    const userId = keyData.user_id

    // Update last used timestamp
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
    if (req.method === 'POST' && path === '/files/upload/init') {
      try { const body = await req.clone().json(); fileSize = body.size || 0 } catch { /* ignore */ }
    }
    if (req.method === 'POST' && path.match(/^\/files\/[a-f0-9-]+\/download$/)) {
      const match = path.match(/^\/files\/([a-f0-9-]+)\/download/)
      if (match) {
        const { data: f } = await supabase.from('files').select('size').eq('id', match[1]).maybeSingle()
        fileSize = f?.size || 0
      }
    }

    // Deduct credits
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

    // ===== ROUTING LAYER =====
    try {
      switch (firstPathSegment) {
        case 'files':
          apiResponse = await handleFilesAPI(req, supabase, userId, path, pathParts, workspaceId, rawApiKey)
          break
        case 'cdn':
          apiResponse = await handleCDNAPI(req, supabase, userId, path, pathParts, workspaceId)
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
      apiError = handlerError.message || 'Handler error'
      apiResponse = errorResponse(apiError, 500, 'HANDLER_ERROR')
    }

    // ===== RESPONSE ENRICHMENT =====
    if (deductResult && deductResult.allowed) {
      apiResponse = enrichResponseWithCredits(apiResponse, deductResult)
    }

    return apiResponse

  } catch (error: any) {
    console.error('CloudBliss API Error:', error)
    apiError = error.message || 'Internal server error'
    return errorResponse(apiError, 500, 'INTERNAL_ERROR')
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
        error_message: apiError || null,
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

async function checkGuards(supabase: any, userId: string, keyId: string): Promise<{ allowed: boolean; reason?: string; status?: number; code?: string }> {
  // 1. Global API disable
  const { data: globalConfig } = await supabase
    .from('api_admin_config')
    .select('value')
    .eq('key', 'api_globally_enabled')
    .maybeSingle()

  if (globalConfig && globalConfig.value === false) {
    const { data: msg } = await supabase
      .from('api_admin_config')
      .select('value')
      .eq('key', 'maintenance_message')
      .maybeSingle()
    return { allowed: false, reason: msg?.value || 'API is temporarily disabled for maintenance', status: 503, code: 'API_DISABLED' }
  }

  // 2. Per-user API disable
  const { data: profile } = await supabase
    .from('profiles')
    .select('api_disabled, tier')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.api_disabled) {
    return { allowed: false, reason: 'Your API access has been disabled', status: 403, code: 'USER_DISABLED' }
  }

  // 3. Per-key disable
  const { data: keyLimit } = await supabase
    .from('api_key_limits')
    .select('is_disabled')
    .eq('api_key_id', keyId)
    .maybeSingle()

  if (keyLimit?.is_disabled) {
    return { allowed: false, reason: 'This API key has been disabled', status: 403, code: 'KEY_DISABLED' }
  }

  // 4. Subscription validity
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
