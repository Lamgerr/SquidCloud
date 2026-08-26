import net from 'node:net'

/* MicroRedis — an embedded, RESP-compatible data store that powers the local
   API host: key auth, replay nonces, rate buckets and hot caches. Speaks the
   core wire protocol so any redis client can connect from localhost. */

interface Entry {
  value: string
  expiresAt?: number
}

export class MicroRedis {
  private store = new Map<string, Entry>()
  private server: net.Server | null = null

  get(key: string): string | null {
    const e = this.store.get(key)
    if (!e) return null
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return e.value
  }

  set(key: string, value: string, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : undefined })
  }

  setNx(key: string, value: string, ttlMs?: number): boolean {
    if (this.get(key) !== null) return false
    this.set(key, value, ttlMs)
    return true
  }

  del(...keys: string[]): number {
    let n = 0
    for (const k of keys) if (this.store.delete(k)) n++
    return n
  }

  incr(key: string): number {
    const v = Number(this.get(key) ?? '0') + 1
    this.set(key, String(v))
    return v
  }

  expire(key: string, ttlMs: number): boolean {
    const e = this.store.get(key)
    if (!e) return false
    e.expiresAt = Date.now() + ttlMs
    return true
  }

  ttl(key: string): number {
    const e = this.store.get(key)
    if (!e) return -2
    if (!e.expiresAt) return -1
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000))
  }

  keys(pattern: string): string[] {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    return [...this.store.keys()].filter((k) => re.test(k))
  }

  flushAll(): void {
    this.store.clear()
  }

  /* ── programmatic helpers used by the security layer ── */

  hitRate(bucket: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetSec: number } {
    const now = Date.now()
    const winKey = `${bucket}:${Math.floor(now / windowMs)}`
    const count = this.incr(winKey)
    this.expire(winKey, windowMs)
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSec: Math.ceil((windowMs - (now % windowMs)) / 1000),
    }
  }

  /** Replay guard: true on first sight of the nonce within its TTL. */
  seenNonce(nonce: string, ttlMs: number): boolean {
    return this.setNx(`nonce:${nonce}`, '1', ttlMs)
  }

  sweep(): void {
    const now = Date.now()
    for (const [k, e] of this.store) if (e.expiresAt && e.expiresAt <= now) this.store.delete(k)
  }

  size(): number {
    return this.store.size
  }

  /* ── RESP server ── */

  listen(port: number, host = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        let buf = ''
        let respMode: { active: boolean; count: number; parts: string[] } | null = null
        const flushLine = (line: string): void => {
          if (respMode?.active) {
            // RESP bulk-string lines arrive as "$len" then payload
            if (line.startsWith('$')) return
            respMode.parts.push(line)
            if (respMode.parts.length >= respMode.count) {
              try {
                socket.write(this.executeArray(respMode.parts))
              } catch {
                socket.write('-ERR internal\r\n')
              }
              respMode = null
            }
            return
          }
          if (line.startsWith('*')) {
            const n = Number(line.slice(1))
            if (!Number.isNaN(n)) {
              respMode = { active: true, count: n, parts: [] }
              // A RESP array of N elements has N "$len" header lines we skip,
              // so total scanned lines is handled lazily above.
              return
            }
          }
          if (line.trim().length === 0) return
          try {
            socket.write(this.executeInline(line))
          } catch {
            socket.write('-ERR internal\r\n')
          }
        }
        socket.on('data', (chunk) => {
          buf += chunk.toString('utf8')
          let idx: number
          while ((idx = buf.indexOf('\r\n')) !== -1) {
            const line = buf.slice(0, idx)
            buf = buf.slice(idx + 2)
            flushLine(line)
          }
        })
        // A client that disconnects mid-response (port probe, health check,
        // flaky LAN peer) must never take the whole API server down.
        socket.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
            console.error(`micro-redis socket error: ${err.message}`)
          }
          socket.destroy()
        })
      })
      server.on('error', reject)
      server.listen(port, host, () => {
        this.server = server
        resolve(port)
      })
    })
  }

  close(): void {
    this.server?.close()
    this.server = null
  }

  /** Inline protocol: "CMD arg arg" */
  executeInline(raw: string): string {
    return this.run(raw.trim().split(/\s+/))
  }

  /** RESP array (values only, bulk headers already stripped). */
  executeArray(parts: string[]): string {
    return this.run(parts.map(String))
  }

  private run(parts: string[]): string {
    if (!parts || parts.length === 0) return '-ERR empty\r\n'
    const cmd = (parts[0] || '').toUpperCase()
    const args = parts.slice(1).map(String)

    switch (cmd) {
      case 'PING': return '+PONG\r\n'
      case 'ECHO': return `$${args[0]?.length ?? 0}\r\n${args[0] ?? ''}\r\n`
      case 'SET':
        if (args.length < 2) return '-ERR wrong arity\r\n'
        this.set(args[0], args.slice(1).join(' '))
        return '+OK\r\n'
      case 'GET': {
        const v = this.get(args[0])
        return v === null ? '$-1\r\n' : `$${Buffer.byteLength(v)}\r\n${v}\r\n`
      }
      case 'DEL': return `:${this.del(...args)}\r\n`
      case 'INCR': return `:${this.incr(args[0])}\r\n`
      case 'EXPIRE': {
        const ok = this.expire(args[0], Number(args[1]) * 1000)
        return ok ? ':1\r\n' : ':0\r\n'
      }
      case 'TTL': return `:${this.ttl(args[0])}\r\n`
      case 'KEYS': {
        const ks = this.keys(args[0] ?? '*')
        let out = `*${ks.length}\r\n`
        for (const k of ks) out += `$${k.length}\r\n${k}\r\n`
        return out
      }
      case 'DBSIZE': return `:${this.size()}\r\n`
      case 'FLUSHALL': this.flushAll(); return '+OK\r\n'
      default: return `-ERR unknown command '${cmd}'\r\n`
    }
  }
}

