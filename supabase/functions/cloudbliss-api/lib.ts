// CloudBliss API v4.0 — Shared Utilities

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cip, x-f2fa, x-prel-token, x-prel-session, x-prel-op, x-prel-long-op, x-kza-session, x-squidcloud-key, x-squidcloud-encryption-key, x-timestamp, x-request-nonce, x-signature, range',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, PATCH, PUT, OPTIONS',
  'Accept-Ranges': 'bytes',
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(
  message: string,
  status: number,
  code?: string,
): Response {
  const body: Record<string, unknown> = { error: message, success: false }
  if (code !== undefined) body.code = code
  return jsonResponse(body, status)
}

export function apiSuccess(
  data: Record<string, unknown>,
  creditsInfo?: Record<string, unknown>,
): Response {
  const body: Record<string, unknown> = { ...data, success: true }
  if (creditsInfo) body.credits = creditsInfo
  return jsonResponse(body)
}

export function apiError(
  message: string,
  code: string,
  status: number,
  creditsInfo?: Record<string, unknown>,
): Response {
  const body: Record<string, unknown> = {
    error: message,
    code,
    success: false,
  }
  if (creditsInfo) body.credits = creditsInfo
  return jsonResponse(body, status)
}

export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const exported = await crypto.subtle.exportKey('raw', key)
  return Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function encryptData(
  data: ArrayBuffer,
  key: string,
): Promise<string> {
  const keyBytes = new TextEncoder().encode(
    key.slice(0, 32).padEnd(32, '0'),
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  const additionalData = new TextEncoder().encode(`res54-v2-${Date.now()}`)

  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    keyBuffer,
    data,
  )

  const encryptedBytes = new Uint8Array(encryptedContent)
  const combined = new Uint8Array(
    4 + additionalData.byteLength + iv.length + encryptedBytes.byteLength,
  )

  new DataView(combined.buffer, 0, 4).setUint32(
    0,
    additionalData.length,
    true,
  )

  combined.set(additionalData, 4)
  combined.set(iv, 4 + additionalData.length)
  combined.set(encryptedBytes, 4 + additionalData.length + iv.length)

  return uint8ToBase64(combined)
}

export async function decryptData(
  encryptedData: string,
  key: string,
): Promise<ArrayBuffer> {
  const binaryData = Uint8Array.from(atob(encryptedData), c =>
    c.charCodeAt(0),
  )

  const additionalDataLength = new DataView(
    binaryData.buffer,
    0,
    4,
  ).getUint32(0, true)
  const additionalData = binaryData.slice(4, 4 + additionalDataLength)
  const iv = binaryData.slice(
    4 + additionalDataLength,
    4 + additionalDataLength + 12,
  )
  const encryptedContent = binaryData.slice(4 + additionalDataLength + 12)

  const keyBytes = new TextEncoder().encode(
    key.slice(0, 32).padEnd(32, '0'),
  )
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData },
    keyBuffer,
    encryptedContent,
  )
}

export async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let j = 0; j < bytes.length; j += 8192) {
    binary += String.fromCharCode(...bytes.slice(j, j + 8192))
  }
  return btoa(binary)
}

export function getOptionalEncryptionKey(
  req: Request,
  queryParams?: URLSearchParams,
): string | null {
  const headerKey =
    req.headers.get('x-squidcloud-encryption-key') ||
    req.headers.get('x-encryption-key')
  const queryKey =
    queryParams?.get('encryption_key') ||
    queryParams?.get('encryptionKey')
  const value = (headerKey || queryKey || '').trim()
  return value.length > 0 ? value : null
}

export function validateEncryptionKeyFormat(key: string): boolean {
  return key.length >= 8 && key.length <= 512
}

export interface B2Cluster {
  id: string
  client: any
  endpoint: string
  bucket: string
  displayName: string
}

export let cachedClusters: B2Cluster[] | null = null
export let clusterLoadPromise: Promise<B2Cluster[]> | null = null

export async function loadB2Clusters(
  supabase: any,
): Promise<B2Cluster[]> {
  const { AwsClient } = await import('npm:aws4fetch')
  const { data: buckets } = await supabase
    .from('squidcloud_b2_buckets')
    .select('*')
    .eq('is_enabled', true)

  if (!buckets || buckets.length === 0) {
    const keyId = Deno.env.get('B2_ACCESS_KEY_ID')
    const appKey = Deno.env.get('B2_SECRET_ACCESS_KEY')
    if (keyId && appKey) {
      return [
        {
          id: 'legacy',
          client: new AwsClient({
            accessKeyId: keyId,
            secretAccessKey: appKey,
            service: 's3',
          }),
          endpoint: Deno.env.get('B2_ENDPOINT')!,
          bucket: Deno.env.get('B2_BUCKET_NAME')!,
          displayName: 'legacy',
        },
      ]
    }
    return []
  }

  return buckets.map((b: any) => ({
    id: b.id,
    client: new AwsClient({
      accessKeyId: b.access_key_id,
      secretAccessKey: b.secret_access_key,
      region: b.bucket_region,
      service: 's3',
    }),
    endpoint: b.bucket_endpoint,
    bucket: b.bucket_name,
    displayName: b.bucket_name,
  }))
}

export async function ensureB2Clusters(
  supabase: any,
): Promise<B2Cluster[]> {
  if (cachedClusters) return cachedClusters
  if (clusterLoadPromise) return clusterLoadPromise

  clusterLoadPromise = loadB2Clusters(supabase)
    .then(clusters => {
      cachedClusters = clusters
      clusterLoadPromise = null
      return clusters
    })
    .catch(err => {
      clusterLoadPromise = null
      throw err
    })

  return clusterLoadPromise
}

export async function signB2Url(
  cluster: B2Cluster,
  path: string,
  method: string,
  ttl?: number,
): Promise<string> {
  const url = new URL(`${cluster.endpoint}/${cluster.bucket}/${path}`)
  const signedReq = await cluster.client.sign(url.toString(), {
    method,
    headers:
      method === 'PUT'
        ? { 'Content-Type': 'application/octet-stream' }
        : undefined,
    aws: ttl ? { signQuery: true, seconds: ttl } : { signQuery: true },
  })
  return signedReq.url
}

export async function hmacHex(
  key: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyRequestSignature(
  req: Request,
  apiKey: string,
): Promise<boolean> {
  const signature = req.headers.get('x-signature')
  if (!signature) return true

  const timestamp = req.headers.get('x-timestamp') || ''
  const nonce = req.headers.get('x-request-nonce') || ''

  let body = ''
  try {
    body = await req.clone().text()
  } catch {
    body = ''
  }

  const payload = `${timestamp}${nonce}${body}`
  const expected = await hmacHex(apiKey, payload)
  return expected === signature
}

export const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
}

export async function requireWorkspaceRole(
  supabase: any,
  workspaceId: string,
  userId: string,
  minRole: string,
): Promise<{ allowed: boolean; role: string | null }> {
  const { data: role, error } = await supabase.rpc('get_workspace_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  })
  if (error || !role) return { allowed: false, role: null }
  const userRank = ROLE_RANK[role as string] || 0
  const minRank = ROLE_RANK[minRole] || 0
  return { allowed: userRank >= minRank, role }
}

export async function resolveWorkspaceId(
  supabase: any,
  userId: string,
  workspaceId?: string,
): Promise<string | null> {
  if (workspaceId) return workspaceId
  const { data, error } = await supabase.rpc(
    'get_or_create_default_workspace',
    { p_user_id: userId },
  )
  if (error || !data) return null
  return data
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function deriveAESKeyFromApiKey(apiKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey))
  return crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecretValue(plaintext: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const encryptedBytes = new Uint8Array(encrypted)
  return {
    encrypted: btoa(String.fromCharCode(...encryptedBytes)),
    iv: btoa(String.fromCharCode(...iv))
  }
}

export async function decryptSecretValue(encryptedB64: string, ivB64: string, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const encryptedBytes = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes)
  return new TextDecoder().decode(decrypted)
}

export async function logAudit(supabase: any, entry: {
  action: string; project_id: string; user_id: string; secret_name: string;
  ref_id?: string; success: boolean; detail?: string
}) {
  try {
    await supabase.from('squidveil_audit_log').insert({
      action: entry.action,
      project_id: entry.project_id,
      user_id: entry.user_id,
      secret_name: entry.secret_name,
      ref_id: entry.ref_id || null,
      success: entry.success,
      detail: entry.detail || null,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

export const B2_ENDPOINT = () => Deno.env.get('B2_ENDPOINT') ?? '';
export const B2_BUCKET = () => Deno.env.get('B2_BUCKET_NAME') ?? '';
export const B2_ACCESS_KEY = () => Deno.env.get('B2_ACCESS_KEY_ID') ?? '';
export const B2_SECRET = () => Deno.env.get('B2_SECRET_ACCESS_KEY') ?? '';
export const B2_REGION = () => Deno.env.get('B2_REGION') ?? 'us-west-000';

export function uuidRegex(): RegExp {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
}

export function getIdFromPath(pathParts: string[], index: number): string | null {
  const val = pathParts[index];
  if (!val) return null;
  return uuidRegex().test(val) ? val : null;
}

export async function makeB2Client() {
  const { AwsClient } = await import('npm:aws4fetch');
  return new AwsClient({
    accessKeyId: B2_ACCESS_KEY(),
    secretAccessKey: B2_SECRET(),
    region: B2_REGION(),
    service: 's3',
  });
}

// ============================================================
// UNIVERSAL BUCKET DISPATCH — delegate to squidcloud-cluster
// ============================================================

export async function invokeCluster(
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  const clusterUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/squidcloud-cluster`;
  const res = await fetch(clusterUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    throw new Error(`squidcloud-cluster ${res.status}: ${data?.error || text}`);
  }
  return data || {};
}

export async function getClusterDownloadUrls(
  userId: string,
  chunks: Array<{ path: string; index: number; bucket?: string; clusterId?: string }>,
): Promise<Array<{ index: number; path: string; downloadUrl: string; bucket: string; clusterId: string }>> {
  const data = await invokeCluster({
    action: 'resolve-download',
    userId,
    chunks,
  });
  return data?.urls || [];
}

export interface SwkPass {
  swkToken?: string;
  swkManifestHash?: string;
  internalMint?: boolean;
}

async function loadSwk(): Promise<any> {
  return await import('../_shared/swk-verify.ts');
}

// Verify a kza-swk verdict token for an upload shaped body
// ({ swkToken, swkManifestHash }).
export async function swkVerifyUploadToken(
  supabase: any,
  userId: string,
  body: Record<string, unknown>,
  sizeBytes: number,
): Promise<{ ok: boolean; status: number; error?: string; decision?: string }> {
  const { swkVerifyToken } = await loadSwk();
  return swkVerifyToken(supabase, {
    userId,
    token: String(body.swkToken || ''),
    manifestHash: String(body.swkManifestHash || ''),
    sizeBytes,
  });
}

// Scan-assist for API/CLI clients: accepts either a client-minted verdict
// ({ swkToken, swkManifestHash }) or a raw manifest ({ swkManifest }),
// which is screened server-to-server with the caller as subject.
// Returns the token + hash (+ echoed manifest) to forward downstream.
export async function swkEnsureToken(
  supabase: any,
  userId: string,
  body: Record<string, unknown>,
  sizeBytes: number,
): Promise<{ ok: boolean; status: number; error?: string; swkToken?: string; swkManifestHash?: string; manifest?: unknown }> {
  if (body.swkToken && body.swkManifestHash) {
    const gate = await swkVerifyUploadToken(supabase, userId, body, sizeBytes);
    if (!gate.ok) return gate;
    return { ok: true, status: 200, swkToken: String(body.swkToken), swkManifestHash: String(body.swkManifestHash), manifest: body.swkManifest };
  }
  if (body.swkManifest && typeof body.swkManifest === 'object') {
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/kza-swk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'scan', user_id: userId, manifest: body.swkManifest }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        if (res.status === 400) {
          // Caller-fixable manifest problem — propagate the real reason so
          // API clients can correct their request instead of seeing 503.
          return { ok: false, status: 400, error: data?.error || 'Invalid upload manifest' };
        }
        return { ok: false, status: 503, error: 'S-Hawk screening unavailable. Try again shortly.' };
      }
      if (data.decision === 'reject' || !data.token) {
        const first = (data.reasons && data.reasons[0]?.message) || 'blocked by S-Hawk safety screening';
        return { ok: false, status: 403, error: `Upload blocked: ${first}` };
      }
      return { ok: true, status: 200, swkToken: data.token, swkManifestHash: data.manifest_hash || '', manifest: body.swkManifest };
    } catch (e) {
      return { ok: false, status: 503, error: `S-Hawk screening failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { ok: false, status: 403, error: 'S-Hawk screening required: submit swkManifest or a prior swkToken + swkManifestHash.' };
}

// Re-screen a stored manifest at share/publish time (server-to-server).
export async function swkRescoreManifest(
  userId: string,
  manifest: unknown,
): Promise<{ ok: boolean; status: number; error?: string; decision?: string }> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/kza-swk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'rescore', user_id: userId, manifest }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ok: false, status: 503, error: 'S-Hawk re-screening unavailable. Try again shortly.' };
    }
    if (data.decision === 'reject') {
      const first = (data.reasons && data.reasons[0]?.message) || 'blocked by S-Hawk safety screening';
      return { ok: false, status: 403, error: `Share blocked: ${first}`, decision: data.decision };
    }
    return { ok: true, status: 200, decision: data.decision };
  } catch (e) {
    return { ok: false, status: 503, error: `S-Hawk re-screening failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function getClusterUploadUrls(
  userId: string,
  chunks: Array<{ path: string; index: number }>,
  totalSize?: number,
  preferBucket?: string,
  swk?: SwkPass,
): Promise<{
  urls: Array<{ index: number; path: string; uploadUrl: string; bucket: string; clusterId: string; kind: string }>;
  bucketAssignments: Record<string, string>;
}> {
  const data = await invokeCluster({
    action: 'get-upload-urls',
    userId,
    chunks,
    totalSize,
    preferBucket,
    ...(swk?.swkToken ? { swkToken: swk.swkToken } : {}),
    ...(swk?.swkManifestHash ? { swkManifestHash: swk.swkManifestHash } : {}),
    ...(swk?.internalMint === true ? { internalMint: true } : {}),
  });
  return {
    urls: data?.urls || [],
    bucketAssignments: data?.bucketAssignments || {},
  };
}

export const API_VERSION = '4.0'

// ============================================================
// STREAM SESSION TOKENS
// ============================================================

export interface StreamToken {
  fileId: string
  userId: string
  exp: number
  deviceFingerprint: string
  permissions: 'read' | 'readwrite'
}

export async function generateStreamToken(
  fileId: string,
  userId: string,
  deviceFingerprint: string,
  secret: string,
  ttlSeconds = 120,
): Promise<string> {
  const token: StreamToken = {
    fileId,
    userId,
    exp: Date.now() + ttlSeconds * 1000,
    deviceFingerprint,
    permissions: 'read',
  }
  const payload = JSON.stringify(token)
  const signature = await hmacHex(secret, payload)
  return btoa(payload) + '.' + signature
}

export async function verifyStreamToken(
  tokenStr: string,
  secret: string,
): Promise<StreamToken | null> {
  try {
    const dotIdx = tokenStr.lastIndexOf('.')
    if (dotIdx === -1) return null

    const payloadB64 = tokenStr.slice(0, dotIdx)
    const signature = tokenStr.slice(dotIdx + 1)
    const payload = atob(payloadB64)
    const expected = await hmacHex(secret, payload)
    if (expected !== signature) return null

    const token: StreamToken = JSON.parse(payload)
    if (token.exp < Date.now()) return null
    if (!token.fileId || !token.userId) return null

    return token
  } catch {
    return null
  }
}

export function generateDeviceFingerprint(req: Request): string {
  const ua = req.headers.get('user-agent') || ''
  const accept = req.headers.get('accept-language') || ''
  const fwd = req.headers.get('x-forwarded-for') || ''
  const raw = `${ua}|${accept}|${fwd}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return 'dev_' + Math.abs(hash).toString(36)
}
