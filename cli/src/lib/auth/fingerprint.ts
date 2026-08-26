import { createHash, randomBytes } from 'node:crypto'
import os from 'node:os'
import { readFileSync, existsSync } from 'node:fs'
import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '../crypto/ssp.js'

const MACHINE_ID_PATHS = [
  '/etc/machine-id',
  '/var/lib/dbus/machine-id',
  '/etc/hostid',
]

function getMachineId(): string {
  for (const p of MACHINE_ID_PATHS) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf-8').trim()
      }
    } catch {
      continue
    }
  }
  const h = createHash('sha256').update(os.hostname() + os.arch() + os.platform()).digest('hex')
  return h
}

export function computeDeviceFingerprint(): string {
  const machineId = getMachineId()
  const components = [
    machineId,
    os.hostname(),
    os.platform(),
    os.arch(),
    os.release(),
  ]
  const data = components.join(':')
  return bytesToHex(blake3(new TextEncoder().encode(data)))
}

export function generateDeviceId(): string {
  return randomBytes(32).toString('hex')
}
