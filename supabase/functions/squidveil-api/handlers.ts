// ============================================================
// squidveil-api — handlers
// Secrets lifecycle, versions, rotation, policies, tokens,
// VeilRef v2, audit, key management.
// ============================================================

import {
  jsonResponse, errorResponse, appendAudit, verifyAuditChain,
  getMasterKey, getSecretDek, generateDek, wrapDek,
  generateAccessToken, hashAccessToken,
  checkAllowed, globMatch, isValidCapability,
  validateSecretName, validateLabels, parseLimit, parseOffset, rateLimit,
  aes256GcmEncrypt, aes256GcmDecrypt, hmacSha256Hex, sha256Hex,
  base64UrlEncode, randomBytes, constantTimeEqual, toHex,
  type PolicyRule,
} from './lib.ts'
import { sendSignal } from '../_shared/signals.ts'

export interface AuthContext {
  tokenId: string
  ownerId: string
  tokenHash: string
  tokenName: string
  rules: PolicyRule[]
  isCron: boolean
}

export function authLabel(ctx: AuthContext): string {
  return ctx.isCron ? 'system' : ctx.tokenName
}

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------
async function getLatestVersion(supabase: any, secretId: string): Promise<any | null> {
  const { data } = await supabase
    .from('secret_versions')
    .select('*')
    .eq('secret_id', secretId)
    .eq('state', 'ENABLED')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function findSecret(supabase: any, ownerId: string, name: string): Promise<any | null> {
  const { data } = await supabase
    .from('secrets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('name', name)
    .maybeSingle()
  return data
}

async function decryptVersion(supabase: any, masterKey: Uint8Array, ownerId: string, version: any): Promise<string> {
  if (version.key_id === 'legacy') {
    throw new Error('Legacy value was keyed by the retired CloudBliss API key and is unrecoverable — rotate the secret to set a new value')
  }
  const dek = await getSecretDek(supabase, masterKey, ownerId, version.key_id)
  if (!dek) throw new Error('Encryption key for this version is unavailable')
  const pt = await aes256GcmDecrypt(version.encrypted_value, version.iv, dek)
  return new TextDecoder().decode(pt)
}

async function ensureDek(supabase: any, masterKey: Uint8Array, ownerId: string, secretId: string, keyId?: string): Promise<string> {
  const useKeyId = keyId || `dek-${secretId}`
  const { data: existing } = await supabase
    .from('secret_keys')
    .select('key_id')
    .eq('owner_id', ownerId)
    .eq('key_id', useKeyId)
    .maybeSingle()
  if (existing) return useKeyId

  const dek = await generateDek()
  const { wrapped, iv } = await wrapDek(masterKey, dek)
  const { error } = await supabase.from('secret_keys').insert({
    owner_id: ownerId,
    key_id: useKeyId,
    wrapped_dek: wrapped,
    iv,
    active: true,
  })
  if (error) throw error
  return useKeyId
}

async function createVersion(
  supabase: any,
  ctx: AuthContext,
  masterKey: Uint8Array,
  secret: any,
  value: string,
  opts: { state?: string; detail?: string; keyId?: string } = {},
): Promise<any> {
  const keyId = await ensureDek(supabase, masterKey, ctx.ownerId, secret.id, opts.keyId)
  const { ciphertext, iv } = await aes256GcmEncrypt(new TextEncoder().encode(value), await getSecretDek(supabase, masterKey, ctx.ownerId, keyId)!)

  const { data: nRow } = await supabase
    .from('secret_versions')
    .select('version_number')
    .eq('secret_id', secret.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const versionNumber = (nRow?.version_number ?? 0) + 1

  const { data: version, error } = await supabase
    .from('secret_versions')
    .insert({
      secret_id: secret.id,
      version_number: versionNumber,
      encrypted_value: ciphertext,
      iv,
      key_id: keyId,
      state: opts.state || 'ENABLED',
      created_by_token_id: ctx.isCron ? null : ctx.tokenId,
      created_by: authLabel(ctx),
    })
    .select('id, secret_id, version_number, state, created_by, created_at')
    .single()

  if (error) throw error

  await supabase
    .from('secrets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', secret.id)

  await appendAudit(supabase, masterKey, {
    action: 'secret.version_created',
    actor_type: ctx.isCron ? 'system' : 'token',
    actor_id: ctx.isCron ? 'cron' : ctx.tokenId,
    path: secret.name,
    version_number: versionNumber,
    success: true,
    detail: opts.detail || 'version created',
  })

  return version
}

// ------------------------------------------------------------
// TOKENS
// ------------------------------------------------------------
export async function handleTokensAPI(supabase: any, ctx: AuthContext, method: string, path: string, pathParts: string[], body: any): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'token_admin')) {
    return errorResponse('Token requires the token_admin capability', 403, 'FORBIDDEN')
  }

  // POST /v1/tokens
  if (method === 'POST' && path === '/v1/tokens') {
    const name = (body?.name as string || '').trim()
    if (!name || name.length > 100) return errorResponse('Token name is required (max 100 chars)', 400, 'INVALID_NAME')

    const policies = Array.isArray(body?.policies) ? body.policies.filter((p: unknown) => typeof p === 'string') : []

    let expiresAt: string | null = null
    if (body?.expires_in_seconds != null) {
      const ttl = Number(body.expires_in_seconds)
      if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 31536000) {
        return errorResponse('expires_in_seconds must be 1..31536000', 400, 'INVALID_TTL')
      }
      expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
    }

    const masterKey = await getMasterKey()
    const rawToken = generateAccessToken()
    const tokenHash = await hashAccessToken(masterKey, rawToken)
    const tokenPrefix = rawToken.slice(0, 8)

    const { data: token, error } = await supabase
      .from('access_tokens')
      .insert({
        owner_id: ctx.ownerId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        name,
        policies: policies.length ? policies : ['default'],
        expires_at: expiresAt,
      })
      .select('id, name, token_prefix, policies, created_at, expires_at')
      .single()

    if (error) return errorResponse('Failed to create token', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'token.created',
      actor_type: 'token',
      actor_id: ctx.tokenId,
      path: name,
      success: true,
    })

    void sendSignal({
      service_id: 'squidveil',
      user_id: ctx.ownerId,
      type: 'token_created',
      severity: 'info',
      title: `Token '${name}' created`,
      body: 'A new API token was created for your account.',
      link: '/dashboard',
      idempotency_key: `token_created:${token.id}`,
    })

    return jsonResponse({ success: true, token: token, raw_token: rawToken, note: 'raw_token is shown once' }, 201)
  }

  // GET /v1/tokens
  if (method === 'GET' && path === '/v1/tokens') {
    const { data: tokens } = await supabase
      .from('access_tokens')
      .select('id, name, token_prefix, policies, created_at, expires_at, revoked_at, last_used_at')
      .eq('owner_id', ctx.ownerId)
      .order('created_at', { ascending: false })
    return jsonResponse({ success: true, tokens: tokens || [] })
  }

  // POST /v1/tokens/:id/rotate — invalidate the current value, issue a new raw token with the same identity
  const rotateMatch = path.match(/^\/v1\/tokens\/([0-9a-f-]+)\/rotate$/)
  if (method === 'POST' && rotateMatch) {
    const { data: existing } = await supabase
      .from('access_tokens')
      .select('id, name, policies, expires_at, revoked_at')
      .eq('id', rotateMatch[1])
      .eq('owner_id', ctx.ownerId)
      .maybeSingle()
    if (!existing) return errorResponse('Token not found', 404, 'NOT_FOUND')
    if (existing.revoked_at) return errorResponse('Cannot rotate a revoked token — revoke or delete it', 409, 'REVOKED')

    const masterKey = await getMasterKey()
    const rawToken = generateAccessToken()
    const tokenHash = await hashAccessToken(masterKey, rawToken)
    const tokenPrefix = rawToken.slice(0, 8)

    const { error } = await supabase
      .from('access_tokens')
      .update({ token_hash: tokenHash, token_prefix: tokenPrefix })
      .eq('id', existing.id)
    if (error) return errorResponse('Failed to rotate token', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'token.rotated', actor_type: 'token', actor_id: ctx.tokenId,
      path: existing.name, success: true,
    })

    void sendSignal({
      service_id: 'squidveil',
      user_id: ctx.ownerId,
      type: 'token_rotated',
      severity: 'warning',
      title: `Token '${existing.name}' rotated`,
      body: 'The previous token value is permanently invalid.',
      link: '/dashboard',
      idempotency_key: `token_rotated:${existing.id}`,
    })

    return jsonResponse({
      success: true,
      token: {
        id: existing.id,
        name: existing.name,
        token_prefix: tokenPrefix,
        policies: existing.policies,
        expires_at: existing.expires_at,
      },
      raw_token: rawToken,
      note: 'raw_token is shown once — the previous token value is permanently invalid',
    })
  }

  // DELETE /v1/tokens/:id — permanent deletion
  const delTokenMatch = path.match(/^\/v1\/tokens\/([0-9a-f-]+)$/)
  if (method === 'DELETE' && delTokenMatch) {
    const { data: existing, error } = await supabase
      .from('access_tokens')
      .delete()
      .eq('id', delTokenMatch[1])
      .eq('owner_id', ctx.ownerId)
      .select('id, name')
      .single()
    if (error || !existing) return errorResponse('Token not found', 404, 'NOT_FOUND')

    await appendAudit(supabase, await getMasterKey(), {
      action: 'token.deleted', actor_type: 'token', actor_id: ctx.tokenId,
      path: existing.name, success: true,
    })
    return jsonResponse({ success: true })
  }

  // POST /v1/tokens/:id/revoke
  const revokeMatch = path.match(/^\/v1\/tokens\/([0-9a-f-]+)\/revoke$/)
  if (method === 'POST' && revokeMatch) {
    const { data, error } = await supabase
      .from('access_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', revokeMatch[1])
      .eq('owner_id', ctx.ownerId)
      .select('id, name')
      .single()
    if (error || !data) return errorResponse('Token not found', 404, 'NOT_FOUND')
    await appendAudit(supabase, await getMasterKey(), {
      action: 'token.revoked',
      actor_type: 'token',
      actor_id: ctx.tokenId,
      path: data.name,
      success: true,
    })
    void sendSignal({
      service_id: 'squidveil',
      user_id: ctx.ownerId,
      type: 'token_revoked',
      severity: 'urgent',
      title: `Token '${data.name}' revoked`,
      body: 'A token on your account was revoked. If this was not you, audit your tokens immediately.',
      link: '/dashboard',
      idempotency_key: `token_revoked:${data.id}`,
    })
    return jsonResponse({ success: true, token: data })
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// POLICIES
// ------------------------------------------------------------
export async function handlePoliciesAPI(supabase: any, ctx: AuthContext, method: string, path: string, pathParts: string[], body: any): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'policy_admin')) {
    return errorResponse('Token requires the policy_admin capability', 403, 'FORBIDDEN')
  }

  const validateRules = (rules: unknown): PolicyRule[] | null => {
    if (!Array.isArray(rules) || rules.length === 0) return null
    for (const r of rules) {
      if (typeof r !== 'object' || r === null) return null
      const rule = r as Record<string, unknown>
      if (typeof rule.path !== 'string' || !rule.path) return null
      if (!Array.isArray(rule.capabilities) || rule.capabilities.length === 0) return null
      for (const cap of rule.capabilities) {
        if (typeof cap !== 'string' || !isValidCapability(cap)) return null
      }
      if (rule.effect !== 'allow' && rule.effect !== 'deny') return null
    }
    return rules as PolicyRule[]
  }

  // POST /v1/policies
  if (method === 'POST' && path === '/v1/policies') {
    const name = (body?.name as string || '').trim()
    if (!name || name.length > 100) return errorResponse('Policy name is required (max 100 chars)', 400, 'INVALID_NAME')
    const rules = validateRules(body?.rules)
    if (!rules) return errorResponse('rules must be a non-empty array of {path, capabilities[], effect: allow|deny}', 400, 'INVALID_RULES')

    const { data: policy, error } = await supabase
      .from('policies')
      .insert({ owner_id: ctx.ownerId, name, rules })
      .select('id, name, rules, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return errorResponse(`Policy "${name}" already exists`, 409, 'DUPLICATE')
      return errorResponse('Failed to create policy', 500, 'DB_ERROR')
    }

    await appendAudit(supabase, await getMasterKey(), {
      action: 'policy.created',
      actor_type: 'token',
      actor_id: ctx.tokenId,
      path: name,
      success: true,
    })
    return jsonResponse({ success: true, policy }, 201)
  }

  // GET /v1/policies
  if (method === 'GET' && path === '/v1/policies') {
    const { data: policies } = await supabase
      .from('policies')
      .select('id, name, rules, created_at, updated_at')
      .eq('owner_id', ctx.ownerId)
      .order('created_at', { ascending: false })
    return jsonResponse({ success: true, policies: policies || [] })
  }

  // PUT /v1/policies/:id
  const putMatch = path.match(/^\/v1\/policies\/([0-9a-f-]+)$/)
  if (method === 'PUT' && putMatch) {
    const rules = validateRules(body?.rules)
    if (!rules) return errorResponse('rules must be a non-empty array of {path, capabilities[], effect: allow|deny}', 400, 'INVALID_RULES')

    const { data: policy, error } = await supabase
      .from('policies')
      .update({ rules, updated_at: new Date().toISOString() })
      .eq('id', putMatch[1])
      .eq('owner_id', ctx.ownerId)
      .select('id, name, rules, updated_at')
      .single()
    if (error || !policy) return errorResponse('Policy not found', 404, 'NOT_FOUND')

    await appendAudit(supabase, await getMasterKey(), {
      action: 'policy.updated',
      actor_type: 'token',
      actor_id: ctx.tokenId,
      path: policy.name,
      success: true,
    })
    return jsonResponse({ success: true, policy })
  }

  // DELETE /v1/policies/:id
  const delMatch = path.match(/^\/v1\/policies\/([0-9a-f-]+)$/)
  if (method === 'DELETE' && delMatch) {
    const { data: policy, error } = await supabase
      .from('policies')
      .delete()
      .eq('id', delMatch[1])
      .eq('owner_id', ctx.ownerId)
      .select('id, name')
      .single()
    if (error || !policy) return errorResponse('Policy not found', 404, 'NOT_FOUND')

    await appendAudit(supabase, await getMasterKey(), {
      action: 'policy.deleted',
      actor_type: 'token',
      actor_id: ctx.tokenId,
      path: policy.name,
      success: true,
    })
    return jsonResponse({ success: true })
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// SECRETS (lifecycle + rotation)
// ------------------------------------------------------------
export async function handleSecretsAPI(supabase: any, ctx: AuthContext, method: string, path: string, pathParts: string[], body: any, query: URLSearchParams): Promise<Response> {
  const masterKey = await getMasterKey()

  // GET /v1/secrets — list (path-scoped by token rules)
  if (method === 'GET' && path === '/v1/secrets') {
    const { data: secrets } = await supabase
      .from('secrets')
      .select('id, name, description, labels, secret_type, recovery_window_days, deleted_at, created_at, updated_at')
      .eq('owner_id', ctx.ownerId)
      .order('created_at', { ascending: false })

    const visible = (secrets || []).filter((s: any) => {
      if (s.deleted_at) return checkAllowed(ctx.rules, s.name, 'delete') || checkAllowed(ctx.rules, s.name, 'list')
      return checkAllowed(ctx.rules, s.name, 'list') || checkAllowed(ctx.rules, s.name, 'read')
    })

    return jsonResponse({ success: true, secrets: visible })
  }

  // POST /v1/secrets — create
  if (method === 'POST' && path === '/v1/secrets') {
    const name = (body?.name as string || '').trim()
    const nameErr = validateSecretName(name)
    if (nameErr) return errorResponse(nameErr, 400, 'INVALID_NAME')
    if (!checkAllowed(ctx.rules, name, 'write')) return errorResponse('Token cannot write this secret path', 403, 'FORBIDDEN')

    const secretType = (body?.secret_type as string || 'opaque').trim()
    if (!['opaque', 'aes_gcm', 'http_auth', 'hmac_sign', 'connection_string'].includes(secretType)) {
      return errorResponse('Invalid secret_type', 400, 'INVALID_TYPE')
    }

    const labels = validateLabels(body?.labels)
    if (labels === null) return errorResponse('labels must be an object of string values', 400, 'INVALID_LABELS')

    let recoveryWindow = Number(body?.recovery_window_days ?? 7)
    if (!Number.isFinite(recoveryWindow) || recoveryWindow < 0 || recoveryWindow > 365) {
      return errorResponse('recovery_window_days must be 0..365', 400, 'INVALID_WINDOW')
    }
    recoveryWindow = Math.floor(recoveryWindow)

    const { data: existing } = await supabase
      .from('secrets')
      .select('id')
      .eq('owner_id', ctx.ownerId)
      .eq('name', name)
      .maybeSingle()
    if (existing) return errorResponse(`Secret "${name}" already exists`, 409, 'DUPLICATE')

    const { data: secret, error: secErr } = await supabase
      .from('secrets')
      .insert({
        owner_id: ctx.ownerId,
        name,
        description: (body?.description as string || '').slice(0, 2000),
        labels,
        secret_type: secretType,
        recovery_window_days: recoveryWindow,
      })
      .select('id, name, description, labels, secret_type, recovery_window_days, created_at, updated_at')
      .single()

    if (secErr) return errorResponse('Failed to create secret', 500, 'DB_ERROR')

    if (secretType === 'aes_gcm' && body?.value != null) {
      // Client-side encrypted (BYOK): store ciphertext as-is
      const value = String(body.value)
      const keyId = `dek-${secret.id}`
      const { error: keyErr } = await supabase.from('secret_keys').insert({
        owner_id: ctx.ownerId, key_id: keyId,
        wrapped_dek: body.iv ? String(body.iv) : '', iv: '',
        active: true,
      })
      if (keyErr) return errorResponse('Failed to store client-encrypted secret', 500, 'DB_ERROR')
      await supabase.from('secret_versions').insert({
        secret_id: secret.id, version_number: 1,
        encrypted_value: value, iv: body.iv ? String(body.iv) : '',
        key_id: keyId, state: 'ENABLED',
        created_by_token_id: ctx.tokenId, created_by: authLabel(ctx),
      })
      await appendAudit(supabase, masterKey, {
        action: 'secret.created', actor_type: 'token', actor_id: ctx.tokenId,
        path: name, version_number: 1, success: true, detail: 'client-encrypted (BYOK)',
      })
      return jsonResponse({ success: true, secret }, 201)
    }

    const value = body?.value
    if (value === undefined || value === null || String(value).trim() === '') {
      return errorResponse('Secret value is required', 400, 'INVALID_VALUE')
    }

    await createVersion(supabase, ctx, masterKey, secret, String(value), { detail: 'initial value' })

    await appendAudit(supabase, masterKey, {
      action: 'secret.created', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, version_number: 1, success: true,
    })

    return jsonResponse({ success: true, secret }, 201)
  }

  // ---- per-secret routes ----
  const rotateMatch = path.match(/^\/v1\/secrets\/(.+)\/rotate$/)
  const rotationMatch = path.match(/^\/v1\/secrets\/(.+)\/rotation$/)
  const undeleteMatch = path.match(/^\/v1\/secrets\/(.+)\/undelete$/)
  const destroyMatch = path.match(/^\/v1\/secrets\/(.+)\/destroy$/)
  const versionsListMatch = path.match(/^\/v1\/secrets\/(.+)\/versions$/)

  // POST /v1/secrets/:name/rotate
  if (rotateMatch && method === 'POST') {
    const name = decodeURIComponent(rotateMatch[1])
    if (!checkAllowed(ctx.rules, name, 'rotate')) return errorResponse('Token cannot rotate this secret', 403, 'FORBIDDEN')
    const secret = await findSecret(supabase, ctx.ownerId, name)
    if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

    let newValue: string
    if (body?.value != null && String(body.value).trim() !== '') {
      newValue = String(body.value)
    } else {
      newValue = base64UrlEncode(randomBytes(32))
    }

    // fresh DEK for rotated version (key rotation on rotation)
    const freshKeyId = `dek-${secret.id}-v${Date.now().toString(36)}`
    await createVersion(supabase, ctx, masterKey, secret, newValue, { detail: 'rotated', keyId: freshKeyId })

    const now = new Date()
    const { data: rc } = await supabase.from('rotation_config').select('*').eq('secret_id', secret.id).maybeSingle()
    const intervalDays = rc?.interval_days ?? 30
    await supabase.from('rotation_config').upsert({
      secret_id: secret.id,
      enabled: rc?.enabled ?? false,
      interval_days: intervalDays,
      last_rotated_at: now.toISOString(),
      next_rotation_at: new Date(now.getTime() + intervalDays * 86400_000).toISOString(),
      source: body?.value != null ? 'user_provided' : 'auto_generated',
      updated_at: now.toISOString(),
    })

    await appendAudit(supabase, masterKey, {
      action: 'secret.rotated', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, success: true,
      detail: body?.value != null ? 'rotation with user-provided value' : 'rotation with auto-generated value',
    })

    return jsonResponse({ success: true, rotated: true, source: body?.value != null ? 'user_provided' : 'auto_generated' })
  }

  // GET/POST /v1/secrets/:name/rotation
  if (rotationMatch) {
    const name = decodeURIComponent(rotationMatch[1])
    const secret = await findSecret(supabase, ctx.ownerId, name)
    if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

    if (method === 'GET') {
      if (!checkAllowed(ctx.rules, name, 'rotate')) return errorResponse('Token cannot view rotation config', 403, 'FORBIDDEN')
      const { data: rc } = await supabase.from('rotation_config').select('*').eq('secret_id', secret.id).maybeSingle()
      return jsonResponse({
        success: true,
        rotation: {
          enabled: rc?.enabled ?? false,
          interval_days: rc?.interval_days ?? 30,
          last_rotated_at: rc?.last_rotated_at ?? null,
          next_rotation_at: rc?.next_rotation_at ?? null,
          source: rc?.source ?? 'auto_generated',
        },
      })
    }

    if (method === 'POST') {
      if (!checkAllowed(ctx.rules, name, 'rotate')) return errorResponse('Token cannot configure rotation', 403, 'FORBIDDEN')
      const enabled = body?.enabled === true
      let intervalDays = Number(body?.interval_days ?? 30)
      if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
        return errorResponse('interval_days must be 1..3650', 400, 'INVALID_INTERVAL')
      }
      intervalDays = Math.floor(intervalDays)

      const now = new Date()
      const { data: rc } = await supabase.from('rotation_config').select('*').eq('secret_id', secret.id).maybeSingle()
      const next = rc?.next_rotation_at ? new Date(rc.next_rotation_at) : now
      const nextRotationAt = !enabled ? null : (rc?.next_rotation_at ? new Date(rc.next_rotation_at) : new Date(now.getTime() + intervalDays * 86400_000))

      await supabase.from('rotation_config').upsert({
        secret_id: secret.id,
        enabled,
        interval_days: intervalDays,
        last_rotated_at: rc?.last_rotated_at ?? null,
        next_rotation_at: enabled ? nextRotationAt.toISOString() : null,
        source: rc?.source ?? 'auto_generated',
        updated_at: now.toISOString(),
      })

      await appendAudit(supabase, masterKey, {
        action: 'rotation.configured', actor_type: 'token', actor_id: ctx.tokenId,
        path: name, success: true, detail: `enabled=${enabled} interval=${intervalDays}d`,
      })
      return jsonResponse({ success: true, rotation: { enabled, interval_days: intervalDays } })
    }
  }

  // POST /v1/secrets/:name/undelete
  if (undeleteMatch && method === 'POST') {
    const name = decodeURIComponent(undeleteMatch[1])
    if (!checkAllowed(ctx.rules, name, 'write')) return errorResponse('Token cannot restore this secret', 403, 'FORBIDDEN')
    const secret = await findSecret(supabase, ctx.ownerId, name)
    if (!secret || !secret.deleted_at) return errorResponse('Secret not found or not deleted', 404, 'NOT_FOUND')

    const { data: updated, error } = await supabase
      .from('secrets')
      .update({ deleted_at: null, delete_after: null, updated_at: new Date().toISOString() })
      .eq('id', secret.id)
      .select('id, name, deleted_at, delete_after')
      .single()
    if (error) return errorResponse('Failed to restore secret', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'secret.undeleted', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, success: true,
    })
    return jsonResponse({ success: true, secret: updated })
  }

  // POST /v1/secrets/:name/destroy — permanent
  if (destroyMatch && method === 'POST') {
    const name = decodeURIComponent(destroyMatch[1])
    if (!checkAllowed(ctx.rules, name, 'destroy')) return errorResponse('Token requires the destroy capability', 403, 'FORBIDDEN')
    const secret = await findSecret(supabase, ctx.ownerId, name)
    if (!secret) return errorResponse('Secret not found', 404, 'NOT_FOUND')

    const { error } = await supabase.from('secrets').delete().eq('id', secret.id).eq('owner_id', ctx.ownerId)
    if (error) return errorResponse('Failed to destroy secret', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'secret.destroyed', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, success: true, detail: 'permanent destruction',
    })
    return jsonResponse({ success: true, destroyed: true })
  }

  // GET /v1/secrets/:name/versions
  if (versionsListMatch && method === 'GET') {
    const name = decodeURIComponent(versionsListMatch[1])
    if (!checkAllowed(ctx.rules, name, 'versions') && !checkAllowed(ctx.rules, name, 'read')) {
      return errorResponse('Token cannot list versions for this secret', 403, 'FORBIDDEN')
    }
    const secret = await findSecret(supabase, ctx.ownerId, name)
    if (!secret) return errorResponse('Secret not found', 404, 'NOT_FOUND')

    const { data: versions } = await supabase
      .from('secret_versions')
      .select('version_number, state, created_by, created_at, destroyed_at, key_id')
      .eq('secret_id', secret.id)
      .order('version_number', { ascending: false })
    return jsonResponse({ success: true, secret_name: name, versions: versions || [] })
  }

  // GET /v1/secrets/:name — read value
  // DELETE /v1/secrets/:name — soft delete
  // POST /v1/secrets/:name — update (new version) or metadata patch
  const secretMatch = path.match(/^\/v1\/secrets\/(.+)$/)
  if (secretMatch) {
    const name = decodeURIComponent(secretMatch[1])

    // GET value
    if (method === 'GET') {
      if (!checkAllowed(ctx.rules, name, 'read')) return errorResponse('Token cannot read this secret', 403, 'FORBIDDEN')
      const secret = await findSecret(supabase, ctx.ownerId, name)
      if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

      // lazy rotation: if due, rotate before serving
      const { data: rc } = await supabase.from('rotation_config').select('*').eq('secret_id', secret.id).maybeSingle()
      if (rc?.enabled && rc.next_rotation_at && new Date(rc.next_rotation_at) <= new Date()) {
        const freshKeyId = `dek-${secret.id}-v${Date.now().toString(36)}`
        const newValue = base64UrlEncode(randomBytes(32))
        await createVersion(supabase, ctx, masterKey, secret, newValue, { detail: 'lazy scheduled rotation', keyId: freshKeyId })
        const now = new Date()
        await supabase.from('rotation_config').update({
          last_rotated_at: now.toISOString(),
          next_rotation_at: new Date(now.getTime() + (rc.interval_days || 30) * 86400_000).toISOString(),
          updated_at: now.toISOString(),
        }).eq('secret_id', secret.id)
      }

      const versionParam = query.get('version')
      let version: any = null
      if (versionParam) {
        const v = Number(versionParam)
        if (!Number.isInteger(v) || v < 1) return errorResponse('Invalid version parameter', 400, 'INVALID_VERSION')
        const { data: vData } = await supabase
          .from('secret_versions')
          .select('*')
          .eq('secret_id', secret.id)
          .eq('version_number', v)
          .maybeSingle()
        version = vData
      } else {
        version = await getLatestVersion(supabase, secret.id)
      }

      if (!version || version.state !== 'ENABLED') {
        return errorResponse('Requested version is not enabled or does not exist', 404, 'VERSION_UNAVAILABLE')
      }

      let value: string
      try {
        value = await decryptVersion(supabase, masterKey, ctx.ownerId, version)
      } catch (e: any) {
        return errorResponse(e.message || 'Failed to decrypt secret', 500, 'DECRYPT_FAILED')
      }

      await appendAudit(supabase, masterKey, {
        action: 'secret.read', actor_type: 'token', actor_id: ctx.tokenId,
        path: name, version_number: version.version_number, success: true,
      })

      return jsonResponse({
        success: true,
        name,
        value,
        version: version.version_number,
        created_at: version.created_at,
        secret_type: secret.secret_type,
      })
    }

    // DELETE soft
    if (method === 'DELETE') {
      if (!checkAllowed(ctx.rules, name, 'delete')) return errorResponse('Token cannot delete this secret', 403, 'FORBIDDEN')
      const secret = await findSecret(supabase, ctx.ownerId, name)
      if (!secret) return errorResponse('Secret not found', 404, 'NOT_FOUND')
      if (secret.deleted_at) return errorResponse('Secret is already deleted', 409, 'ALREADY_DELETED')

      const window = secret.recovery_window_days ?? 7
      const now = new Date()
      const deleteAfter = window > 0 ? new Date(now.getTime() + window * 86400_000) : now

      await supabase
        .from('secrets')
        .update({ deleted_at: now.toISOString(), delete_after: deleteAfter.toISOString(), updated_at: now.toISOString() })
        .eq('id', secret.id)

      await appendAudit(supabase, masterKey, {
        action: 'secret.deleted', actor_type: 'token', actor_id: ctx.tokenId,
        path: name, success: true, detail: `recovery window ${window}d, purge at ${deleteAfter.toISOString()}`,
      })
      return jsonResponse({ success: true, deleted_at: now.toISOString(), delete_after: deleteAfter.toISOString() })
    }

    // POST update
    if (method === 'POST') {
      if (!checkAllowed(ctx.rules, name, 'write')) return errorResponse('Token cannot update this secret', 403, 'FORBIDDEN')
      const secret = await findSecret(supabase, ctx.ownerId, name)
      if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

      const hasValue = body?.value !== undefined && body?.value !== null && String(body.value).trim() !== ''
      const hasMeta = body?.description !== undefined || body?.labels !== undefined

      if (!hasValue && !hasMeta) {
        return errorResponse('Provide a value to create a new version, or description/labels to update metadata', 400, 'INVALID_BODY')
      }

      if (hasMeta) {
        const labels = validateLabels(body?.labels)
        if (labels === null) return errorResponse('labels must be an object of string values', 400, 'INVALID_LABELS')
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (body?.description !== undefined) patch.description = String(body.description).slice(0, 2000)
        if (body?.labels !== undefined) patch.labels = labels
        await supabase.from('secrets').update(patch).eq('id', secret.id)
        await appendAudit(supabase, masterKey, {
          action: 'secret.metadata_updated', actor_type: 'token', actor_id: ctx.tokenId,
          path: name, success: true,
        })
      }

      if (hasValue) {
        await createVersion(supabase, ctx, masterKey, secret, String(body.value), { detail: 'new value' })
      }

      return jsonResponse({ success: true, version_created: hasValue })
    }
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// VERSIONS (per-version operations)
// ------------------------------------------------------------
export async function handleVersionsAPI(supabase: any, ctx: AuthContext, method: string, path: string, body: any): Promise<Response> {
  const masterKey = await getMasterKey()
  const match = path.match(/^\/v1\/secrets\/(.+)\/versions\/(\d+)\/(restore|disable|enable|destroy)$/)
  if (!match) return errorResponse('Endpoint not found', 404, 'NOT_FOUND')

  const name = decodeURIComponent(match[1])
  const versionNumber = Number(match[2])
  const op = match[3]

  const requiredCap = op === 'restore' ? 'versions' : op === 'destroy' ? 'destroy' : 'versions'
  if (!checkAllowed(ctx.rules, name, requiredCap)) {
    return errorResponse(`Token requires the ${requiredCap} capability for this secret`, 403, 'FORBIDDEN')
  }

  const secret = await findSecret(supabase, ctx.ownerId, name)
  if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

  const { data: version } = await supabase
    .from('secret_versions')
    .select('*')
    .eq('secret_id', secret.id)
    .eq('version_number', versionNumber)
    .maybeSingle()

  if (!version) return errorResponse('Version not found', 404, 'NOT_FOUND')

  if (op === 'restore') {
    if (version.state === 'DESTROYED') return errorResponse('Cannot restore a destroyed version', 409, 'DESTROYED')
    let value: string
    try {
      value = await decryptVersion(supabase, masterKey, ctx.ownerId, version)
    } catch (e: any) {
      return errorResponse(e.message || 'Failed to decrypt version', 500, 'DECRYPT_FAILED')
    }
    await createVersion(supabase, ctx, masterKey, secret, value, { detail: `restored from version ${versionNumber}` })
    return jsonResponse({ success: true, restored: true, from_version: versionNumber })
  }

  if (op === 'disable') {
    if (version.state === 'DESTROYED') return errorResponse('Cannot disable a destroyed version', 409, 'DESTROYED')
    await supabase.from('secret_versions').update({ state: 'DISABLED' }).eq('id', version.id)
    await appendAudit(supabase, masterKey, {
      action: 'version.disabled', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, version_number: versionNumber, success: true,
    })
    return jsonResponse({ success: true, version_number: versionNumber, state: 'DISABLED' })
  }

  if (op === 'enable') {
    await supabase.from('secret_versions').update({ state: 'ENABLED' }).eq('id', version.id)
    await appendAudit(supabase, masterKey, {
      action: 'version.enabled', actor_type: 'token', actor_id: ctx.tokenId,
      path: name, version_number: versionNumber, success: true,
    })
    return jsonResponse({ success: true, version_number: versionNumber, state: 'ENABLED' })
  }

  // destroy
  await supabase.from('secret_versions').update({
    state: 'DESTROYED',
    destroyed_at: new Date().toISOString(),
    encrypted_value: '',
    iv: '',
  }).eq('id', version.id)
  await appendAudit(supabase, masterKey, {
    action: 'version.destroyed', actor_type: 'token', actor_id: ctx.tokenId,
    path: name, version_number: versionNumber, success: true,
  })
  return jsonResponse({ success: true, version_number: versionNumber, state: 'DESTROYED' })
}

// ------------------------------------------------------------
// VEILREF v2 (single-use, TTL, device-bound, version-aware)
// ------------------------------------------------------------
function veilRefCanonical(ref: Record<string, unknown>): string {
  return [
    ref.ref_id, ref.secret_name, ref.version_number ?? '', ref.device_bound,
    new Date(ref.issued_at as string).getTime(),
    new Date(ref.expires_at as string).getTime(),
    ref.use_count_max,
    (ref.ops_allowed as string[]).join(','),
  ].join('|')
}

export async function handleVeilRefAPI(supabase: any, ctx: AuthContext, method: string, path: string, body: any, req: Request): Promise<Response> {
  const masterKey = await getMasterKey()

  // POST /v1/veilref — issue
  if (method === 'POST' && path === '/v1/veilref') {
    const secretName = (body?.secret_name as string || '').trim()
    if (!checkAllowed(ctx.rules, secretName, 'read')) return errorResponse('Token cannot create references for this secret', 403, 'FORBIDDEN')

    const secret = await findSecret(supabase, ctx.ownerId, secretName)
    if (!secret || secret.deleted_at) return errorResponse('Secret not found', 404, 'NOT_FOUND')

    const opsAllowed = Array.isArray(body?.ops_allowed)
      ? body.ops_allowed.filter((o: unknown) => ['resolve', 'verify'].includes(String(o)))
      : ['resolve']
    if (opsAllowed.length === 0) return errorResponse('ops_allowed must include resolve or verify', 400, 'INVALID_OPS')

    let ttl = Number(body?.ref_ttl ?? 60)
    if (!Number.isFinite(ttl) || ttl < 5 || ttl > 86400) return errorResponse('ref_ttl must be 5..86400 seconds', 400, 'INVALID_TTL')
    ttl = Math.floor(ttl)

    let maxUses = Number(body?.max_uses ?? 1)
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 1000) return errorResponse('max_uses must be 1..1000', 400, 'INVALID_USES')
    maxUses = Math.floor(maxUses)

    let versionNumber: number | null = null
    if (body?.version != null) {
      const v = Number(body.version)
      if (!Number.isInteger(v) || v < 1) return errorResponse('Invalid version', 400, 'INVALID_VERSION')
      const { data: vData } = await supabase
        .from('secret_versions')
        .select('version_number, state')
        .eq('secret_id', secret.id)
        .eq('version_number', v)
        .maybeSingle()
      if (!vData || vData.state !== 'ENABLED') return errorResponse('Requested version is not enabled', 404, 'VERSION_UNAVAILABLE')
      versionNumber = v
    } else {
      const latest = await getLatestVersion(supabase, secret.id)
      if (!latest) return errorResponse('Secret has no enabled versions', 404, 'NO_VERSION')
      versionNumber = latest.version_number
    }

    const deviceFingerprint = (body?.device_fingerprint as string || req.headers.get('x-squidveil-device') || '').trim()
    const deviceBound = deviceFingerprint ? await sha256Hex(new Uint8Array([...masterKey, ...new TextEncoder().encode(':' + deviceFingerprint)])) : ''

    const now = new Date()
    const refId = toHex(randomBytes(8))
    const ref: Record<string, unknown> = {
      ref_id: refId,
      secret_name: secretName,
      version_number: versionNumber,
      device_bound: deviceBound,
      issued_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttl * 1000).toISOString(),
      use_count_max: maxUses,
      use_count_used: 0,
      ops_allowed: opsAllowed,
    }
    ref.hmac = await hmacSha256Hex(masterKey, veilRefCanonical(ref))

    const { error } = await supabase.from('veilrefs').insert({
      ref_id: refId,
      owner_id: ctx.ownerId,
      secret_id: secret.id,
      secret_name: secretName,
      version_number: versionNumber,
      device_bound: deviceBound,
      issued_at: ref.issued_at as string,
      expires_at: ref.expires_at as string,
      use_count_max: maxUses,
      use_count_used: 0,
      ops_allowed: opsAllowed,
      hmac: ref.hmac as string,
    })
    if (error) return errorResponse('Failed to issue VeilRef', 500, 'DB_ERROR')

    await appendAudit(supabase, masterKey, {
      action: 'veilref.issued', actor_type: 'token', actor_id: ctx.tokenId,
      path: secretName, version_number: versionNumber as number, success: true,
      detail: `ttl=${ttl}s uses=${maxUses}`,
    })

    return jsonResponse({ success: true, veil_ref_json: JSON.stringify(ref), ref_id: refId }, 201)
  }

  // POST /v1/veilref/verify and /resolve
  if (method === 'POST' && (path === '/v1/veilref/verify' || path === '/v1/veilref/resolve')) {
    let ref: Record<string, unknown>
    try {
      ref = JSON.parse(String(body?.veil_ref_json || '{}'))
    } catch {
      return errorResponse('Invalid VeilRef JSON', 400, 'INVALID_JSON')
    }

    const refId = String(ref.ref_id || '')
    if (!refId) return errorResponse('VeilRef missing ref_id', 400, 'INVALID_JSON')

    const { data: stored } = await supabase
      .from('veilrefs')
      .select('*')
      .eq('ref_id', refId)
      .maybeSingle()

    const fail = (msg: string, code: string, status = 401): Response => {
      appendAudit(supabase, masterKey, {
        action: 'veilref.' + (path.endsWith('/resolve') ? 'resolve' : 'verify') + '_rejected',
        actor_type: 'token', actor_id: ctx.tokenId,
        path: String(ref.secret_name || ''), success: false, detail: msg,
      })
      return errorResponse(msg, status, code)
    }

    if (!stored) return fail('VeilRef not found', 'NOT_FOUND', 404)
    if (new Date(stored.expires_at) <= new Date()) return fail('VeilRef expired', 'EXPIRED')
    if (stored.use_count_used >= stored.use_count_max) return fail('VeilRef consumed (max uses reached)', 'CONSUMED')
    if (stored.consumed_at) return fail('VeilRef consumed', 'CONSUMED')

    // HMAC integrity
    const expectedHmac = await hmacSha256Hex(masterKey, veilRefCanonical({
      ref_id: stored.ref_id, secret_name: stored.secret_name,
      version_number: stored.version_number, device_bound: stored.device_bound,
      issued_at: stored.issued_at, expires_at: stored.expires_at,
      use_count_max: stored.use_count_max,
      ops_allowed: stored.ops_allowed,
    }))
    if (!constantTimeEqual(stored.hmac, expectedHmac)) return fail('VeilRef signature invalid', 'BAD_SIGNATURE')

    const op = path.endsWith('/resolve') ? 'resolve' : 'verify'
    if (!(stored.ops_allowed as string[]).includes(op)) return fail('Operation not allowed for this VeilRef', 'OP_NOT_ALLOWED')

    const deviceHeader = (req.headers.get('x-squidveil-device') || '').trim()
    if (stored.device_bound && deviceHeader) {
      const deviceHash = await sha256Hex(new Uint8Array([...masterKey, ...new TextEncoder().encode(':' + deviceHeader)]))
      if (!constantTimeEqual(stored.device_bound, deviceHash)) return fail('VeilRef device mismatch', 'DEVICE_MISMATCH')
    }

    // atomic consume
    const isLastUse = stored.use_count_used + 1 >= stored.use_count_max
    const { data: consumed } = await supabase
      .from('veilrefs')
      .update({
        use_count_used: stored.use_count_used + 1,
        consumed_at: isLastUse ? new Date().toISOString() : null,
      })
      .eq('ref_id', refId)
      .eq('use_count_used', stored.use_count_used)
      .is('consumed_at', null)
      .select('use_count_used, consumed_at')
      .maybeSingle()

    if (!consumed) return fail('VeilRef was consumed concurrently', 'CONCURRENT_CONSUME', 409)

    if (op === 'verify') {
      await appendAudit(supabase, masterKey, {
        action: 'veilref.verified', actor_type: 'token', actor_id: ctx.tokenId,
        path: stored.secret_name, version_number: stored.version_number as number, success: true,
      })
      return jsonResponse({ success: true, verified: true, secret_name: stored.secret_name, version_number: stored.version_number })
    }

    // resolve
    const secret = await findSecret(supabase, ctx.ownerId, stored.secret_name)
    if (!secret || secret.deleted_at) return fail('Secret no longer exists', 'SECRET_GONE', 404)

    const { data: version } = await supabase
      .from('secret_versions')
      .select('*')
      .eq('secret_id', secret.id)
      .eq('version_number', stored.version_number)
      .maybeSingle()

    if (!version || version.state !== 'ENABLED') return fail('Version unavailable', 'VERSION_UNAVAILABLE', 409)

    let value: string
    try {
      value = await decryptVersion(supabase, masterKey, ctx.ownerId, version)
    } catch (e: any) {
      return fail(e.message || 'Decryption failed', 'DECRYPT_FAILED', 500)
    }

    await appendAudit(supabase, masterKey, {
      action: 'veilref.resolved', actor_type: 'token', actor_id: ctx.tokenId,
      path: stored.secret_name, version_number: stored.version_number as number, success: true,
    })

    return jsonResponse({
      success: true,
      value,
      secret_name: stored.secret_name,
      version_number: stored.version_number,
    })
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// AUDIT
// ------------------------------------------------------------
export async function handleAuditAPI(supabase: any, ctx: AuthContext, method: string, path: string, query: URLSearchParams): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'audit')) {
    return errorResponse('Token requires the audit capability', 403, 'FORBIDDEN')
  }

  const masterKey = await getMasterKey()

  if (method === 'GET' && path === '/v1/audit') {
    let q = supabase
      .from('audit_log')
      .select('seq, action, actor_type, actor_id, path, version_number, ip, success, detail, created_at')
      .eq('actor_id', ctx.ownerId)

    // scope: token actors in this query should map to this owner's tokens — audit_log stores token ids
    const action = query.get('action')
    const pathFilter = query.get('path')
    const actor = query.get('actor')
    const from = query.get('from')
    const to = query.get('to')
    const limit = parseLimit(query.get('limit'), 50)
    const offset = parseOffset(query.get('offset'))

    if (action) q = q.eq('action', action)
    if (pathFilter) q = q.ilike('path', `%${pathFilter}%`)
    if (actor) q = q.eq('actor_id', actor)
    if (from) q = q.gte('created_at', new Date(from).toISOString())
    if (to) q = q.lte('created_at', new Date(to).toISOString())

    const { data: entries } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    return jsonResponse({ success: true, audit: entries || [], limit, offset })
  }

  if (method === 'GET' && path === '/v1/audit/verify') {
    const result = await verifyAuditChain(supabase)
    return jsonResponse({ success: true, ...result })
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// KEYS (DEK rewrap / compliance key rotation)
// ------------------------------------------------------------
export async function handleKeysAPI(supabase: any, ctx: AuthContext, method: string, path: string): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'write')) {
    return errorResponse('Token cannot perform key operations', 403, 'FORBIDDEN')
  }
  const masterKey = await getMasterKey()

  if (method === 'POST' && path === '/v1/keys/rotate') {
    const { data: keys } = await supabase
      .from('secret_keys')
      .select('id, key_id, wrapped_dek, iv, active')
      .eq('owner_id', ctx.ownerId)
      .eq('active', true)

    let rewrapped = 0
    for (const key of keys || []) {
      if (!key.wrapped_dek || !key.iv) continue // client-side BYOK rows
      try {
        const dek = await aes256GcmDecrypt(key.wrapped_dek, key.iv, masterKey)
        const { ciphertext, iv } = await aes256GcmEncrypt(dek, masterKey)
        await supabase
          .from('secret_keys')
          .update({ wrapped_dek: ciphertext, iv })
          .eq('id', key.id)
        rewrapped++
      } catch {
        // skip unwrappable rows
      }
    }

    await appendAudit(supabase, masterKey, {
      action: 'keys.rewrapped', actor_type: 'token', actor_id: ctx.tokenId,
      path: '*', success: true, detail: `${rewrapped} DEK(s) re-wrapped`,
    })
    return jsonResponse({ success: true, rewrapped })
  }

  return errorResponse('Endpoint not found', 404, 'NOT_FOUND')
}

// ------------------------------------------------------------
// STATS (usage tracking — which secrets are read, by whom/when)
// ------------------------------------------------------------
export async function handleStatsAPI(supabase: any, ctx: AuthContext, query: URLSearchParams): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'audit')) {
    return errorResponse('Token requires the audit capability', 403, 'FORBIDDEN')
  }

  const days = Math.min(Math.max(Number(query.get('days') ?? 30) || 30, 1), 365)
  const top = Math.min(Math.max(Number(query.get('top') ?? 10) || 10, 1), 50)
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString()

  const { data: rows } = await supabase
    .from('audit_log')
    .select('seq, action, actor_id, path, version_number, success, created_at')
    .eq('actor_id', ctx.ownerId)
    .gte('created_at', cutoff)

  const list = rows || []
  const readsBySecret = new Map<string, number>()
  const writesBySecret = new Map<string, number>()
  const readsByToken = new Map<string, number>()
  const byDay = new Map<string, { reads: number; writes: number; veilrefs: number; rotations: number }>()

  let reads = 0
  let writes = 0
  let veilrefsIssued = 0
  let veilrefsResolved = 0
  let veilrefsVerified = 0
  let rotations = 0
  let failedAuth = 0

  const bumpDay = (day: string, key: keyof { reads: number; writes: number; veilrefs: number; rotations: number }, n = 1) => {
    const cur = byDay.get(day) ?? { reads: 0, writes: 0, veilrefs: 0, rotations: 0 }
    cur[key] = (cur[key] ?? 0) + n
    byDay.set(day, cur)
  }

  for (const r of list) {
    const day = (r.created_at as string || '').slice(0, 10)
    switch (r.action) {
      case 'secret.read':
        reads++
        readsBySecret.set(r.path, (readsBySecret.get(r.path) ?? 0) + 1)
        readsByToken.set(r.actor_id, (readsByToken.get(r.actor_id) ?? 0) + 1)
        bumpDay(day, 'reads')
        break
      case 'secret.created':
      case 'secret.version_created':
        writes++
        writesBySecret.set(r.path, (writesBySecret.get(r.path) ?? 0) + 1)
        bumpDay(day, 'writes')
        break
      case 'veilref.issued':
        veilrefsIssued++
        bumpDay(day, 'veilrefs')
        break
      case 'veilref.resolved':
        veilrefsResolved++
        bumpDay(day, 'veilrefs')
        break
      case 'veilref.verified':
        veilrefsVerified++
        bumpDay(day, 'veilrefs')
        break
      case 'secret.rotated':
      case 'secret.rotated_scheduled':
        rotations++
        bumpDay(day, 'rotations')
        break
      case 'auth.failed':
        failedAuth++
        break
    }
  }

  const { data: tokens } = await supabase
    .from('access_tokens')
    .select('id, name, token_prefix')
    .eq('owner_id', ctx.ownerId)
  const tokenNames = new Map((tokens || []).map((t: any) => [t.id, t.name]))

  const topSecrets = [...readsBySecret.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
  const topWrites = [...writesBySecret.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
  const readsByTokenList = [...readsByToken.entries()]
    .map(([id, count]) => ({ token_id: id, token_name: tokenNames.get(id) || 'unknown', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)

  // fill empty days so charts are continuous
  const activity: { day: string; reads: number; writes: number; veilrefs: number; rotations: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    activity.push({ day: d, ...(byDay.get(d) ?? { reads: 0, writes: 0, veilrefs: 0, rotations: 0 }) })
  }

  return jsonResponse({
    success: true,
    days,
    totals: { reads, writes, veilrefs_issued: veilrefsIssued, veilrefs_resolved: veilrefsResolved, veilrefs_verified: veilrefsVerified, rotations, failed_auth: failedAuth },
    top_secrets: topSecrets,
    top_writes: topWrites,
    reads_by_token: readsByTokenList,
    activity,
  })
}

// ------------------------------------------------------------
// MONITOR (system health, security posture, recent events)
// ------------------------------------------------------------
export async function handleMonitorAPI(supabase: any, ctx: AuthContext): Promise<Response> {
  if (!checkAllowed(ctx.rules, '*', 'audit')) {
    return errorResponse('Token requires the audit capability', 403, 'FORBIDDEN')
  }

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 86400_000).toISOString()
  const auditStatus = await verifyAuditChain(supabase)

  const { data: tokens } = await supabase
    .from('access_tokens')
    .select('id, name, token_prefix, revoked_at, expires_at, last_used_at')
    .eq('owner_id', ctx.ownerId)
  const t = tokens || []
  const active = t.filter((x: any) => !x.revoked_at && (!x.expires_at || new Date(x.expires_at) > now)).length
  const revoked = t.filter((x: any) => x.revoked_at).length
  const expired = t.filter((x: any) => !x.revoked_at && x.expires_at && new Date(x.expires_at) <= now).length

  const { data: secrets } = await supabase
    .from('secrets')
    .select('id, name, deleted_at, delete_after')
    .eq('owner_id', ctx.ownerId)
  const s = secrets || []
  const totalSecrets = s.filter((x: any) => !x.deleted_at).length
  const pendingPurge = s
    .filter((x: any) => x.deleted_at && x.delete_after)
    .map((x: any) => ({ name: x.name, purge_at: x.delete_after }))

  const { data: rotConfigs } = await supabase
    .from('rotation_config')
    .select('secret_id, enabled, next_rotation_at')
  const nameById = new Map(s.filter((x: any) => !x.deleted_at).map((x: any) => [x.id, x.name]))
  const rotationEnabled = (rotConfigs || []).filter((r: any) => r.enabled)
  const rotationDue = rotationEnabled
    .filter((r: any) => r.next_rotation_at && new Date(r.next_rotation_at) <= now)
    .map((r: any) => ({ secret_name: nameById.get(r.secret_id) || r.secret_id, next_rotation_at: r.next_rotation_at }))

  const { data: recentAudit } = await supabase
    .from('audit_log')
    .select('action, created_at')
    .eq('actor_id', ctx.ownerId)
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: false })
    .limit(500)
  const events = recentAudit || []
  const reads24h = events.filter((e: any) => e.action === 'secret.read').length
  const writes24h = events.filter((e: any) => ['secret.created', 'secret.version_created'].includes(e.action)).length
  const veilrefs24h = events.filter((e: any) => e.action.startsWith('veilref.')).length
  const rotations24h = events.filter((e: any) => ['secret.rotated', 'secret.rotated_scheduled'].includes(e.action)).length

  const { count: failedAuth24hCount } = await supabase
    .from('audit_log')
    .select('seq', { count: 'exact', head: true })
    .eq('action', 'auth.failed')
    .gte('created_at', dayAgo)

  const { data: failedRows } = await supabase
    .from('audit_log')
    .select('seq, action, detail, path, ip, user_agent, created_at')
    .eq('action', 'auth.failed')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: recentEvents } = await supabase
    .from('audit_log')
    .select('seq, action, path, success, ip, created_at')
    .eq('actor_id', ctx.ownerId)
    .order('created_at', { ascending: false })
    .limit(25)

  return jsonResponse({
    success: true,
    generated_at: now.toISOString(),
    audit: auditStatus,
    tokens: { total: t.length, active, revoked, expired },
    secrets: { total: totalSecrets, pending_purge: pendingPurge, rotation_enabled: rotationEnabled.length, rotation_due: rotationDue },
    activity_24h: { reads: reads24h, writes: writes24h, veilrefs: veilrefs24h, rotations: rotations24h, failed_auth: failedAuth24hCount ?? 0 },
    recent_failed_auth: failedRows || [],
    recent_events: recentEvents || [],
  })
}

// ------------------------------------------------------------
// ROTATE DUE (internal cron endpoint)
// ------------------------------------------------------------
export async function handleRotateDue(supabase: any, req: Request): Promise<Response> {
  const tokenHeader = req.headers.get('x-squidveil-cron-token') || ''
  const { data: cfg } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'internal_cron_token')
    .maybeSingle()
  if (!cfg || !constantTimeEqual(cfg.value, tokenHeader)) {
    return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
  }

  const masterKey = await getMasterKey()
  const now = new Date()

  const { data: due } = await supabase
    .from('rotation_config')
    .select('*')
    .eq('enabled', true)
    .lte('next_rotation_at', now.toISOString())
    .limit(50)

  let rotated = 0
  for (const rc of due || []) {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', rc.secret_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!secret) continue

    const freshKeyId = `dek-${secret.id}-v${Date.now().toString(36)}`
    const newValue = base64UrlEncode(randomBytes(32))
    const keyId = await ensureDek(supabase, masterKey, secret.owner_id, secret.id, freshKeyId)
    const dek = await getSecretDek(supabase, masterKey, secret.owner_id, keyId)
    if (!dek) {
      void sendSignal({
        service_id: 'squidveil',
        user_id: secret.owner_id,
        type: 'rotation_failed',
        severity: 'urgent',
        title: `Rotation failed for '${secret.name}'`,
        body: 'Scheduled auto-rotation could not complete. Investigate before the secret expires.',
        link: '/dashboard',
        idempotency_key: `rotation_failed:${secret.id}:${now.toISOString().slice(0, 10)}`,
      })
      continue
    }
    const { ciphertext, iv } = await aes256GcmEncrypt(new TextEncoder().encode(newValue), dek)

    const { data: nRow } = await supabase
      .from('secret_versions')
      .select('version_number')
      .eq('secret_id', secret.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('secret_versions').insert({
      secret_id: secret.id,
      version_number: (nRow?.version_number ?? 0) + 1,
      encrypted_value: ciphertext,
      iv,
      key_id: keyId,
      state: 'ENABLED',
      created_by: 'scheduled-rotation',
    })

    const nextAt = new Date(now.getTime() + (rc.interval_days || 30) * 86400_000)
    await supabase
      .from('rotation_config')
      .update({
        last_rotated_at: now.toISOString(),
        next_rotation_at: nextAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('secret_id', secret.id)

    await appendAudit(supabase, masterKey, {
      action: 'secret.rotated_scheduled', actor_type: 'system', actor_id: 'cron',
      path: secret.name, success: true, detail: 'scheduled auto-rotation',
    })
    rotated++
  }

  const { data: purgeResult } = await supabase.rpc('purge_expired')
  const purged = purgeResult ?? 0

  return jsonResponse({ success: true, rotated, purged })
}
