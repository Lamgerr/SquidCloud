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

etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs))

const HKDF_INFO = 'squidcloud-session-v1'




































export function generateKeypair() {
  const priv = edUtils.randomPrivateKey()
  const pub = getPublicKey(priv)
  return { pub, priv }
}

export function generateNonce() {
  return randomBytes(32)
}

export function hashPassword(password, email) {
  const salt = Buffer.from(email.slice(0, 32).padEnd(32, '\x00'))
  return pbkdf2Sync(password, salt, 100000, 32, 'sha512')
}

export function computeDeviceFingerprint(machineId) {
  const data = `${machineId}:${hostname()}:${platform()}:${arch()}`
  return Buffer.from(blake3(new TextEncoder().encode(data))).toString('hex')
}

export function computeSignPayload(clientNonce, serverNonce, clientPub, timestamp) {
  const payload = new Uint8Array(clientNonce.length + serverNonce.length + clientPub.length + 8)
  payload.set(clientNonce, 0)
  payload.set(serverNonce, clientNonce.length)
  payload.set(clientPub, clientNonce.length + serverNonce.length)
  const tsBuf = new Uint8Array(8)
  new DataView(tsBuf.buffer).setBigUint64(0, BigInt(timestamp), false)
  payload.set(tsBuf, clientNonce.length + serverNonce.length + clientPub.length)
  return blake3(payload)
}

export function deriveSharedSecret(pub, priv) {
  return x25519.getSharedSecret(priv, pub)
}

export function deriveEncryptionKey(ecdhSecret, clientNonce, serverNonce) {
  const salt = new Uint8Array(clientNonce.length + serverNonce.length)
  salt.set(clientNonce, 0)
  salt.set(serverNonce, clientNonce.length)
  return hkdf(sha256, ecdhSecret, salt, new TextEncoder().encode(HKDF_INFO), 32)
}

export function encryptSession(session, key) {
  const iv = randomBytes(12)
  const plaintext = new TextEncoder().encode(JSON.stringify(session))
  const aes = gcm(key, iv)
  const encrypted = aes.encrypt(plaintext)
  const ciphertext = encrypted.slice(0, -16)
  const tag = encrypted.slice(-16)
  return { ciphertext, iv, tag }
}

export function decryptSession(encrypted, iv, tag, key) {
  const combined = new Uint8Array(encrypted.length + tag.length)
  combined.set(encrypted, 0)
  combined.set(tag, encrypted.length)
  const aes = gcm(key, iv)
  const plaintext = aes.decrypt(combined)
  return JSON.parse(new TextDecoder().decode(plaintext)) 
}

export function verifyServerSignature(signature, payload, serverPub) {
  return verify(signature, payload, serverPub)
}

export function signPayload(priv, payload) {
  return sign(payload, priv)
}

export function computeHMAC(key, data) {
  return Buffer.from(hmac(sha256, key, new TextEncoder().encode(data))).toString('hex')
}

export function bytesToHex(buf) {
  return Buffer.from(buf).toString('hex')
}

export function hexToBytes(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'))
}
