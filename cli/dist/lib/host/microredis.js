 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import net from 'node:net'

/* MicroRedis — an embedded, RESP-compatible data store that powers the local
   API host: key auth, replay nonces, rate buckets and hot caches. Speaks the
   core wire protocol so any redis client can connect from localhost. */






export class MicroRedis {constructor() { MicroRedis.prototype.__init.call(this);MicroRedis.prototype.__init2.call(this); }
   __init() {this.store = new Map()}
   __init2() {this.server = null}

  get(key) {
    const e = this.store.get(key)
    if (!e) return null
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return e.value
  }

  set(key, value, ttlMs) {
    this.store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : undefined })
  }

  setNx(key, value, ttlMs) {
    if (this.get(key) !== null) return false
    this.set(key, value, ttlMs)
    return true
  }

  del(...keys) {
    let n = 0
    for (const k of keys) if (this.store.delete(k)) n++
    return n
  }

  incr(key) {
    const v = Number(_nullishCoalesce(this.get(key), () => ( '0'))) + 1
    this.set(key, String(v))
    return v
  }

  expire(key, ttlMs) {
    const e = this.store.get(key)
    if (!e) return false
    e.expiresAt = Date.now() + ttlMs
    return true
  }

  ttl(key) {
    const e = this.store.get(key)
    if (!e) return -2
    if (!e.expiresAt) return -1
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000))
  }

  keys(pattern) {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    return [...this.store.keys()].filter((k) => re.test(k))
  }

  flushAll() {
    this.store.clear()
  }

  /* ── programmatic helpers used by the security layer ── */

  hitRate(bucket, limit, windowMs) {
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
  seenNonce(nonce, ttlMs) {
    return this.setNx(`nonce:${nonce}`, '1', ttlMs)
  }

  sweep() {
    const now = Date.now()
    for (const [k, e] of this.store) if (e.expiresAt && e.expiresAt <= now) this.store.delete(k)
  }

  size() {
    return this.store.size
  }

  /* ── RESP server ── */

  listen(port, host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        let buf = ''
        let respMode = null
        const flushLine = (line) => {
          if (_optionalChain([respMode, 'optionalAccess', _ => _.active])) {
            // RESP bulk-string lines arrive as "$len" then payload
            if (line.startsWith('$')) return
            respMode.parts.push(line)
            if (respMode.parts.length >= respMode.count) {
              try {
                socket.write(this.executeArray(respMode.parts))
              } catch (e2) {
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
          } catch (e3) {
            socket.write('-ERR internal\r\n')
          }
        }
        socket.on('data', (chunk) => {
          buf += chunk.toString('utf8')
          let idx
          while ((idx = buf.indexOf('\r\n')) !== -1) {
            const line = buf.slice(0, idx)
            buf = buf.slice(idx + 2)
            flushLine(line)
          }
        })
        // A client that disconnects mid-response (port probe, health check,
        // flaky LAN peer) must never take the whole API server down.
        socket.on('error', (err) => {
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

  close() {
    _optionalChain([this, 'access', _2 => _2.server, 'optionalAccess', _3 => _3.close, 'call', _4 => _4()])
    this.server = null
  }

  /** Inline protocol: "CMD arg arg" */
  executeInline(raw) {
    return this.run(raw.trim().split(/\s+/))
  }

  /** RESP array (values only, bulk headers already stripped). */
  executeArray(parts) {
    return this.run(parts.map(String))
  }

   run(parts) {
    if (!parts || parts.length === 0) return '-ERR empty\r\n'
    const cmd = (parts[0] || '').toUpperCase()
    const args = parts.slice(1).map(String)

    switch (cmd) {
      case 'PING': return '+PONG\r\n'
      case 'ECHO': return `$${_nullishCoalesce(_optionalChain([args, 'access', _5 => _5[0], 'optionalAccess', _6 => _6.length]), () => ( 0))}\r\n${_nullishCoalesce(args[0], () => ( ''))}\r\n`
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
        const ks = this.keys(_nullishCoalesce(args[0], () => ( '*')))
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

