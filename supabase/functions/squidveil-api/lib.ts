// ============================================================
// squidveil-api — shared lib (crypto, auth, audit, policy eval)
// Standalone secrets manager — zero dependency on cloudbliss-api.
// ============================================================

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SquidVeil-Token, X-SquidVeil-Device, X-SquidVeil-Signature, X-SquidVeil-Cron-Token',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export function errorResponse(message: string, status = 400, code = 'ERROR'): Response {
  return jsonResponse({ error: message, code, success: false }, status)
}

// ------------------------------------------------------------
// WebCrypto helpers
// ------------------------------------------------------------
const encoder = new TextEncoder()

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? encoder.encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Hex(key: Uint8Array, data: Uint8Array | string): Promise<string> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const input = typeof data === 'string' ? encoder.encode(data) : data
  const sig = await crypto.subtle.sign('HMAC', keyObj, input)
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function aes256GcmEncrypt(plaintext: Uint8Array, key: Uint8Array): Promise<{ ciphertext: string; iv: string }> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, plaintext)
  return { ciphertext: base64Encode(new Uint8Array(ct)), iv: base64Encode(iv) }
}

export async function aes256GcmDecrypt(ciphertextB64: string, ivB64: string, key: Uint8Array): Promise<Uint8Array> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt'])
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64Decode(ivB64) },
    keyObj,
    base64Decode(ciphertextB64),
  )
  return new Uint8Array(pt)
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ------------------------------------------------------------
// Master key: SQUIDVEIL_MASTER_KEY env (64 hex) or derived
// ------------------------------------------------------------
export async function getMasterKey(): Promise<Uint8Array> {
  const env = Deno.env.get('SQUIDVEIL_MASTER_KEY')
  if (env && /^[0-9a-f]{64}$/i.test(env)) return fromHex(env)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'squidveil'
  return fromHex(await sha256Hex('squidveil-master-v1:' + serviceKey))
}

export async function getAuditKey(): Promise<Uint8Array> {
  const master = await getMasterKey()
  return fromHex(await hmacSha256Hex(master, 'squidveil-audit-v1'))
}

// ------------------------------------------------------------
// Access tokens
// ------------------------------------------------------------
export function generateAccessToken(): string {
  return 'sv_' + base64UrlEncode(randomBytes(32))
}

export async function hashAccessToken(masterKey: Uint8Array, token: string): Promise<string> {
  return sha256Hex(new Uint8Array([...masterKey, ...encoder.encode(':' + token)]))
}

// ------------------------------------------------------------
// Policy engine (Vault-style: path globs, deny wins)
// ------------------------------------------------------------
export const CAPABILITIES = [
  'read', 'write', 'delete', 'list', 'verify', 'rotate', 'versions', 'destroy',
  'token_admin', 'policy_admin', 'audit',
] as const

export function globMatch(pattern: string, path: string): boolean {
  if (pattern === '*') return true
  if (pattern === path) return true
  if (pattern.endsWith('*') && pattern.startsWith('*')) {
    const mid = pattern.slice(1, -1)
    return mid.length === 0 || path.includes(mid)
  }
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1))
  if (pattern.startsWith('*')) return path.endsWith(pattern.slice(1))
  return false
}

export interface PolicyRule {
  path: string
  capabilities: string[]
  effect: 'allow' | 'deny'
}

export function checkAllowed(rules: PolicyRule[], path: string, capability: string): boolean {
  const deny = rules.some(
    (r) => r.effect === 'deny' && r.capabilities.includes(capability) && globMatch(r.path, path),
  )
  if (deny) return false
  return rules.some(
    (r) => r.effect === 'allow' && r.capabilities.includes(capability) && globMatch(r.path, path),
  )
}

export function isValidCapability(cap: string): boolean {
  return (CAPABILITIES as readonly string[]).includes(cap)
}

// ------------------------------------------------------------
// Audit log (HMAC-chained, tamper-evident)
// ------------------------------------------------------------
export interface AuditFields {
  action: string
  actor_type: 'token' | 'user' | 'system'
  actor_id: string
  path: string
  version_number?: number | null
  success: boolean
  detail?: string
}

export async function appendAudit(supabase: any, masterKey: Uint8Array, fields: AuditFields, req?: Request): Promise<void> {
  try {
    const auditKey = await getAuditKey()
    const { data: last } = await supabase
      .from('audit_log')
      .select('seq, entry_hash')
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prevHash = last?.entry_hash || ''
    const created_at = new Date().toISOString()
    const ip = req?.headers.get('x-forwarded-for') || null
    const userAgent = req?.headers.get('user-agent') || null

    const { data: inserted, error } = await supabase
      .from('audit_log')
      .insert({
        prev_hash: prevHash,
        entry_hash: '',
        signature: '',
        action: fields.action,
        actor_type: fields.actor_type,
        actor_id: fields.actor_id,
        path: fields.path,
        version_number: fields.version_number ?? null,
        ip,
        user_agent: userAgent,
        success: fields.success,
        detail: fields.detail ?? null,
        created_at,
      })
      .select('seq')
      .single()

    if (error || !inserted) return

    const canonical = JSON.stringify({
      seq: inserted.seq,
      prev_hash: prevHash,
      action: fields.action,
      actor_type: fields.actor_type,
      actor_id: fields.actor_id,
      path: fields.path,
      version_number: fields.version_number ?? null,
      success: fields.success,
      detail: fields.detail ?? null,
      created_at: new Date(created_at).getTime(),
    })

    const entryHash = await hmacSha256Hex(auditKey, prevHash + canonical)
    await supabase
      .from('audit_log')
      .update({ entry_hash: entryHash, signature: entryHash })
      .eq('seq', inserted.seq)
  } catch {
    // audit must never break the main operation
  }
}

export async function verifyAuditChain(supabase: any): Promise<{ valid: boolean; checked: number; last_seq: number }> {
  const { data: rows } = await supabase.from('audit_log').select('*').order('seq', { ascending: true })
  if (!rows || rows.length === 0) return { valid: true, checked: 0, last_seq: 0 }
  const auditKey = await getAuditKey()
  let prev = ''
  for (const row of rows) {
    if (row.prev_hash !== prev) return { valid: false, checked: rows.length, last_seq: row.seq }
    const canonical = JSON.stringify({
      seq: row.seq,
      prev_hash: row.prev_hash,
      action: row.action,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      path: row.path,
      version_number: row.version_number ?? null,
      success: row.success,
      detail: row.detail ?? null,
      created_at: new Date(row.created_at).getTime(),
    })
    const expected = await hmacSha256Hex(auditKey, row.prev_hash + canonical)
    if (expected !== row.entry_hash) return { valid: false, checked: rows.length, last_seq: row.seq }
    prev = row.entry_hash
  }
  return { valid: true, checked: rows.length, last_seq: rows[rows.length - 1].seq }
}

// ------------------------------------------------------------
// Envelope encryption (per-secret DEK wrapped by master key)
// ------------------------------------------------------------
export async function generateDek(): Promise<Uint8Array> {
  return randomBytes(32)
}

export async function wrapDek(masterKey: Uint8Array, dek: Uint8Array): Promise<{ wrapped: string; iv: string }> {
  const { ciphertext, iv } = await aes256GcmEncrypt(dek, masterKey)
  return { wrapped: ciphertext, iv }
}

export async function unwrapDek(masterKey: Uint8Array, wrapped: string, iv: string): Promise<Uint8Array> {
  return aes256GcmDecrypt(wrapped, iv, masterKey)
}

export async function getSecretDek(supabase: any, masterKey: Uint8Array, ownerId: string, keyId: string): Promise<Uint8Array | null> {
  if (keyId === 'legacy') return null
  const { data: row } = await supabase
    .from('secret_keys')
    .select('wrapped_dek, iv, active')
    .eq('owner_id', ownerId)
    .eq('key_id', keyId)
    .maybeSingle()
  if (!row || row.active === false) return null
  try {
    return await unwrapDek(masterKey, row.wrapped_dek, row.iv)
  } catch {
    return null
  }
}

// ------------------------------------------------------------
// Generic validators
// ------------------------------------------------------------
export const SECRET_NAME_RE = /^[A-Za-z0-9_./-]+$/

export function validateSecretName(name: string): string | null {
  if (!name || name.length > 255) return 'Secret name is required (max 255 chars)'
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) return 'Secret name cannot start/end with "/" or contain "//"'
  if (!SECRET_NAME_RE.test(name)) return 'Secret name may only contain letters, digits, _, ., /, -'
  return null
}

export function validateLabels(labels: unknown): Record<string, string> | null {
  if (labels === undefined || labels === null) return {}
  if (typeof labels !== 'object' || Array.isArray(labels)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels as Record<string, unknown>)) {
    if (typeof v !== 'string' || v.length > 500) return null
    out[k] = v
  }
  return out
}

export function parseLimit(value: string | null, def = 50, max = 200): number {
  const n = Number(value ?? def)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(Math.floor(n), max)
}

export function parseOffset(value: string | null): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

// ------------------------------------------------------------
// Simple in-memory rate limiter (best-effort per edge instance)
// ------------------------------------------------------------
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(tokenHash: string, limit = 300, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(tokenHash)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(tokenHash, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}
