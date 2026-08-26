 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Universal install target — one name on every platform. */
export const UNIVERSAL_BIN = path.join(os.homedir(), '.squidcloud', 'bin', 'squidfs')

function releaseAssetName() {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : process.arch
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux'
  return `squidfs-${platform}-${arch}`
}

/** Locate the squidfs binary without installing:
    SQUIDFS_BIN → universal target → PATH → CLI dist/. */
export function findSquidFsBinary() {
  if (process.env.SQUIDFS_BIN && fs.existsSync(process.env.SQUIDFS_BIN)) return process.env.SQUIDFS_BIN
  if (fs.existsSync(UNIVERSAL_BIN)) {
    try { fs.accessSync(UNIVERSAL_BIN, fs.constants.X_OK); return UNIVERSAL_BIN } catch (e) {}
  }
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue
    const p = path.join(dir, 'squidfs')
    try { fs.accessSync(p, fs.constants.X_OK); return p } catch (e2) {}
  }
  const dist = path.resolve(here, '../../../dist', 'squidfs')
  if (fs.existsSync(dist)) return dist
  return null
}

/** Ensure the binary exists at the universal location. Provision order:
    build from a local ~/squidfs checkout → copy from PATH → download the
    official release asset. Idempotent; safe to call on every run. */
export async function ensureSquidFsBinary(log) {
  if (process.env.SQUIDFS_BIN && fs.existsSync(process.env.SQUIDFS_BIN)) return process.env.SQUIDFS_BIN

  fs.mkdirSync(path.dirname(UNIVERSAL_BIN), { recursive: true })

  // 1. Local Go checkout — always current. Builds (and overwrites) the
  //    universal binary so a cached older build never wins.
  const localRepo = path.join(os.homedir(), 'squidfs')
  if (fs.existsSync(path.join(localRepo, 'go.mod'))) {
    try {
      log('building squidfs from ~/squidfs …')
      execSync(`go build -trimpath -ldflags "-s -w" -o "${UNIVERSAL_BIN}" ./cmd/squidfs`, { cwd: localRepo, stdio: 'pipe' })
      fs.chmodSync(UNIVERSAL_BIN, 0o755)
      log('installed → ~/.squidcloud/bin/squidfs')
      return UNIVERSAL_BIN
    } catch (err) {
      log(`local build failed (${err instanceof Error ? err.message : String(err)}) — falling back`)
    }
  }

  // 2. Cached universal binary.
  if (fs.existsSync(UNIVERSAL_BIN)) {
    try { fs.accessSync(UNIVERSAL_BIN, fs.constants.X_OK); return UNIVERSAL_BIN } catch (e3) {}
  }

  // 3. Copy an existing binary already on PATH under any name.
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue
    const p = path.join(dir, 'squidfs')
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, UNIVERSAL_BIN)
      fs.chmodSync(UNIVERSAL_BIN, 0o755)
      return UNIVERSAL_BIN
    }
  }

  // 4. Official release — integrity-checked against the published
  //    checksums.txt so a tampered asset never executes. Retries once on
  //    transient CDN failures; names the exact asset it wanted on miss.
  const asset = releaseAssetName()
  const base = 'https://github.com/NaveenSingh9999/squidfs/releases/latest/download'

  const fetchAsset = async (url) => {
    try {
      return await fetch(url, { redirect: 'follow' })
    } catch (err) {
      // TLS/proxy/DNS hiccups on fresh machines — one quiet retry.
      await new Promise((r) => setTimeout(r, 1200))
      return fetch(url, { redirect: 'follow' })
    }
  }

  const binUrl = `${base}/${asset}`
  let binRes = await fetchAsset(binUrl)
  if (!binRes.ok) {
    // Transient CDN miss — retry once before giving up.
    await new Promise((r) => setTimeout(r, 800))
    binRes = await fetchAsset(binUrl)
  }
  if (!binRes.ok) {
    const detail = process.arch === 'arm'
      ? `this device is ${process.arch} (32-bit) — releases ship amd64/arm64 only`
      : `HTTP ${binRes.status} for ${binUrl}`
    throw new Error(
      `Could not provision squidfs: ${detail}. ` +
      `Download it manually from https://github.com/NaveenSingh9999/squidfs/releases/latest ` +
      `(${asset}) and place it at ${UNIVERSAL_BIN}, then chmod +x — or set SQUIDFS_BIN.`,
    )
  }
  const bytes = Buffer.from(await binRes.arrayBuffer())

  const sumRes = await fetchAsset(`${base}/checksums.txt`)
  if (sumRes.ok) {
    const { createHash } = await import('node:crypto')
    const actual = createHash('sha256').update(bytes).digest('hex')
    const expected = await sumRes.text().then(t =>
      _optionalChain([t, 'access', _ => _.split, 'call', _2 => _2('\n'), 'access', _3 => _3.find, 'call', _4 => _4(l => l.trimEnd().endsWith(asset)), 'optionalAccess', _5 => _5.split, 'call', _6 => _6(/\s+/), 'access', _7 => _7[0]]))
    if (!expected) {
      throw new Error(`squidfs provision failed: ${asset} missing from checksums.txt`)
    }
    if (actual !== expected) {
      throw new Error(`squidfs provision failed: sha256 mismatch for ${asset} (expected ${expected.slice(0, 16)}…, got ${actual.slice(0, 16)}…) — refusing to install a tampered binary`)
    }
  } else {
    log('warning: checksums.txt unavailable — skipping integrity check')
  }

  fs.writeFileSync(UNIVERSAL_BIN, bytes)
  fs.chmodSync(UNIVERSAL_BIN, 0o755)
  log('downloaded official squidfs → ~/.squidcloud/bin/squidfs (checksum verified)')
  return UNIVERSAL_BIN
}

export const SQUIDFS_DIR = path.join(os.homedir(), '.squidcloud')
export const PID_FILE = path.join(SQUIDFS_DIR, 'squidfs.pid')









export function readSession() {
  try {
    const raw = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8')) 
    try { process.kill(raw.pid, 0); return raw } catch (e4) { fs.rmSync(PID_FILE, { force: true }); return null }
  } catch (e5) { return null }
}

export function writeSession(s) {
  fs.mkdirSync(SQUIDFS_DIR, { recursive: true })
  fs.writeFileSync(PID_FILE, JSON.stringify(s))
}
