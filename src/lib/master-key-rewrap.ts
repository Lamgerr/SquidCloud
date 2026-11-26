/** Rewrap a master key without changing the master key or any file ciphertext. */
export type WrappedMaster = {
  wrapped: string;
  iv: string;
  salt: string;
  iterations: number;
  version: number;
};

type RewrapResult = {
  ok: boolean;
  next: WrappedMaster | null;
  masterRaw: Uint8Array | null;
};

const ITERATIONS = 310_000;

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function deriveKey(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

export async function rewrapMasterKey(
  wrapped: WrappedMaster | null,
  currentPassword: string,
  newPassword: string,
  master?: Uint8Array,
): Promise<RewrapResult> {
  try {
    let masterRaw: Uint8Array;
    if (master) {
      masterRaw = new Uint8Array(master);
    } else {
      if (!wrapped?.wrapped || !wrapped.salt || !wrapped.iv) return { ok: false, next: null, masterRaw: null };
      const salt = fromBase64(wrapped.salt);
      const iv = fromBase64(wrapped.iv);
      const key = await deriveKey(currentPassword, salt, wrapped.iterations || ITERATIONS);
      let plain: ArrayBuffer;
      try {
        plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(wrapped.wrapped));
      } catch (e: any) {
        throw new Error(`decrypt failed: ${e?.name || e}`);
      }
      const view = new Uint8Array(plain);
      masterRaw = new Uint8Array(view.byteLength);
      for (let i = 0; i < view.length; i++) masterRaw[i] = view[i];
    }

    const newSalt = crypto.getRandomValues(new Uint8Array(32));
    const newIv = crypto.getRandomValues(new Uint8Array(12));
    const newKey = await deriveKey(newPassword, newSalt);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: newIv }, newKey, masterRaw);
    return {
      ok: true,
      masterRaw,
      next: {
        wrapped: toBase64(new Uint8Array(encrypted)),
        iv: toBase64(newIv),
        salt: toBase64(newSalt),
        iterations: ITERATIONS,
        version: (wrapped?.version || 1) + 1,
      },
    };
  } catch (e: any) {
    return { ok: false, next: null, masterRaw: null };
  }
}
