 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { renderBanner } from '../../lib/output/banner.js'
import { success, muted, info } from '../../lib/output/brand.js'
import { startHost, } from '../../lib/host/server.js'
import { apiPost, apiGet } from '../../lib/api/client.js'

import { isJsonMode } from '../../lib/output/logger.js'

export const HOST_PID_FILE = path.join(os.homedir(), '.squidcloud', 'host.pid')











export function readHostPid() {
  try {
    const raw = JSON.parse(fs.readFileSync(HOST_PID_FILE, 'utf-8')) 
    try { process.kill(raw.pid, 0); return raw } catch (e) { fs.rmSync(HOST_PID_FILE, { force: true }); return null }
  } catch (e2) { return null }
}

export function writeHostPid(p) {
  fs.mkdirSync(path.dirname(HOST_PID_FILE), { recursive: true })
  fs.writeFileSync(HOST_PID_FILE, JSON.stringify(p))
}














const ENDPOINTS = [
  ['GET', '/health', 'liveness + profile + redis stats'],
  ['GET', '/v1/files?search=', 'list files (#numbered refs included)'],
  ['GET', '/v1/files/:ref', 'metadata — ref = #n | id-prefix | name'],
  ['POST', '/v1/files/:ref/rename', '{ "name": "new-name" }'],
  ['DELETE', '/v1/files/:ref', 'move to trash'],
  ['POST', '/v1/upload?filename=x', 'raw body bytes → res54 pipeline'],
  ['GET', '/v1/download/:ref', 'streams decrypted plaintext'],
  ['POST', '/v1/share', '{ file_ref | folder_id, expires_at?, max_downloads?, view_only? }'],
  ['GET', '/v1/secrets', 'secret inventory'],
  ['POST', '/v1/exec', '{ op: whoami | storage.search | stats }'],
]

/** Register this host as a dedicated HOST| api key so the dashboard can show
    live state. The key doubles as the heartbeat credential (every authed
    request bumps last_used_at server-side). */
async function registerHostKey(port, profile, mode) {
  const os = await import('node:os')
  const crypto = await import('node:crypto')
  const hostId = crypto.createHash('sha256').update(`${os.hostname()}:${port}`).digest('hex').slice(0, 16)
  const created = await apiPost('/keys', {
    name: `HOST|${hostId}|${os.hostname()}|${port}|${profile}|${mode}`,
    scopes: ['*'],
  })
  const id = _optionalChain([created, 'optionalAccess', _2 => _2.key, 'optionalAccess', _3 => _3.id])
  const rawKey = _optionalChain([created, 'optionalAccess', _4 => _4.raw_key])
  if (!id || !rawKey) throw new Error('Could not register host key for dashboard visibility')
  return { id, rawKey, hostId }
}

export default async function hostApi(...args) {
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 
  // Commander camelCases dashed flags — accept both spellings.
  const o = opts 
  const pick = (dashed, camel) =>
    _nullishCoalesce(o[dashed], () => ( o[camel]))
  const a = {
    port: Number(pick('port', 'port') || 8065),
    'redis-port': Number(pick('redis-port', 'redisPort') || Number(pick('port', 'port') || 8065) + 1),
    profile: String(pick('profile', 'profile') || 'standard'),
    bind: String(pick('bind', 'bind') || '0.0.0.0'),
    mode: String(pick('mode', 'mode') || 'open'),
    'hmac-secret': pick('hmac-secret', 'hmacSecret') ? String(pick('hmac-secret', 'hmacSecret')) : undefined,
    rps: pick('rps', 'rps') ? Number(pick('rps', 'rps')) : undefined,
    'max-body': pick('max-body', 'maxBody') ? String(pick('max-body', 'maxBody')) : undefined,
    'allow-ips': _nullishCoalesce((pick('allow-ips', 'allowIps') ), () => ( undefined)),
    key: _nullishCoalesce((pick('key', 'key') ), () => ( undefined)),
    quiet: !!pick('quiet', 'quiet'),
  }

  const existing = readHostPid()
  if (existing) {
    throw new Error(`A host is already running on :${existing.port} (pid ${existing.pid}). Stop it with \`squidcloudctl host stop\`.`)
  }

  if (!isJsonMode()) {
    console.log(renderBanner({ tagline: false }))
  }

  let bootstrapKey = ''
  const state = await startHost({
    onBootstrapKey: (k) => { bootstrapKey = k },
    port: a.port,
    host: a.bind,
    redisPort: a['redis-port'],
    profile: a.profile,
    mode: (a.mode ) || 'open',
    hmacSecret: a['hmac-secret'],
    quiet: a.quiet,
  })

  // Seed user-supplied extra keys.
  const extraKeys = []
  const isLoop = a.bind === '127.0.0.1' || a.bind === 'localhost' || a.bind === '::1'
  const explicitIps = Array.isArray(opts.allowIps)
  if (!isLoop && !state.cfg.requireKey && !explicitIps && state.cfg.profile === 'standard') {
    state.cfg.allowIps = ['*']
  }

  if (Array.isArray(opts.key)) for (const _ of opts.key ) extraKeys.push(state.newKey().key)
  else if (opts.key) extraKeys.push(state.newKey().key)

  writeHostPid({
    pid: process.pid,
    port: a.port,
    redisPort: a['redis-port'],
    mode: state.cfg.requireKey ? 'keyed' : 'open',
    profile: state.cfg.profile,
    started_at: Date.now(),
  })

  // Dashboard visibility: HOST| key + heartbeat loop.
  let heartbeat = null
  let hostKeyId = ''
  try {
    const reg = await registerHostKey(a.port, state.cfg.profile, state.cfg.requireKey ? 'keyed' : 'open')
    hostKeyId = reg.id
    let beats = 0
    const beat = async () => {
      try {
        await apiGet('/user/whoami', { headers: { 'X-SquidCloud-Key': reg.rawKey }, retries: 1 })
        beats += 1
      } catch (e3) { /* transient — next beat retries */ }
    }
    await beat()
    heartbeat = setInterval(beat, 60000)
    if (!isJsonMode()) console.log(`  ${info('dashboard')}   visible under Settings → Developer → CLI devices`)
  } catch (err) {
    if (!isJsonMode()) console.log(`  ${muted('dashboard sync skipped: ' + (err instanceof Error ? err.message : String(err)))}`)
  }

  if (isJsonMode()) {
    console.log(JSON.stringify({
      status: 'listening',
      port: a.port,
      redis_port: a['redis-port'],
      profile: state.cfg.profile,
      mode: state.cfg.requireKey ? 'keyed' : 'open',
      bootstrap_key: bootstrapKey || undefined,
    }, null, 2))
  } else {
    const shownHost = isLoop ? `127.0.0.1:${a.port}` : `${a.bind}:${a.port}`
    console.log(`  ${success(`API host listening`)} ${chalk.bold(`http://${shownHost}`)}${isLoop ? '' : chalk.yellow('  · LAN-EXPOSED')}`)
    console.log(`  ${info('profile')}     ${state.cfg.profile} · mode=${state.cfg.requireKey ? 'keyed' : 'open'}${state.cfg.requireHmac ? ' · hmac=on' : ''}`)
    console.log(`  ${info('micro-redis')}  127.0.0.1:${a['redis-port']}  ${muted('(PING/GET/SET/INCR/TTL/KEYS…)')}`)
    console.log(`  ${info('limits')}      ${state.cfg.rpsPerKey} req/s/key · body ≤ ${Math.round(state.cfg.maxBodyBytes / 1048576)}MB · ips=${state.cfg.allowIps.join(',')}`)
    if (!isLoop && !state.cfg.requireKey) console.log(`  ${chalk.yellow('⚠ open mode on 0.0.0.0 — anyone on this network can read files. Use --profile hardened / keyed or --allow-ips to restrict.')}`)
    console.log(`  ${info('audit')}       ${muted('~/.squidcloud/host-audit.log')}\n`)

    if (bootstrapKey) {
      console.log(`  ${chalk.bold.yellow('LOCAL KEY (shown once — store it now)')}`)
      console.log(`  ${chalk.cyan(bootstrapKey)}\n`)
    }

    console.log(`  ${chalk.bold('Routes')}`)
    for (const [m, p2, d] of ENDPOINTS) {
      console.log(`   ${chalk.green(m.padEnd(7))} ${chalk.cyan(p2.padEnd(30))} ${muted(d)}`)
    }
    console.log(`\n  ${muted('Same engine as the CLI: numbered refs, res54 transfers, zero platform rate limits in between.')}`)
    console.log(`  ${muted('Stop with `squidcloudctl host stop` or Ctrl+C.')}\n`)
  }

  const shutdown = (signal) => {
    state.close()
    if (heartbeat) clearInterval(heartbeat)
    // Best-effort: mark the HOST| key offline so the dashboard flips its dot.
    if (hostKeyId) {
      void (async () => {
        try {
          const { apiPut } = await import('../../lib/api/client.js')
          const current = await apiGet(`/keys/${hostKeyId}`)
          if (_optionalChain([current, 'optionalAccess', _5 => _5.name]) && !current.name.endsWith(':OFFLINE')) {
            await apiPut(`/keys/${hostKeyId}`, { name: `${current.name}:OFFLINE` })
          }
        } catch (e4) {}
      })()
    }
    try { fs.rmSync(HOST_PID_FILE, { force: true }) } catch (e5) {}
    if (!isJsonMode()) console.log(`\n  ${muted(`host stopped (${signal})`)}`)
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  // Long-running daemon: transport resets from probes/peers must log, not kill.
  process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return
    console.error(`host api fatal: ${err.stack || err.message}`)
    shutdown('uncaughtException')
  })
}
