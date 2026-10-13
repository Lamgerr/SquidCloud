import type { StorageSubstrate, SubstrateHealth, Locator } from "../base.ts";
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2";

/* Nostr relay substrate — the keyless internet tier.
 *
 * No accounts, no API keys: per chunk we derive an ephemeral secp256k1
 * identity (sha256("sde-nostr-v1" || chunkId)), split the envelope into
 * ~48KB parts, and publish each part as a kind-30078 parameterized
 * replaceable event (idempotent retries) to a pool of public relays.
 * Reads re-derive the identity and query by author — any device holding
 * the file's blob secret can do this, so dispersal is account-portable.
 *
 * Scale posture for hundreds of users: fixed relay pool with per-relay
 * health scoring + backoff, write quorum (2 relays must ACK every part),
 * replaceable events (retries never duplicate). Public relays absorb this
 * volume as noise; a relay that starts rejecting is skipped automatically.
 */

const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
  "wss://relay.mostr.pub",
  "wss://nostr-pub.wellorder.net",
  "wss://relay.noswhere.com",
  "wss://offchain.pub",
];

const PART_BYTES = 48 * 1024;
const KIND = 30078;
const RELAY_TIMEOUT_MS = 12000;
const BACKOFF_MS = 5 * 60 * 1000;

const hexOf = (b: Uint8Array): string =>
  Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");

function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface RelayState {
  url: string;
  fails: number;
  skipUntil: number;
  latency: number;
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function buildIdentity(chunkId: Uint8Array): { sk: Uint8Array; pkHex: string } {
  const pre = new Uint8Array(12 + chunkId.length);
  pre.set(new TextEncoder().encode("sde-nostr-v1"), 0);
  pre.set(chunkId, 12);
  const sk = nobleSha256(pre);
  const pkHex = hexOf(schnorr.getPublicKey(sk));
  return { sk, pkHex };
}

function signEvent(sk: Uint8Array, pubkey: string, created: number, tags: string[][], content: string): NostrEvent {
  const id = hexOf(nobleSha256(new TextEncoder().encode(JSON.stringify([0, pubkey, created, KIND, tags, content]))));
  const sig = hexOf(schnorr.sign(hexToBytes(id), sk));
  return { id, pubkey, created_at: created, kind: KIND, tags, content, sig };
}

function sendOnce(url: string, msg: unknown, opts: { timeoutMs: number; okId?: string; eoseSub?: string }): Promise<any[]> {
  const { timeoutMs, okId, eoseSub } = opts;
  return new Promise((resolve) => {
    const received: any[] = [];
    let done = false;
    let ws: WebSocket;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(kill);
      try { ws.close(); } catch {}
      resolve(received);
    };
    try {
      ws = new WebSocket(url);
    } catch (e: any) {
      resolve([{ error: String(e?.message || e) }]);
      return;
    }
    const kill = setTimeout(finish, timeoutMs);
    ws.onopen = () => {
      try { ws.send(JSON.stringify(msg)); } catch { finish(); }
    };
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse((m as MessageEvent).data);
        received.push(d);
        if (okId && Array.isArray(d) && d[0] === "OK" && d[1] === okId) finish();
        else if (eoseSub && Array.isArray(d) && d[0] === "EOSE" && d[1] === eoseSub) finish();
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => finish();
  });
}

export class NostrSubstrate implements StorageSubstrate {
  id = "NOSTR_RELAYS";
  tier = "SWARM" as const;
  anonymity = 5;
  maxPayload = 8 * 1024 * 1024;
  avgLatency = 1500;
  health = 1;

  private relays: RelayState[] = RELAYS.map(url => ({ url, fails: 0, skipUntil: 0, latency: 1500 }));
  private okCount = 0;
  private failCount = 0;

  private liveRelays(): RelayState[] {
    const now = Date.now();
    return this.relays.filter(r => r.skipUntil <= now);
  }

  private noteResult(r: RelayState, ok: boolean, latencyMs: number) {
    if (ok) {
      this.okCount++;
      r.fails = 0;
      r.latency = r.latency * 0.7 + latencyMs * 0.3;
    } else {
      this.failCount++;
      r.fails++;
      if (r.fails >= 3) r.skipUntil = Date.now() + BACKOFF_MS;
    }
    const total = this.okCount + this.failCount;
    this.health = total === 0 ? 1 : Math.max(0.05, this.okCount / total);
  }

  private publishAll(r: RelayState, events: NostrEvent[]): Promise<boolean> {
    // One socket per relay, all events pipelined back-to-back; OKs stream
    // in and we close as soon as every event is ACKed. This turns ~22
    // sequential round-trips into roughly one.
    const t0 = Date.now();
    return new Promise((resolve) => {
      const pending = new Set(events.map(e => e.id));
      let settled = false;
      let ws: WebSocket;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(kill);
        try { ws.close(); } catch {}
        this.noteResult(r, ok, Date.now() - t0);
        resolve(ok);
      };
      const kill = setTimeout(() => done(false), RELAY_TIMEOUT_MS);
      try {
        ws = new WebSocket(r.url);
      } catch {
        done(false);
        return;
      }
      ws.onopen = () => {
        try {
          for (const ev of events) ws.send(JSON.stringify(["EVENT", ev]));
        } catch { done(false); }
      };
      ws.onmessage = (m) => {
        try {
          const d = JSON.parse((m as MessageEvent).data);
          if (Array.isArray(d) && d[0] === "OK" && pending.has(d[1])) {
            if (d[2] === true) {
              pending.delete(d[1]);
              if (pending.size === 0) done(true);
            } else {
              done(false); // explicit reject (e.g. auth-walled relay)
            }
          }
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => done(false);
    });
  }

  async put(chunkId: Uint8Array, payload: Uint8Array): Promise<Locator> {
    const { sk, pkHex } = buildIdentity(chunkId);
    const chunkHex = hexOf(chunkId.slice(0, 20));
    const n = Math.max(1, Math.ceil(payload.length / PART_BYTES));
    const created = Math.floor(Date.now() / 1000);
    const events: NostrEvent[] = [];
    for (let i = 0; i < n; i++) {
      const part = payload.subarray(i * PART_BYTES, Math.min((i + 1) * PART_BYTES, payload.length));
      const d = `sde1:${chunkHex}:${i}/${n}`;
      events.push(signEvent(sk, pkHex, created, [["d", d], ["chunk", chunkHex], ["part", `${i}/${n}`]], b64encode(part)));
    }
    // Publish the whole chunk over one socket per relay; a relay counts
    // as covering the chunk only if it ACKs every part (write quorum).
    const live = this.liveRelays();
    if (live.length === 0) throw new Error("no nostr relays currently reachable");
    const cover = await Promise.all(live.map(r => this.publishAll(r, events)));
    const covering = cover.filter(Boolean).length;
    if (covering < 2) throw new Error(`nostr write quorum missed (${covering}/2 relays confirmed)`);
    return chunkId;
  }

  async get(locator: Locator): Promise<Uint8Array> {
    const { pkHex } = buildIdentity(locator);
    const prefix = `sde1:${hexOf(locator.slice(0, 20))}:`;
    const live = this.liveRelays();
    if (live.length === 0) throw new Error("no nostr relays currently reachable");
    const subId = `sde${Math.floor(Math.random() * 1e9)}`;
    const results = await Promise.all(live.map(async (r) => {
      const t0 = Date.now();
      try {
        const resps = await sendOnce(r.url, ["REQ", subId, { kinds: [KIND], authors: [pkHex], limit: 100 }], { timeoutMs: RELAY_TIMEOUT_MS, eoseSub: subId });
        const parts = new Map<number, { total: number; bytes: Uint8Array }>();
        for (const d of resps) {
          if (!Array.isArray(d) || d[0] !== "EVENT" || !d[2]) continue;
          const ev = d[2] as { content?: string; tags?: string[][] };
          const dTag = (ev.tags || []).find(t => t[0] === "d")?.[1] || "";
          if (!dTag.startsWith(prefix)) continue;
          const m = dTag.slice(prefix.length).match(/^(\d+)\/(\d+)$/);
          if (!m) continue;
          try {
            parts.set(Number(m[1]), { total: Number(m[2]), bytes: b64decode(ev.content || "") });
          } catch { /* corrupt part */ }
        }
        if (parts.size === 0) { this.noteResult(r, false, Date.now() - t0); return null; }
        const total = [...parts.values()][0].total;
        if (parts.size < total) { this.noteResult(r, false, Date.now() - t0); return null; }
        const out: number[] = [];
        for (let i = 0; i < total; i++) {
          const p = parts.get(i);
          if (!p) { this.noteResult(r, false, Date.now() - t0); return null; }
          out.push(...p.bytes);
        }
        this.noteResult(r, true, Date.now() - t0);
        return new Uint8Array(out);
      } catch {
        this.noteResult(r, false, Date.now() - t0);
        return null;
      }
    }));
    const hit = results.find(r => r && r.length > 0);
    if (!hit) throw new Error("nostr miss on all relays");
    return hit;
  }

  async probe() {
    const live = this.liveRelays();
    if (live.length === 0) return { ok: false, latencyMs: 0, error: "all relays in backoff" };
    const t0 = Date.now();
    const subId = `sdep${Math.floor(Math.random() * 1e9)}`;
    const settled = await Promise.allSettled(live.slice(0, 3).map(r =>
      sendOnce(r.url, ["REQ", subId, { kinds: [KIND], limit: 1 }], { timeoutMs: 5000, eoseSub: subId })
    ));
    const ok = settled.some(s => s.status === "fulfilled" && (s.value as any[]).length > 0);
    return ok ? { ok: true, latencyMs: Date.now() - t0 } : { ok: false, latencyMs: 0, error: "no relay answered" };
  }
}
