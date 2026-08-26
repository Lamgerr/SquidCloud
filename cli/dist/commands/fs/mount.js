 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { spawn } from 'node:child_process'
import chalk from 'chalk'
import { apiPost } from '../../lib/api/client.js'
import { muted } from '../../lib/output/brand.js'

import { ensureSquidFsBinary, writeSession } from './binary.js'
import { ensureDecryptor } from '../../lib/host/decryptor-supervisor.js'
import { ensureWebdavAuth } from '../../lib/host/webdav-auth.js'

/** Mint an API key for the SquidFS bridge (it authenticates cb_ keys). */
async function ensureApiKey() {
  if (process.env.SQUIDCLOUD_API_KEY) return process.env.SQUIDCLOUD_API_KEY
  const created = await apiPost('/keys', {
    name: `squidcloudctl-fs-${new Date().toISOString().slice(0, 10)}`,
  })
  // /keys returns { key: {…meta}, raw_key: '<64hex>' } — only raw_key is usable.
  let key = (_optionalChain([created, 'optionalAccess', _ => _.raw_key]) || '') 
  if (!key && typeof _optionalChain([created, 'optionalAccess', _2 => _2.key]) === 'string') key = created.key
  if (!key) throw new Error('Could not provision a storage key for SquidFS — create one in Settings → API Keys.')
  return key.startsWith('cb_') ? key : `cb_${key}`
}

export default async function fsMount(...args) {
  const strArgs = args.filter((a) => typeof a === 'string') 
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 

  const bin = await ensureSquidFsBinary((m) => console.log(`  ${chalk.dim(m)}`))
  const apiKey = await ensureApiKey()
  const mountPoint = strArgs[0] || (opts.mount ? String(opts.mount) : '')

  const argv = [bin]
  if (!mountPoint || opts.webdav) {
    argv.push('-webdav', '-port', String(opts.port || 8099))
  } else {
    argv.push('-mount', mountPoint)
  }
  argv.push('-bridge', String(opts.bridge || 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidfs-bridge'))
  argv.push('-bind', String(opts.bind || '0.0.0.0'))
  if (opts.mdns) argv.push('-mdns')

  console.log(`\n  ${chalk.bold('SquidFS')}  ${muted(mountPoint && !opts.webdav ? `mounting at ${mountPoint}` : `WebDAV → http://localhost:${opts.port || 8099}/`)}`)
  console.log(`  ${muted('files stay encrypted end-to-end; edits sync back automatically. Ctrl+C to stop.')}\n`)

  // Also fetch a short-lived auth token for direct API proxy downloads
  let authToken = ''
  try {
    const { sbToken } = await import('../../lib/auth/oauth-session.js')
    if (sbToken) authToken = sbToken
  } catch (e) {}
  // Dedicated decryptor on reserved port 6763: squidfs proxies all content
  // reads through it, so the Go binary never touches crypto.
  let decryptor
  try {
    decryptor = await ensureDecryptor((m) => console.log(`  ${chalk.dim(m)}`))
  } catch (err) {
    throw new Error(`Decryptor could not start on :6763 — ${err instanceof Error ? err.message : err}`)
  }

  // WebDAV password auth (mandatory unless explicitly disabled): the binary
  // gets only a PBKDF2 hash file, never the plaintext.
  const webdavAuth = await ensureWebdavAuth(opts)
  if (webdavAuth.freshPassword) {
    console.log(`\n  ${chalk.bold('WebDAV password (generated — shown once, stored in your OS secret store)')}`)
    console.log(`  ${webdavAuth.freshPassword}\n`)
  }

  const child = spawn(argv[0], argv.slice(1), {
    env: {
      ...process.env,
      SQUIDCLOUD_API_KEY: apiKey,
      SQUIDCLOUD_AUTH_TOKEN: apiKey,
      SQUIDCLOUD_DECRYPTOR: decryptor.url,
      SQUIDCLOUD_DECRYPTOR_AUTH: decryptor.secret,
      ...(webdavAuth.hashPath ? { SQUIDCLOUD_WEBDAV_AUTH_HASH: webdavAuth.hashPath } : {}),
    },
    stdio: 'inherit',
  })
  writeSession({
    pid: child.pid,
    mode: mountPoint && !opts.webdav ? 'fuse' : 'webdav',
    port: Number(opts.port || 8099),
    mount: mountPoint || undefined,
    started_at: Date.now(),
  })

  child.on('exit', (code) => process.exit(_nullishCoalesce(code, () => ( 0))))
}
