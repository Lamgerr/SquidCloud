export type SubstrateTier = "DEEP" | "PERSISTENT" | "SWARM" | "SURFACE" | "FRAGILE";
export type Locator = Uint8Array; // opaque — CID, tx_id, magnet, URL, etc.

export interface SubstrateHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface StorageSubstrate {
  id: string;
  tier: SubstrateTier;
  anonymity: number; // 0-5
  maxPayload: number;
  avgLatency: number;
  health: number; // 0..1 EWMA
  put(chunkId: Uint8Array, payload: Uint8Array): Promise<Locator>;
  get(locator: Locator): Promise<Uint8Array>;
  probe(): Promise<SubstrateHealth>;
}
