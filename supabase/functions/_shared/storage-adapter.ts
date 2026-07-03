import { PrelContext } from './kza-prel.ts'

export interface ProviderResult {
  ref: string
  providerType: string
  url?: string
}

export interface StorageAdapter {
  readonly providerType: string
  store(ctx: PrelContext, blob: Uint8Array, meta?: Record<string, string>): Promise<ProviderResult>
  retrieve(ctx: PrelContext, ref: string): Promise<Uint8Array>
  delete(ctx: PrelContext, ref: string): Promise<boolean>
  maxBlobSize(): number
  health(): Promise<boolean>
}

const registry = new Map<string, StorageAdapter>()

export function registerAdapter(adapter: StorageAdapter): void {
  registry.set(adapter.providerType, adapter)
}

export function getAdapter(providerType: string): StorageAdapter | undefined {
  return registry.get(providerType)
}

export function listAdapters(): StorageAdapter[] {
  return Array.from(registry.values())
}

export function listAdapterTypes(): string[] {
  return Array.from(registry.keys())
}
