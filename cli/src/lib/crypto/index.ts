export { sanitizeForTerminal, sanitizeFilename, zeroBuffer, zeroString } from './sanitize.js'
export {
  generateKeypair,
  generateNonce,
  hashPassword,
  computeDeviceFingerprint,
  computeSignPayload,
  deriveSharedSecret,
  deriveEncryptionKey,
  encryptSession,
  decryptSession,
  verifyServerSignature,
  signPayload,
  computeHMAC,
  bytesToHex,
  hexToBytes,
} from './ssp.js'
export type { SSPHello, SSPResponse, SquidSession } from './ssp.js'
