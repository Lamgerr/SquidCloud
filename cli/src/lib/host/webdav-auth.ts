import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import chalk from 'chalk'
import { getSecret, setSecret } from '../secrets/store.js'

/**
 * User-generated WebDAV password for SquidFS.
 *
 * The plaintext lives only in the OS secret store (Tier 1/2) — the squidfs
 * binary receives a PBKDF2-SHA256 hash file (0600), never the password.
 * Format matches internal/webdav/server.go ParsePbkdf2HashFile:
 *   pbkdf2$sha256$<iters>$<saltB64>$<hashB64>
 */

const HASH_PATH = path.join(os.homedir(), '.squidcloud', 'webdav-auth')
const ITERATIONS = 210_000

function pbkdf2Hash(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
  return `pbkdf2$sha256$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`
}

function generatePassword(): string {
  // Unambiguous alphabet — no 0/O, 1/l/I confusion over WebDAV clients.
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz!@#$%^&*'
  const bytes = crypto.randomBytes(20)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

async function promptPassword(): Promise<string | null> {
  if (!process.stdin.isTTY || process.env.SQUIDCLOUD_NONINTERACTIVE === '1') return null
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q: string) => new Promise<string>(res => rl.question(q, res))
  try {
    const pass = await ask('  WebDAV password (input visible — generated passwords are safer): ')
    return pass.length >= 8 ? pass : null
  } finally { rl.close() }
}

export interface WebdavAuthResult {
  hashPath: string
  freshPassword?: string // shown once when auto-generated
}

export async function ensureWebdavAuth(opts: Record<string, unknown>): Promise<WebdavAuthResult> {
  let password = typeof opts.password === 'string' && opts.password ? opts.password : null
  let fresh: string | undefined

  if (password) {
    await setSecret('webdav', password)
  } else {
    password = (await getSecret('webdav')) ?? null
    if (!password) {
      if (opts['no-password'] || opts.nopassword) {
        fs.rmSync(HASH_PATH, { force: true })
        return { hashPath: '' }
      }
      if (process.env.SQUIDCLOUD_NONINTERACTIVE === '1' || !process.stdin.isTTY) {
        throw new Error('WebDAV password required: pass --password or run interactively to generate one')
      }
      password = generatePassword()
      fresh = password
      await setSecret('webdav', password)
    }
  }

  fs.mkdirSync(path.dirname(HASH_PATH), { recursive: true, mode: 0o700 })
  fs.writeFileSync(HASH_PATH, pbkdf2Hash(password!), { mode: 0o600 })
  return { hashPath: HASH_PATH, freshPassword: fresh }
}
