 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DECRYPTOR_PORT, DECRYPTOR_SOURCE } from './decryptor.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))









const STATE_FILE = path.join(os.homedir(), '.squidcloud', 'decryptor.json')
const BIN_DIR = path.join(os.homedir(), '.squidcloud', 'bin')

// ESM resolution walks up from the script's own directory, so the script MUST
// live inside the package tree where node_modules is reachable (NODE_PATH is
// ignored for ESM). Drop it in node_modules/.cache so
// `import('@noble/ciphers/aes.js')` resolves.
function resolveScriptPath() {
  const pkgRoot = path.resolve(__dirname, '../../..') // dist/lib/host → pkg root
  const nm = path.join(pkgRoot, 'node_modules')
  if (fs.existsSync(path.join(nm, '@noble', 'ciphers'))) {
    const cache = path.join(nm, '.cache')
    fs.mkdirSync(cache, { recursive: true })
    return path.join(cache, 'squidcloud-decryptor.mjs')
  }
  fs.mkdirSync(BIN_DIR, { recursive: true })
  return path.join(BIN_DIR, 'decryptor.mjs')
}
const SCRIPT = resolveScriptPath()

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) 
  } catch (e) { return null }
}

/** GET http://127.0.0.1:<port>/health with a short timeout. */
function health(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 1200 }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.on('error', () => resolve(false))
  })
}

async function waitHealthy(port, ms = 8000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await health(port)) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}







/**
 * Ensure exactly one decryptor owns port 6763 and return connection info.
 * Reuses a healthy instance whose pid matches the state file; otherwise
 * stops stale owners and starts a fresh detached daemon.
 */
export async function ensureDecryptor(log) {
  const say = _nullishCoalesce(log, () => ( (() => {})))
  const state = readState()

  if (await health(DECRYPTOR_PORT)) {
    if (state && await pidAlive(state.pid)) {
      return { url: `http://127.0.0.1:${DECRYPTOR_PORT}`, secret: state.secret, started: false }
    }
    // Healthy but unknown owner — leave it running only if its own state matches.
    const ownerState = readState()
    if (ownerState && await pidAlive(ownerState.pid)) {
      return { url: `http://127.0.0.1:${DECRYPTOR_PORT}`, secret: ownerState.secret, started: false }
    }
    say('decryptor: replacing stale instance on :6763')
    killPortOwner(state)
    await new Promise((r) => setTimeout(r, 400))
  } else if (state && await pidAlive(state.pid)) {
    // Process alive but not answering — zombie; recycle.
    killPortOwner(state)
    await new Promise((r) => setTimeout(r, 400))
  }

  // Materialise the service script next to the squidfs binary.
  fs.mkdirSync(BIN_DIR, { recursive: true })
  fs.writeFileSync(SCRIPT, DECRYPTOR_SOURCE)

  const child = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      SQUIDCLOUD_DECRYPTOR_PORT: String(DECRYPTOR_PORT),
      SQUIDCLOUD_API_BASE: process.env.SQUIDCLOUD_API_BASE || 'https://squidcloud.vercel.app/api/v1',
    },
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  const ok = await waitHealthy(DECRYPTOR_PORT)
  if (!ok) throw new Error(`decryptor failed to start on :${DECRYPTOR_PORT}`)
  const fresh = readState()
  if (!_optionalChain([fresh, 'optionalAccess', _ => _.secret])) throw new Error('decryptor did not publish its session secret')
  say(`decryptor: ready on 127.0.0.1:${DECRYPTOR_PORT} (pid ${fresh.pid})`)
  return { url: `http://127.0.0.1:${DECRYPTOR_PORT}`, secret: fresh.secret, started: true }
}

async function pidAlive(pid) {
  if (!pid) return false
  try { process.kill(pid, 0); return true } catch (e2) { return false }
}

function killPortOwner(state) {
  if (!_optionalChain([state, 'optionalAccess', _2 => _2.pid])) return
  try { process.kill(state.pid, 'SIGTERM') } catch (e3) {}
}
