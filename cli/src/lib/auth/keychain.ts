import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { randomBytes } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { gcm } from '@noble/ciphers/aes.js'
import { bytesToHex, hexToBytes } from '../crypto/ssp.js'
import { computeDeviceFingerprint } from './fingerprint.js'

const FALLBACK_DIR = path.join(os.homedir(), '.squidcloud')
const FALLBACK_FILE = path.join(FALLBACK_DIR, '.session')

function getFallbackKey(): Uint8Array {
  const fingerprint = computeDeviceFingerprint()
  const ikm = new TextEncoder().encode(fingerprint)
  return hkdf(sha256, ikm, new Uint8Array(32), new TextEncoder().encode('squidcloud-fallback-v1'), 32)
}

export async function storeSession(sessionJson: string): Promise<void> {
  const key = getFallbackKey()
  const iv = randomBytes(12)
  const plaintext = new TextEncoder().encode(sessionJson)
  const aes = gcm(key, iv)
  const encrypted = aes.encrypt(plaintext)
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true, mode: 0o700 })
  }
  const payload = {
    iv: bytesToHex(iv),
    data: bytesToHex(encrypted),
  }
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(payload), { mode: 0o600, encoding: 'utf-8' })
}

export async function getSession(): Promise<string | null> {
  try {
    if (!fs.existsSync(FALLBACK_FILE)) return null
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8')
    const { iv, data } = JSON.parse(raw) as { iv: string; data: string }
    const key = getFallbackKey()
    const aes = gcm(key, hexToBytes(iv))
    const decrypted = aes.decrypt(hexToBytes(data))
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      fs.unlinkSync(FALLBACK_FILE)
    }
  } catch {
    // ignore
  }
}
