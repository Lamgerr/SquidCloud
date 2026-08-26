import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import crypto from 'node:crypto'

/**
 * Tiered secret storage for squidcloudctl.
 *
 *   Tier 1  OS-native credential manager via @napi-rs/keyring
 *           (macOS Keychain / Windows Credential Manager-DPAPI /
 *            Linux Secret Service — gnome-keyring, kwallet)
 *   Tier 2  AES-256-GCM vault file keyed by scrypt(passphrase)
 *           for headless Linux boxes without a keyring daemon
 *   Tier 3  plain JSON with 0600 (Termux/Android and other hosts
 *           where neither of the above can exist) + loud warning
 *
 * Secrets NEVER live in the flat credentials file again; that file keeps
 * only non-secret metadata. The chosen backend is recorded there so all
 * entries stay in one place across runs.
 */

const CFG_DIR = path.join(os.homedir(), '.squidcloud')
const METADATA_PATH = path.join(CFG_DIR, 'credentials')
const VAULT_PATH = path.join(CFG_DIR, 'vault.enc')
const PLAIN_PATH = path.join(CFG_DIR, 'secrets.plain.json')
const SERVICE = 'SquidCloud CLI'

export type SecretKey = 'token' | 'anon_key' | 'sb_token' | 'webdav' | 'aal2_seed' | 'aal2_prel'

type Backend = 'keyring' | 'vault' | 'file'

let backendPromise: Promise<Backend> | null = null

// ────────────────────────── metadata (non-secret) ──────────────────────────

interface MetaFile {
  version?: number
  token_prefix?: string
  email?: string
  expires_at?: number
  device_id?: string
  secret_backend?: Backend
  [k: string]: unknown
}

export function readMeta(): MetaFile {
  try { return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8')) as MetaFile } catch { return {} }
}

export function writeMeta(meta: MetaFile): void {
  fs.mkdirSync(CFG_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(METADATA_PATH, JSON.stringify(meta), { mode: 0o600 })
}

function setBackend(b: Backend): void {
  const meta = readMeta()
  if (meta.secret_backend !== b) {
    meta.secret_backend = b
    writeMeta(meta)
  }
}

// ─────────────────────────────── Tier 1 ────────────────────────────────────

async function loadKeyring(): Promise<Record<string, unknown> | null> {
  try {
    const mod = await import('@napi-rs/keyring')
    const Entry = (mod as any).Entry ?? (mod as any).default?.Entry
    if (!Entry) return null
    // Probe: real round-trip proves a usable keyring daemon/service exists.
    const probe = new Entry(SERVICE, '__probe__')
    probe.setPassword('ok')
    if (probe.getPassword() !== 'ok') return null
    try { probe.deletePassword() } catch {}
    return mod
  } catch {
    return null
  }
}

// ─────────────────────────────── Tier 2 ────────────────────────────────────

const KDF_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

async function promptPassphrase(create: boolean): Promise<string | null> {
  if (process.env.SQUIDCLOUD_VAULT_PASSPHRASE) return process.env.SQUIDCLOUD_VAULT_PASSPHRASE
  if (!process.stdin.isTTY || process.env.SQUIDCLOUD_NONINTERACTIVE === '1') return null
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q: string) => new Promise<string>(res => rl.question(q, res))
  try {
    const pass = await ask(create ? '  vault passphrase (new): ' : '  vault passphrase: ')
    if (create && pass.length < 8) return null
    return pass
  } finally { rl.close() }
}

function deriveKey(pass: string, salt: Buffer): Buffer {
  return crypto.scryptSync(pass, salt, 32, KDF_OPTS)
}

function vaultRead(pass: string): Record<string, string> {
  const raw = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf-8'))
  const key = deriveKey(pass, Buffer.from(raw.salt, 'base64'))
  const blob = Buffer.from(raw.data, 'base64')
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ct = blob.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString())
}

function vaultWrite(pass: string, secrets: Record<string, string>): void {
  const salt = crypto.randomBytes(16)
  const key = deriveKey(pass, salt)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(secrets)), cipher.final()])
  fs.mkdirSync(CFG_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(
    VAULT_PATH,
    JSON.stringify({ v: 1, kdf: 'scrypt', salt: salt.toString('base64'), data: Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64') }),
    { mode: 0o600 },
  )
}

// ─────────────────────────────── Tier 3 ────────────────────────────────────

function plainRead(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(PLAIN_PATH, 'utf-8')) } catch { return {} }
}

function plainWrite(secrets: Record<string, string>): void {
  fs.mkdirSync(CFG_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(PLAIN_PATH, JSON.stringify(secrets), { mode: 0o600 })
}

let warnedPlain = false
function warnPlainOnce(): void {
  if (warnedPlain) return
  warnedPlain = true
  console.error('  ⚠ no OS keyring available — secrets stored 0600-plain in ~/.squidcloud/secrets.plain.json')
}

// ───────────────────────────── backend pick ────────────────────────────────

async function resolveBackend(): Promise<Backend> {
  if (backendPromise) return backendPromise

  backendPromise = (async () => {
    const meta = readMeta()

    // Honor the previously chosen backend so secrets never split across tiers.
    if (meta.secret_backend === 'keyring') {
      if (await loadKeyring()) return 'keyring'
      console.error('  ⚠ keyring vanished — falling back to encrypted vault for NEW writes only')
      // fallthrough attempt to unlock existing vault below is skipped:
      // previous entries are lost with the OS store; start fresh.
      const pass = await promptPassphrase(true)
      if (pass) { setBackend('vault'); return 'vault' }
      setBackend('file'); warnPlainOnce(); return 'file'
    }
    if (meta.secret_backend === 'vault') return 'vault'
    if (meta.secret_backend === 'file') { warnPlainOnce(); return 'file' }

    // Fresh install: best available tier wins.
    if (await loadKeyring()) { setBackend('keyring'); return 'keyring' }
    if (fs.existsSync(VAULT_PATH)) { setBackend('vault'); return 'vault' }
    const pass = await promptPassphrase(true)
    if (pass) { setBackend('vault'); return 'vault' }
    setBackend('file'); warnPlainOnce(); return 'file'
  })()

  return backendPromise
}

// ───────────────────────────── public API ──────────────────────────────────

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  const backend = await resolveBackend()
  if (backend === 'keyring') {
    const mod = await loadKeyring()
    const Entry = (mod as any).Entry
    new Entry(SERVICE, key).setPassword(value)
    return
  }
  if (backend === 'vault') {
    let pass = process.env.SQUIDCLOUD_VAULT_PASSPHRASE ?? null
    if (!pass && fs.existsSync(VAULT_PATH)) pass = await promptPassphrase(false)
    else if (!pass) pass = await promptPassphrase(true)
    if (!pass) throw new Error('vault passphrase required (set SQUIDCLOUD_VAULT_PASSPHRASE for headless use)')
    const secrets = fs.existsSync(VAULT_PATH) ? vaultRead(pass) : {}
    secrets[key] = value
    vaultWrite(pass, secrets)
    return
  }
  const secrets = plainRead()
  secrets[key] = value
  plainWrite(secrets)
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  const backend = await resolveBackend()
  if (backend === 'keyring') {
    const mod = await loadKeyring()
    if (!mod) return null
    const Entry = (mod as any).Entry
    try { return new Entry(SERVICE, key).getPassword() } catch { return null }
  }
  if (backend === 'vault') {
    if (!fs.existsSync(VAULT_PATH)) return null
    const pass = process.env.SQUIDCLOUD_VAULT_PASSPHRASE ?? await promptPassphrase(false)
    if (!pass) throw new Error('vault passphrase required (set SQUIDCLOUD_VAULT_PASSPHRASE for headless use)')
    return vaultRead(pass)[key] ?? null
  }
  return plainRead()[key] ?? null
}

export async function deleteSecret(key: SecretKey): Promise<void> {
  const backend = await resolveBackend()
  if (backend === 'keyring') {
    const mod = await loadKeyring()
    if (!mod) return
    try { const Entry = (mod as any).Entry; new Entry(SERVICE, key).deletePassword() } catch {}
    return
  }
  if (backend === 'vault') {
    if (!fs.existsSync(VAULT_PATH)) return
    const pass = process.env.SQUIDCLOUD_VAULT_PASSPHRASE ?? await promptPassphrase(false)
    if (!pass) return
    const secrets = vaultRead(pass)
    delete secrets[key]
    vaultWrite(pass, secrets)
    return
  }
  const secrets = plainRead()
  delete secrets[key]
  plainWrite(secrets)
}

/** One-time migration: pull legacy flat-file secrets into the active tier. */
export async function migrateLegacyFile(): Promise<void> {
  const legacyKeys = ['token', 'anon_key', 'sb_token'] as const
  let raw: Record<string, unknown>
  try { raw = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8')) } catch { return }
  const moved: Record<string, string> = {}
  for (const k of legacyKeys) {
    const v = raw[k]
    if (typeof v === 'string' && v) moved[k] = v
  }
  if (!Object.keys(moved).length) return
  for (const [k, v] of Object.entries(moved)) {
    await setSecret(k as SecretKey, v)
    delete raw[k]
  }
  writeMeta(raw as MetaFile)
}
