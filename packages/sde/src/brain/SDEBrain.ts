import type { StorageSubstrate } from "../substrates/base.ts";
import { getOrCreateDMS } from "../identity/DeviceMasterSecret.ts";
import { deriveIdentityRoot, deriveBlobSecret, deriveChunkId, deriveChunkKey, deriveRouteSeed, deriveRtSign } from "../identity/derivation.ts";
import { sha256 } from "../crypto/sha256.ts";
import { aesGcmEncrypt, aesGcmDecrypt } from "../crypto/aes.ts";
import { shake128Expand } from "../crypto/shake128.ts";
import { buildRecallToken, decodeToken, parseAndVerifyRecallToken, encodeToken } from "../recall/token.ts";

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff; b[1] = (n >>> 16) & 0xff; b[2] = (n >>> 8) & 0xff; b[3] = n & 0xff;
  return b;
}

const hexOf = (b: Uint8Array): string =>
  Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");

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

/** Structural + hash-prefix check for a 48B-header envelope. */
async function validEnvelope(blob: Uint8Array): Promise<boolean> {
  try {
    if (!blob || blob.length < 48) return false;
    const ctLen = (blob[40] << 24) | (blob[41] << 16) | (blob[42] << 8) | blob[43];
    if (ctLen <= 0 || ctLen > 16 * 1024 * 1024 || 48 + ctLen > blob.length) return false;
    const ct = blob.subarray(48, 48 + ctLen);
    const h = await sha256(ct);
    return h[0] === blob[44] && h[1] === blob[45] && h[2] === blob[46] && h[3] === blob[47];
  } catch {
    return false;
  }
}

export interface LocatorRecord {
  substrateId: string;
  chunkIndex: number;
  chunkHex: string;
  locatorB64: string;
}

export interface UploadOpts {
  /** fired once per confirmed substrate put (for locator persistence) */
  onLocator?: (rec: LocatorRecord) => void;
  /** minimum confirmed substrates per chunk before upload counts (default 1) */
  minConfirmations?: number;
  /** require at least one non-local confirmation (default false) */
  requireRemote?: boolean;
}

export interface DownloadOpts {
  fileName?: string;
  mimeType?: string;
  /** persisted placements, tried before deterministic routing */
  resolveLocator?: (index: number) => Promise<Array<{ substrateId: string; locatorB64: string }>>;
}

export class SDEBrain {
  constructor(private substrates: StorageSubstrate[] = []) {}

  setSubstrates(s: StorageSubstrate[]) { this.substrates = s; }

  private async pickSubstrates(routeSeed: Uint8Array, replication = 4): Promise<StorageSubstrate[]> {
    if (this.substrates.length === 0) throw new Error("no substrates configured");
    const expanded = await shake128Expand(routeSeed, 256);
    const scored = [...this.substrates].sort((a, b) => b.health - a.health);
    const picks: StorageSubstrate[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < replication * 4 && picks.length < replication; i++) {
      const window = (expanded[(i * 8) % 256] << 24) | (expanded[(i * 8 + 1) % 256] << 16) | (expanded[(i * 8 + 2) % 256] << 8) | expanded[(i * 8 + 3) % 256];
      const idx = Math.abs(window) % scored.length;
      const s = scored[idx];
      if (seen.has(s.id)) continue;
      // tier invariants: at least one DEEP, at least one PERSISTENT, at most one FRAGILE
      if (picks.length === replication - 1 && picks.filter(p => p.tier === "DEEP").length === 0 && s.tier !== "DEEP") continue;
      if (picks.filter(p => p.tier === "FRAGILE").length >= 1 && s.tier === "FRAGILE") continue;
      picks.push(s);
      seen.add(s.id);
    }
    // ensure invariants after loop
    if (picks.filter(p => p.tier === "DEEP").length === 0) {
      const deep = scored.find(s => s.tier === "DEEP");
      if (deep && !seen.has(deep.id)) { picks[0] = deep; }
    }
    if (picks.filter(p => p.tier === "PERSISTENT").length === 0) {
      const pers = scored.find(s => s.tier === "PERSISTENT");
      if (pers && !seen.has(pers.id)) { picks[1 % picks.length] = pers; }
    }
    return picks;
  }

  async upload(file: File, onChunk?: (i: number, total: number) => void, opts?: UploadOpts): Promise<{ recallToken: string; fileHash: string }> {
    const buf = new Uint8Array(await file.arrayBuffer());
    const fileHash = await sha256(buf);
    const dms = await getOrCreateDMS();
    const identityRoot = await deriveIdentityRoot(dms);
    const blobSecret = await deriveBlobSecret(identityRoot, fileHash);
    const rtSign = await deriveRtSign(identityRoot);

    const maxPayload = this.substrates.length ? Math.min(...this.substrates.map(s => s.maxPayload)) : 1024 * 1024;
    const chunkSize = Math.max(256 * 1024, Math.min(maxPayload, 8 * 1024 * 1024));
    const totalChunks = Math.max(1, Math.ceil(buf.length / chunkSize));

    const chunkIds: Uint8Array[] = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkIds.push(await deriveChunkId(blobSecret, i));
    }

    // Upload chunks with bounded parallelism (6 in flight):
    // per-chunk crypto is independent, and substrates handle concurrency.
    // Progress reports completed count so the bar stays monotonic.
    // Background-tier replicas (paste-hosts) lag the quorum path: they
    // settle in parallel and are awaited once at the end, so the slowest
    // host never gates any single chunk.
    const CONC = 6;
    let next = 0;
    let completed = 0;
    const background: Promise<void>[] = [];
    const processChunk = async (i: number): Promise<void> => {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buf.length);
      const plaintext = buf.subarray(start, end);
      const chunkKey = await deriveChunkKey(blobSecret, i);
      const chunkId = chunkIds[i];
      const routeSeed = await deriveRouteSeed(blobSecret, i);
      const nonceFull = await deriveChunkKey(blobSecret, i + 1000000); // domain-separated for nonce
      const nonce = nonceFull.subarray(0, 12);
      const aad = await sha256(new Uint8Array([...chunkId, ...u32be(i), ...u32be(totalChunks)]));
      const ciphertext = await aesGcmEncrypt(chunkKey, nonce, aad, plaintext);

      // envelope: [0-31:chunk_id][32-35:i][36-39:total][40-43:ct_len][44-47:hash][48+:ct] — outer envelope not encrypted, HMAC omitted here (AES-GCM tag covers)
      const envelope = new Uint8Array(48 + ciphertext.length);
      envelope.set(chunkId, 0);
      envelope.set(u32be(i), 32);
      envelope.set(u32be(totalChunks), 36);
      envelope.set(u32be(ciphertext.length), 40);
      const ctHash = await sha256(ciphertext);
      envelope.set(ctHash.subarray(0, 4), 44);
      envelope.set(ciphertext, 48);

      const targets = await this.pickSubstrates(routeSeed, 4);
      const inline = targets.filter(s => !s.background);
      const lazy = targets.filter(s => s.background);
      // Confirmed puts are recorded (locators persist outside the brain);
      // background substrates may fail — they simply don't confirm.
      const settled = await Promise.allSettled(
        inline.map(async (s) => ({ substrate: s, locator: await s.put(chunkId, envelope) }))
      );
      for (const s of lazy) {
        background.push(
          s.put(chunkId, envelope).then(locator => {
            try {
              opts?.onLocator?.({
                substrateId: s.id,
                chunkIndex: i,
                chunkHex: hexOf(chunkId.slice(0, 20)),
                locatorB64: b64encode(locator),
              });
            } catch { /* locator persistence is best-effort */ }
          }).catch(() => {})
        );
      }
      const confirmed = settled
        .filter((r): r is PromiseFulfilledResult<{ substrate: StorageSubstrate; locator: Uint8Array }> => r.status === "fulfilled")
        .map(r => r.value);
      const chunkHex = hexOf(chunkId.slice(0, 20));
      for (const c of confirmed) {
        try {
          opts?.onLocator?.({
            substrateId: c.substrate.id,
            chunkIndex: i,
            chunkHex,
            locatorB64: b64encode(c.locator),
          });
        } catch { /* locator persistence is best-effort */ }
      }
      const minConf = opts?.minConfirmations ?? 1;
      const remoteOk = confirmed.some(c => !c.substrate.local);
      if (confirmed.length < minConf || (opts?.requireRemote && !remoteOk)) {
        throw new Error(
          `storage network unreachable for chunk ${i} (${confirmed.length} confirmations) — kept locally only`
        );
      }
      completed++;
      onChunk?.(completed, totalChunks);
    };
    const workers = Array.from({ length: Math.min(CONC, totalChunks) }, async () => {
      while (true) {
        const i = next++;
        if (i >= totalChunks) return;
        await processChunk(i);
      }
    });
    await Promise.all(workers);
    // Let lagging background replicas finish before the token is built,
    // so their locators still get persisted by the caller.
    await Promise.allSettled(background);

    const tokenBytes = await buildRecallToken(blobSecret, rtSign, totalChunks, fileHash, buf.length);
    const recallToken = encodeToken(tokenBytes);
    const fileHashHex = Array.from(fileHash).map(b => b.toString(16).padStart(2, "0")).join("");
    return { recallToken, fileHash: fileHashHex };
  }

  async download(recallToken: string, onStream: (chunk: Uint8Array) => void, opts?: DownloadOpts): Promise<File> {
    const tokenBytes = decodeToken(recallToken);
    const dms = await getOrCreateDMS();
    const identityRoot = await deriveIdentityRoot(dms);
    const rtSign = await deriveRtSign(identityRoot);
    const fields = await parseAndVerifyRecallToken(tokenBytes, rtSign);

    const blobSecret = await deriveBlobSecret(identityRoot, fields.fileHash);
    const verifier = (await import("../identity/derivation.ts")).deriveVerifier;
    const expectedVerifier = await verifier(blobSecret);
    for (let i = 0; i < 16; i++) if (expectedVerifier[i] !== fields.verifier[i]) throw new Error("DMS does not match recall token (wrong device)");

    const chunks: Uint8Array[] = new Array(fields.totalChunks);
    const fetches = fields.totalChunks;

    await Promise.all(
      Array.from({ length: fetches }, async (_, i) => {
        let envelope: Uint8Array | null = null;
        // 0. Persisted placements first (survives fleet changes).
        if (opts?.resolveLocator) {
          try {
            const recs = await opts.resolveLocator(i);
            for (const rec of recs || []) {
              const s = this.substrates.find(x => x.id === rec.substrateId);
              if (!s) continue;
              try {
                const blob = await s.get(b64decode(rec.locatorB64));
                if (validEnvelope(blob)) { envelope = blob; break; }
              } catch { /* try next placement */ }
            }
          } catch { /* fall through to deterministic routing */ }
        }
        const chunkId = await deriveChunkId(blobSecret, i);
        const routeSeed = await deriveRouteSeed(blobSecret, i);
        const targets = await this.pickSubstrates(routeSeed, 4);
        // race top 3
        const race = targets.slice(0, 3);
        const errors: unknown[] = [];
        // try raced substrates first
        if (!envelope) {
          const raced = await Promise.allSettled(race.map(s => s.get(chunkId)));
          for (const r of raced) {
            if (r.status === "fulfilled" && r.value) { envelope = r.value; break; }
            if (r.status === "rejected") errors.push(r.reason);
          }
        }
        if (!envelope) {
          // try remaining
          for (const s of targets.slice(3)) {
            try { envelope = await s.get(chunkId); if (envelope) break; } catch (e) { errors.push(e); }
          }
        }
        // try next tier expansion if still missing — but skip the wait when
        // every substrate was already tried (otherwise single-substrate
        // setups stall 30s before reporting the miss).
        if (!envelope) {
          const untried = this.substrates.filter(s => !race.includes(s) && !targets.includes(s));
          if (untried.length > 0) {
            await new Promise(res => setTimeout(res, 30000));
            for (const s of untried) {
              try { envelope = await s.get(chunkId); if (envelope) break; } catch {}
            }
          }
        }
        if (!envelope) throw new Error(`chunk ${i} missing on all substrates`);

        const ctLen = (envelope[40] << 24) | (envelope[41] << 16) | (envelope[42] << 8) | envelope[43];
        const ciphertext = envelope.subarray(48, 48 + ctLen);
        const chunkKey = await deriveChunkKey(blobSecret, i);
        const nonceFull = await deriveChunkKey(blobSecret, i + 1000000);
        const nonce = nonceFull.subarray(0, 12);
        const aad = await sha256(new Uint8Array([...chunkId, ...u32be(i), ...u32be(fields.totalChunks)]));
        const plaintext = await aesGcmDecrypt(chunkKey, nonce, aad, ciphertext);
        chunks[i] = plaintext;
        onStream(plaintext);
      })
    );

    const totalLen = chunks.reduce((a, c) => a + (c?.length ?? 0), 0);
    if (chunks.some(c => !c)) throw new Error(`partial recovery: ${chunks.filter(c => !c).length} chunks missing`);
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }

    // self-healing: re-put chunks that came from FRAGILE/SWARM in background (fire-and-forget)
    // omitted for brevity — will be added with HealthMonitor

    const fileName = opts?.fileName ?? `sde-${fields.fileHash.slice(0, 8).join("")}`;
    return new File([out], fileName, { type: opts?.mimeType ?? "application/octet-stream" });
  }
}
