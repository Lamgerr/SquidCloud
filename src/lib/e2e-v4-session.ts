/** In-memory E2E v4 master secret. Never persisted, never sent to a server. */
import { secureClear } from '@/services/byok-encryption';

let masterRaw: Uint8Array | null = null;

export function setV4Master(raw: Uint8Array): void {
  clearV4Master();
  masterRaw = new Uint8Array(raw);
}

export function getV4Master(): Uint8Array | null {
  return masterRaw ? new Uint8Array(masterRaw) : null;
}

export function clearV4Master(): void {
  if (masterRaw) secureClear(masterRaw);
  masterRaw = null;
}

export function hasV4Master(): boolean {
  return masterRaw !== null;
}
