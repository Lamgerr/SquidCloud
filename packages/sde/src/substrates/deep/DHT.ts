import type { StorageSubstrate, SubstrateHealth, Locator } from "../base.ts";

const LS_PREFIX = "sde_dht_";
const CID_MAP_PREFIX = "sde_cid_";
const isBrowser = typeof globalThis !== "undefined" && typeof localStorage !== "undefined";

function lsGet(key: string): Uint8Array | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(LS_PREFIX + key);
  if (!raw) return null;
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function lsSet(key: string, value: Uint8Array): void {
  if (!isBrowser) return;
  let s = "";
  for (let i = 0; i < value.length; i++) s += String.fromCharCode(value[i]);
  try { localStorage.setItem(LS_PREFIX + key, s); } catch {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) keys.push(k);
    }
    keys.sort();
    const toRemove = Math.max(1, Math.ceil(keys.length * 0.2));
    for (let i = 0; i < toRemove; i++) localStorage.removeItem(keys[i]);
    localStorage.setItem(LS_PREFIX + key, s);
  }
}

function cidMapGet(key: string): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(CID_MAP_PREFIX + key);
}
function cidMapSet(key: string, cid: string): void {
  if (!isBrowser) return;
  try { localStorage.setItem(CID_MAP_PREFIX + key, cid); } catch {}
}

function keyToHex(id: Uint8Array): string {
  return Array.from(id.slice(0, 20)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const GATEWAYS = [
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
  "https://ipfs.scarred.nl",
];

/**
 * IPFS gateway substrate — local cache first, public-gateway reads as fallback.
 * Public gateways are READ-ONLY (/ipfs/<cid>); they do not expose the Kubo RPC
 * (/api/v0/*, no CORS), so there are deliberately no network writes here.
 * Remote durability requires a pinning service / local node (future work).
 * Works in any browser with no UDP, WebSocket, or server.
 */
export class DHTSubstrate implements StorageSubstrate {
  id = "IPFS_GATEWAY";
  tier = "DEEP" as const;
  anonymity = 5;
  maxPayload = 1024 * 1024;
  avgLatency = 500;
  health = 1;
  local = true;

  private mem = new Map<string, Uint8Array>();
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    // No initialization needed — gateways are public
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private async computeCID(payload: Uint8Array): Promise<string> {
    const { CID } = await import("multiformats/cid");
    const { sha256 } = await import("multiformats/hashes/sha2");
    const hash = await sha256.digest(payload);
    return CID.create(1, 0x55, hash).toString();
  }

  async put(chunkId: Uint8Array, payload: Uint8Array): Promise<Locator> {
    await this.ensureReady();
    const keyHex = keyToHex(chunkId);
    const copy = new Uint8Array(payload);

    // 1. Local cache
    this.mem.set(keyHex, copy);
    lsSet(keyHex, copy);

    // 2. Remote pin: public gateways expose reads only, so record the CID for
    // gateway reads. No network write is attempted here (see class docs).
    const cid = await this.computeCID(payload);
    cidMapSet(keyHex, cid);

    return chunkId;
  }

  async get(locator: Locator): Promise<Uint8Array> {
    await this.ensureReady();
    const keyHex = keyToHex(locator);

    // 1. Memory cache
    if (this.mem.has(keyHex)) return this.mem.get(keyHex)!;

    // 2. localStorage cache
    const cached = lsGet(keyHex);
    if (cached) {
      this.mem.set(keyHex, cached);
      return cached;
    }

    // 3. Public gateway reads (gateway path — /api/v0/* is not exposed publicly).
    const cid = cidMapGet(keyHex);
    if (cid) {
      let lastError: unknown = null;
      for (const gw of GATEWAYS) {
        try {
          const r = await fetch(`${gw}/ipfs/${cid}`, { signal: AbortSignal.timeout(15000) });
          if (r.ok) {
            const data = new Uint8Array(await r.arrayBuffer());
            this.mem.set(keyHex, data);
            lsSet(keyHex, data);
            return data;
          }
          lastError = new Error(`${gw} responded ${r.status}`);
        } catch (e) {
          lastError = e;
        }
      }
      console.warn(`[DHT] Gateway get failed for ${keyHex.slice(0, 8)}:`, lastError);
    }

    throw new Error(`DHT miss for ${keyHex} — not found on any backend`);
  }

  async probe(): Promise<SubstrateHealth> {
    await this.ensureReady();
    for (const gw of GATEWAYS) {
      try {
        const t0 = Date.now();
        const r = await fetch(`${gw}/`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) return { ok: true, latencyMs: Date.now() - t0 };
      } catch {}
    }
    return { ok: false, latencyMs: 0, error: "no IPFS gateway reachable" };
  }
}