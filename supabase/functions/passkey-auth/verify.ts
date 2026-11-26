/** Pure WebAuthn assertion verifier, shared by the edge function and tests. */

type Credential = {
  id?: string;
  response?: {
    clientDataJSON?: string;
    authenticatorData?: string;
    signature?: string;
  };
};

export type VerifyAssertionInput = {
  credential: Credential;
  challenge: string;
  origin: string;
  publicKeyJwk: JsonWebKey;
  rpIdHash?: Uint8Array;
};

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i];
  for (let i = 0; i < b.length; i++) out[a.length + i] = b[i];
  return out;
}

export async function verifyAssertion(input: VerifyAssertionInput): Promise<boolean> {
  try {
    const response = input.credential?.response;
    if (!response?.clientDataJSON || !response.authenticatorData || !response.signature) return false;
    // Exported JWKs carry `key_ops: []` / `ext`, which importKey rejects.
    // Strip metadata fields before importing a public key for verification.
    const jwk: JsonWebKey = { ...(input.publicKeyJwk || {}) };
    delete (jwk as Record<string, unknown>).key_ops;
    delete (jwk as Record<string, unknown>).ext;
    if (!jwk.kty) return false;
    if (jwk.kty === "EC" && !jwk.crv) return false;
    if (jwk.kty === "RSA" && (!jwk.n || !jwk.e)) return false;

    const clientJSON = fromBase64Url(response.clientDataJSON);
    let client: { type?: string; challenge?: string; origin?: string; crossOrigin?: boolean };
    try { client = JSON.parse(new TextDecoder().decode(clientJSON)); } catch { return false; }
    if (client.type !== "webauthn.get") return false;
    if (client.challenge !== input.challenge) return false;
    if (client.origin !== input.origin) return false;
    if (client.crossOrigin === true) return false;

    const authData = fromBase64Url(response.authenticatorData);
    if (authData.length < 37) return false;
    const expectedRpHash = input.rpIdHash || new Uint8Array(32);
    for (let i = 0; i < 32; i++) if (authData[i] !== expectedRpHash[i]) return false;
    if ((authData[32] & 0x01) !== 0x01) return false; // user presence

    const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientJSON));
    const signedData = concat(authData, clientHash);
    const signature = fromBase64Url(response.signature);
    const isRsa = jwk.kty === "RSA";
    const algorithm: AlgorithmIdentifier = isRsa
      ? { name: "RSASSA-PKCS1-v1_5" }
      : { name: "ECDSA", namedCurve: (jwk.crv || "P-256") as P256Param };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const verifyAlgorithm: AlgorithmIdentifier = isRsa
      ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
      : { name: "ECDSA", hash: "SHA-256" };
    return crypto.subtle.verify(verifyAlgorithm, key, signature, signedData);
  } catch {
    return false;
  }
}

type P256Param = "P-256";

/** Normalize every verifier format that has ever been written to
 *  user_passkeys.public_key into a JWK the verifier can consume.
 *
 *  - new registrations: JSON JWK ({ kty, crv, x, y })
 *  - legacy registrations: base64 DER SubjectPublicKeyInfo
 *  - very old registrations: NULL — reported as absent, never thrown */
export async function resolvePublicKeyJwk(raw: string | null | undefined): Promise<JsonWebKey | null> {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    if (value.startsWith("{")) {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && typeof parsed.kty === "string") {
        return parsed as JsonWebKey;
      }
      return null;
    }

    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const rawBytes = atob(padded);
    const spki = Uint8Array.from(rawBytes, ch => ch.charCodeAt(0));

    const attempts: AlgorithmIdentifier[] = [
      { name: "ECDSA", namedCurve: "P-256" },
      { name: "ECDSA", namedCurve: "P-384" },
      { name: "ECDSA", namedCurve: "P-521" },
      { name: "RSASSA-PKCS1-v1_5" },
    ];
    for (const algorithm of attempts) {
      try {
        const key = await crypto.subtle.importKey("spki", spki, algorithm, true, []);
        return await crypto.subtle.exportKey("jwk", key);
      } catch { /* try the next key type */ }
    }
    return null;
  } catch {
    return null;
  }
}
