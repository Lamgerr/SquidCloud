import { getPublicKey, sign, verify, etc, utils as edUtils } from '@noble/ed25519'
import { x25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { sha512 } from '@noble/hashes/sha2.js'
import { hmac } from '@noble/hashes/hmac.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { randomBytes, concatBytes } from '@noble/hashes/utils.js'
import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2Sync } from 'node:crypto'
import { hostname, platform, arch } from 'node:os'

etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(concatBytes(...msgs))

const HKDF_INFO = 'squidcloud-session-v1'

export interface SSPHello {
  email: string
  password_proof: string
  client_ephemeral_pub: string
  client_nonce: string
  device_fingerprint: string
  timestamp: number
}

export interface SSPResponse {
  server_nonce: string
  server_ephemeral_pub: string
  server_signature: string
  encrypted_session: string
  session_iv: string
  session_tag: string
}

export interface SquidSession {
  session_id: string
  access_token: string
  refresh_token: string
  refresh_token_id: string
  device_fingerprint: string
  issued_at: number
  expires_at: number
  user: {
    id: string
    email: string
    username: string
    plan: 'free' | 'pro' | 'team'
  }
  api_key?: string
}

export function generateKeypair(): { pub: Uint8Array; priv: Uint8Array } {
  const priv = edUtils.randomPrivateKey()
  const pub = getPublicKey(priv)
  return { pub, priv }
}

export function generateNonce(): Uint8Array {
  return randomBytes(32)
}

export function hashPassword(password: string, email: string): Buffer {
  const salt = Buffer.from(email.slice(0, 32).padEnd(32, '\x00'))
  return pbkdf2Sync(password, salt, 100000, 32, 'sha512')
}

export function computeDeviceFingerprint(machineId: string): string {
  const data = `${machineId}:${hostname()}:${platform()}:${arch()}`
  return Buffer.from(blake3(new TextEncoder().encode(data))).toString('hex')
}

export function computeSignPayload(clientNonce: Uint8Array, serverNonce: Uint8Array, clientPub: Uint8Array, timestamp: number): Uint8Array {
  const payload = new Uint8Array(clientNonce.length + serverNonce.length + clientPub.length + 8)
  payload.set(clientNonce, 0)
  payload.set(serverNonce, clientNonce.length)
  payload.set(clientPub, clientNonce.length + serverNonce.length)
  const tsBuf = new Uint8Array(8)
  new DataView(tsBuf.buffer).setBigUint64(0, BigInt(timestamp), false)
  payload.set(tsBuf, clientNonce.length + serverNonce.length + clientPub.length)
  return blake3(payload)
}

export function deriveSharedSecret(pub: Uint8Array, priv: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(priv, pub)
}

export function deriveEncryptionKey(ecdhSecret: Uint8Array, clientNonce: Uint8Array, serverNonce: Uint8Array): Uint8Array {
  const salt = new Uint8Array(clientNonce.length + serverNonce.length)
  salt.set(clientNonce, 0)
  salt.set(serverNonce, clientNonce.length)
  return hkdf(sha256, ecdhSecret, salt, new TextEncoder().encode(HKDF_INFO), 32)
}

export function encryptSession(session: SquidSession, key: Uint8Array): { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array } {
  const iv = randomBytes(12)
  const plaintext = new TextEncoder().encode(JSON.stringify(session))
  const aes = gcm(key, iv)
  const encrypted = aes.encrypt(plaintext)
  const ciphertext = encrypted.slice(0, -16)
  const tag = encrypted.slice(-16)
  return { ciphertext, iv, tag }
}

export function decryptSession(encrypted: Uint8Array, iv: Uint8Array, tag: Uint8Array, key: Uint8Array): SquidSession {
  const combined = new Uint8Array(encrypted.length + tag.length)
  combined.set(encrypted, 0)
  combined.set(tag, encrypted.length)
  const aes = gcm(key, iv)
  const plaintext = aes.decrypt(combined)
  return JSON.parse(new TextDecoder().decode(plaintext)) as SquidSession
}

export function verifyServerSignature(signature: Uint8Array, payload: Uint8Array, serverPub: Uint8Array): boolean {
  return verify(signature, payload, serverPub)
}

export function signPayload(priv: Uint8Array, payload: Uint8Array): Uint8Array {
  return sign(payload, priv)
}

export function computeHMAC(key: Uint8Array, data: string): string {
  return Buffer.from(hmac(sha256, key, new TextEncoder().encode(data))).toString('hex')
}

export function bytesToHex(buf: Uint8Array): string {
  return Buffer.from(buf).toString('hex')
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'))
}
