import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MicroRedis } from './microredis.js'
import { authenticateRequest, resolveProfile, generateApiKey, sha256, type SecurityConfig } from './security.js'

/* Local API host — SquidCloud operations served over loopback with zero
   platform-side rate limiting between your apps and your machine. Same code
   paths as the CLI itself: refs.ts resolution, transfer engine, REST client. */

export interface HostOptions {
  onBootstrapKey?: (key: string) => void

  port: number
  host?: string
  redisPort: number
  profile: string
  mode: 'open' | 'keyed'
  hmacSecret?: string
  quiet?: boolean
}

export interface HostState {
  redis: MicroRedis
  cfg: SecurityConfig
  port: number
  redisPort: number
  server: http.Server
  audit: (line: string) => void
  newKey(): { key: string; prefix: string }
  close(): void
}

const AUDIT_FILE = path.join(os.homedir(), '.squidcloud', 'host-audit.log')

export async function startHost(opts: HostOptions): Promise<HostState> {
  const redis = new MicroRedis()
  const cfg = resolveProfile(opts.profile, {
    mode: opts.mode,
    hmac: !!opts.hmacSecret,
  })
  if (opts.hmacSecret) redis.set('host:hmac-secret', opts.hmacSecret)

  await redis.listen(opts.redisPort, '127.0.0.1')

  const auditStream = fs.createWriteStream(AUDIT_FILE, { flags: 'a' })
  const audit = (line: string): void => {
    auditStream.write(`${new Date().toISOString()} ${line}\n`)
  }

  // Seed one local key so keyed modes are usable immediately.
  if (cfg.requireKey) {
    const k = generateApiKey()
    redis.set(`key:${k.hash}`, k.prefix)
    opts.onBootstrapKey?.(k.key)
  }

  const server = http.createServer((req, res) => {
    collect(req, cfg.maxBodyBytes)
      .then(async ({ body }) => {
        const started = Date.now()
        const auth = authenticateRequest(req, cfg, redis, body.length > 0 ? body : undefined)
        if (!auth.ok) {
          audit(`DENY ${req.method} ${req.url} ip=${req.socket.remoteAddress} why=${auth.error}`)
          return json(res, auth.status ?? 401, { error: auth.error, profile: cfg.profile })
        }

        const url = new URL(req.url || '/', 'http://localhost')
        const route = `${req.method} ${url.pathname}`

        try {
          const handled = await route_(req, res, url, body, cfg, redis, opts)
          if (!handled) return json(res, 404, { error: `No route: ${route}`, hint: 'GET /health lists nothing — see docs for routes' })
          audit(`OK ${route} key=${auth.keyId} ${Date.now() - started}ms`)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          audit(`ERR ${route} ${message}`)
          json(res, /not authenticated|login/i.test(message) ? 4401 : 500, { error: message })
        }
      })
      .catch((e) => json(res, 400, { error: e instanceof Error ? e.message : String(e) }))
  })

  // Abrupt client disconnects (probes, flaky peers) must never crash the
  // daemon — swallow transport-level noise, log anything unusual.
  server.on('clientError', (err, socket) => {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ECONNRESET' && code !== 'EPIPE') console.error(`host api clientError: ${err.message}`)
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    else socket.destroy()
  })
  server.on('error', (err) => {
    console.error(`host api server error: ${err.message}`)
  })

  const bindHost = opts.host || '0.0.0.0'
  await new Promise<void>((resolve) => server.listen(opts.port, bindHost, () => resolve()))

  return {
    redis,
    cfg,
    port: opts.port,
    redisPort: opts.redisPort,
    server,
    audit,
    newKey(): { key: string; prefix: string } {
      const k = generateApiKey()
      redis.set(`key:${k.hash}`, k.prefix)
      return k
    },
    close(): void {
      server.close()
      redis.close()
      auditStream.end()
    },
  }
}

/* ── routing ── */

async function route_(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  body: Buffer,
  cfg: SecurityConfig,
  redis: MicroRedis,
  opts: HostOptions,
): Promise<boolean> {
  const method = req.method || 'GET'
  const p = url.pathname.replace(/\/+$/, '') || '/'
  const seg = p.split('/').filter(Boolean)

  if (method === 'GET' && p === '/health') {
    return json(res, 200, {
      status: 'ok',
      host: 'squidcloudctl',
      profile: cfg.profile,
      mode: cfg.requireKey ? 'keyed' : 'open',
      redis: { port: opts.redisPort, keys: redis.size() },
      uptime_s: Math.round(process.uptime()),
    }), true
  }

  /* files */
  if (method === 'GET' && p === '/v1/files') {
    const search = url.searchParams.get('search') || undefined
    const cacheKey = `cache:files:${search ?? ''}`
    if (cfg.cacheTtlMs > 0) {
      const hit = redis.get(cacheKey)
      if (hit) return json(res, 200, JSON.parse(hit)), true
    }
    const { listFiles } = await import('../refs.js')
    const entries = await listFiles({ search, refresh: true })
    const payload: Record<string, unknown> = { count: entries.length, files: entries }
    if (cfg.cacheTtlMs > 0) redis.set(cacheKey, JSON.stringify(payload), cfg.cacheTtlMs)
    return json(res, 200, payload), true
  }

  if (method === 'GET' && seg[0] === 'v1' && seg[1] === 'files' && seg.length === 3) {
    const { resolveFileRef } = await import('../refs.js')
    const { apiGet } = await import('../api/client.js')
    const { entry } = await resolveFileRef(decodeURIComponent(seg[2]))
    const full = await apiGet<{ file?: unknown }>(`/files/${entry.id}/metadata`)
    const file = (full.file || entry) as Record<string, unknown>
    return json(res, 200, { ...file, _resolved_via: entry.id }), true
  }

  if (method === 'DELETE' && seg[0] === 'v1' && seg[1] === 'files' && seg.length === 3) {
    const { resolveFileRef } = await import('../refs.js')
    const { apiDelete } = await import('../api/client.js')
    const { entry } = await resolveFileRef(decodeURIComponent(seg[2]))
    await apiDelete(`/files/${entry.id}`)
    redis.del(`cache:files:`)
    return json(res, 200, { deleted: entry.id, name: entry.name }), true
  }

  if ((method === 'POST' || method === 'PATCH') && seg[0] === 'v1' && seg[1] === 'files' && seg[3] === 'rename') {
    const parsed = JSON.parse(body.toString('utf8') || '{}')
    const { resolveFileRef } = await import('../refs.js')
    const { apiPut } = await import('../api/client.js')
    const { entry } = await resolveFileRef(decodeURIComponent(seg[2]))
    await apiPut(`/files/${entry.id}/rename`, { name: String(parsed.name || '') })
    return json(res, 200, { renamed: entry.id, name: String(parsed.name || '') }), true
  }

  /* upload — raw bytes as body */
  if (method === 'POST' && p === '/v1/upload') {
    const filename = url.searchParams.get('filename') || 'upload.bin'
    const tmp = path.join(os.tmpdir(), `sq-host-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.writeFileSync(tmp, body)
    try {
      const { uploadFile } = await import('../transfer.js')
      const r = await uploadFile(tmp, { folderId: url.searchParams.get('folder_id'), quiet: true })
      return json(res, 201, { id: r.id, name: r.name, size: r.size }), true
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  }

  /* download — streams plaintext through this host */
  if (method === 'GET' && seg[0] === 'v1' && seg[1] === 'download' && seg.length === 3) {
    const { resolveFileRef } = await import('../refs.js')
    const { downloadFile } = await import('../transfer.js')
    const { entry } = await resolveFileRef(decodeURIComponent(seg[2]))
    const tmp = path.join(os.tmpdir(), `sq-dl-${Date.now()}`)
    const finalPath = await downloadFile({ id: entry.id, name: entry.name }, tmp)
    const data = fs.readFileSync(finalPath)
    fs.rmSync(finalPath, { force: true })
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
      'X-Squidcloud-File-Id': entry.id,
      'Content-Disposition': `attachment; filename="${entry.name}"`,
    })
    res.end(data)
    return true
  }

  /* share */
  if (method === 'POST' && p === '/v1/share') {
    const parsed = JSON.parse(body.toString('utf8') || '{}')
    const { apiPost } = await import('../api/client.js')
    const bodyOut: Record<string, unknown> = {}
    if (parsed.file_ref) {
      const { resolveFileRef } = await import('../refs.js')
      bodyOut.file_id = (await resolveFileRef(String(parsed.file_ref))).entry.id
    }
    if (parsed.folder_id) bodyOut.folder_id = parsed.folder_id
    if (parsed.expires_at) bodyOut.expires_at = parsed.expires_at
    if (parsed.max_downloads !== undefined) bodyOut.max_downloads = Number(parsed.max_downloads)
    if (parsed.view_only) bodyOut.view_only = true
    const r = await apiPost<{ share_url?: string; share_id?: string }>('/shares', bodyOut)
    return json(res, 201, r), true
  }

  /* secrets (read-only list + create) */
  if (method === 'GET' && p === '/v1/secrets') {
    const { apiGet } = await import('../api/client.js')
    const r = await apiGet<{ secrets?: unknown[] }>('/secrets')
    return json(res, 200, { secrets: r.secrets || [] }), true
  }

  /* exec bridge — whitelisted read-only ops so applications can extend on
     top of the exact CLI logic without shelling out. */
  if (method === 'POST' && p === '/v1/exec') {
    const parsed = JSON.parse(body.toString('utf8') || '{}') as { op?: string; args?: Record<string, unknown> }
    const op = parsed.op || ''
    const args = parsed.args || {}
    switch (op) {
      case 'whoami': {
        const { apiGet } = await import('../api/client.js')
        return json(res, 200, await apiGet('/user/whoami')), true
      }
      case 'storage.search': {
        const { listFiles } = await import('../refs.js')
        const q = String(args.query || '')
        const entries = await listFiles({ search: q, refresh: true })
        return json(res, 200, { matches: entries.length, files: entries }), true
      }
      case 'stats': {
        const { apiGet } = await import('../api/client.js')
        return json(res, 200, await apiGet('/user/whoami')), true
      }
      default:
        return json(res, 400, {
          error: `Unknown op '${op}'`,
          allowed: ['whoami', 'storage.search', 'stats'],
          note: 'exec is deliberately read-only — use the resource routes for mutations',
        }), true
    }
  }

  return false
}

/* ── helpers ── */

function json(res: http.ServerResponse, status: number, payload: unknown): boolean {
  if (!res.headersSent) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
  }
  res.end(JSON.stringify(payload))
  return true
}

function collect(req: http.IncomingMessage, maxBytes: number): Promise<{ body: Buffer }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > maxBytes) {
        reject(new Error(`Body exceeds limit (${maxBytes} bytes) — tune --max-body`))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve({ body: Buffer.concat(chunks) }))
    req.on('error', reject)
  })
}
