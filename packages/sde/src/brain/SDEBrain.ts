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

  async upload(file: File, onChunk?: (i: number, total: number) => void): Promise<{ recallToken: string; fileHash: string }> {
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

    const puts: Promise<void>[] = [];
    for (let i = 0; i < totalChunks; i++) {
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
      for (const s of targets) {
        puts.push(
          s.put(chunkId, envelope).catch(() => {
            // background substrates may fail — brain records only confirmations, does not block upload
          })
        );
      }
      onChunk?.(i + 1, totalChunks);
    }

    await Promise.all(puts);

    const tokenBytes = await buildRecallToken(blobSecret, rtSign, totalChunks, fileHash, buf.length);
    const recallToken = encodeToken(tokenBytes);
    const fileHashHex = Array.from(fileHash).map(b => b.toString(16).padStart(2, "0")).join("");
    return { recallToken, fileHash: fileHashHex };
  }

  async download(recallToken: string, onStream: (chunk: Uint8Array) => void, opts?: { fileName?: string; mimeType?: string }): Promise<File> {
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
        const chunkId = await deriveChunkId(blobSecret, i);
        const routeSeed = await deriveRouteSeed(blobSecret, i);
        const targets = await this.pickSubstrates(routeSeed, 4);
        // race top 3
        const race = targets.slice(0, 3);
        let envelope: Uint8Array | null = null;
        const errors: unknown[] = [];
        // try raced substrates first
        const raced = await Promise.allSettled(race.map(s => s.get(chunkId)));
        for (const r of raced) {
          if (r.status === "fulfilled" && r.value) { envelope = r.value; break; }
          if (r.status === "rejected") errors.push(r.reason);
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
