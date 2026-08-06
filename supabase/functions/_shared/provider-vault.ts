// Shared provider-credential vault helpers.
// KEK scheme mirrors file-key-vault-v1: master key from SQUIDVEIL_MASTER_KEY
// (64-hex) or derived from sha256("squidveil-master-v1:" + serviceKey),
// then purpose separator 'provider-cred-vault-v1' via HMAC-SHA256.
// Wraps are AES-256-GCM with a random 12-byte IV (base64-encoded with the ct).

const encoder = new TextEncoder();

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64Decode(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const keyObj = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", keyObj, encoder.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getMasterKey(serviceKey: string): Promise<Uint8Array> {
  const env = Deno.env.get("SQUIDVEIL_MASTER_KEY");
  if (env && /^[0-9a-f]{64}$/i.test(env)) return fromHex(env);
  return fromHex(await sha256Hex(encoder.encode("squidveil-master-v1:" + serviceKey)));
}

export async function getProviderKek(serviceKey: string): Promise<Uint8Array> {
  const master = await getMasterKey(serviceKey);
  return fromHex(await hmacSha256Hex(master, "provider-cred-vault-v1"));
}

export async function wrapProviderCreds(
  serviceKey: string,
  plaintext: string
): Promise<{ wrapped: string; iv: string }> {
  const kek = await getProviderKek(serviceKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyObj = await crypto.subtle.importKey("raw", kek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, encoder.encode(plaintext));
  return { wrapped: base64Encode(new Uint8Array(ct)), iv: base64Encode(iv) };
}

export async function unwrapProviderCreds(
  serviceKey: string,
  wrapped: string,
  iv: string
): Promise<string> {
  const kek = await getProviderKek(serviceKey);
  const keyObj = await crypto.subtle.importKey("raw", kek, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(iv) },
    keyObj,
    base64Decode(wrapped)
  );
  return new TextDecoder().decode(pt);
}

// Fetches a provider's credentials from the vault and returns them as an object.
// Falls back to the legacy `encrypted_credentials` plaintext column if no vault
// row exists yet (e.g. pre-migration providers). Throws on any failure.
export async function getProviderCredentials(
  supabase: any,
  serviceKey: string,
  providerRow: any
): Promise<Record<string, string>> {
  if (providerRow.encrypted_credentials) {
    const legacy = providerRow.encrypted_credentials;
    let isLegacyBlob = false;
    try {
      const parsed = JSON.parse(legacy);
      isLegacyBlob = typeof parsed?.nonce === "string";
    } catch { /* plaintext */ }
    if (!isLegacyBlob) {
      return JSON.parse(legacy);
    }
    throw new Error("Legacy encrypted blob cannot be decrypted; re-add the provider");
  }

  const { data: vaultRow, error } = await supabase
    .from("storage_provider_vault")
    .select("wrapped_credentials, iv")
    .eq("provider_id", providerRow.id)
    .maybeSingle();

  if (error || !vaultRow?.wrapped_credentials || !vaultRow?.iv) {
    throw new Error("Provider credentials are not available");
  }

  const plaintext = await unwrapProviderCreds(serviceKey, vaultRow.wrapped_credentials, vaultRow.iv);
  return JSON.parse(plaintext);
}
