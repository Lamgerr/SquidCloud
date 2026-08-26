import { createHash } from 'node:crypto'

const PINNED_PUB_KEY_HASHES: string[] = [
  // SquidCloud Vercel deployment — update as needed
  // SHA-256 hash of the expected server public key
]

const API_BASE =
  process.env.SQUIDCLOUD_API_BASE ||
  'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api'

export function addPinnedKeyHash(hash: string): void {
  PINNED_PUB_KEY_HASHES.push(hash.toLowerCase())
}

function getExpectedSPKI(): string | null {
  return process.env.SQUIDCLOUD_CERT_PIN || null
}

export function validateCertPin(peerCertificate: { raw: Buffer }): boolean {
  if (PINNED_PUB_KEY_HASHES.length === 0 && !getExpectedSPKI()) return true
  const der = peerCertificate.raw
  const sha256 = createHash('sha256').update(der).digest('base64')
  const expectedPin = getExpectedSPKI()
  if (expectedPin && sha256 === expectedPin) return true
  if (PINNED_PUB_KEY_HASHES.includes(sha256)) return true
  return false
}

export function getApiBase(): string {
  return API_BASE
}
