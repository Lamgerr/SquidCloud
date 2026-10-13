import type { StorageSubstrate, SubstrateHealth, Locator } from "../base.ts";

/* Paste-host substrate — the expendable FRAGILE tier.
 *
 * Anonymous file hosts (uguu.se first, 0x0.st fallback) accept multi-MB
 * blobs with no account. Neither sends CORS headers, so browsers cannot
 * touch them directly: both directions go through our same-origin
 * `/api/paste-proxy` edge route, which forwards bytes server-side.
 * The locator IS the file URL — persisted in sde_chunk_locators, because
 * paste URLs are random and cannot be re-derived. Retention is
 * hours-to-weeks by host policy; this tier is a replica, never a home.
 */

const PROXY = "/api/paste-proxy";
const HOSTS = ["uguu", "0x0st"];
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const utf8dec = (b: Uint8Array): string => new TextDecoder().decode(b);

export class PasteSubstrate implements StorageSubstrate {
  id = "PASTE_HOSTS";
  tier = "FRAGILE" as const;
  anonymity = 4;
  maxPayload = 8 * 1024 * 1024;
  avgLatency = 2500;
  health = 1;

  private okCount = 0;
  private failCount = 0;

  private note(ok: boolean) {
    if (ok) this.okCount++;
    else this.failCount++;
    const total = this.okCount + this.failCount;
    this.health = total === 0 ? 1 : Math.max(0.05, this.okCount / total);
  }

  async put(chunkId: Uint8Array, payload: Uint8Array): Promise<Locator> {
    let lastErr = "";
    for (const host of HOSTS) {
      try {
        const res = await fetch(`${PROXY}?host=${host}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: payload as unknown as BodyInit,
        });
        if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
        const data = await res.json().catch(() => null);
        const url = typeof data?.url === "string" ? data.url : "";
        if (!url.startsWith("https://")) { lastErr = "bad locator"; continue; }
        this.note(true);
        return utf8(url);
      } catch (e: any) {
        lastErr = String(e?.message || e);
      }
    }
    this.note(false);
    throw new Error(`paste upload failed (${lastErr || "no host answered"})`);
  }

  async get(locator: Locator): Promise<Uint8Array> {
    const url = utf8dec(locator);
    if (!url.startsWith("https://")) throw new Error("bad paste locator");
    const res = await fetch(`${PROXY}?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`paste fetch HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("paste object empty (expired?)");
    this.note(true);
    return buf;
  }

  async probe(): Promise<SubstrateHealth> {
    try {
      const res = await fetch(`${PROXY}?host=uguu&probe=1`);
      return res.ok ? { ok: true, latencyMs: 0 } : { ok: false, latencyMs: 0, error: `proxy HTTP ${res.status}` };
    } catch (e: any) {
      return { ok: false, latencyMs: 0, error: String(e?.message || e) };
    }
  }
}
