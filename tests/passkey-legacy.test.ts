import { describe, expect, test } from "bun:test";
import { resolvePublicKeyJwk, verifyAssertion } from "../supabase/functions/passkey-auth/verify";

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeKey() {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
}

describe("legacy passkey verifier compatibility", () => {
  test("accepts a JWK verifier written by the new registration flow", async () => {
    const keys = await makeKey();
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const resolved = await resolvePublicKeyJwk(JSON.stringify(jwk));
    expect(resolved?.crv).toBe("P-256");
    expect(resolved?.x).toBe(jwk.x);
  });

  test("accepts the base64 DER SPKI verifier stored by legacy registrations", async () => {
    const keys = await makeKey();
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey));
    const resolved = await resolvePublicKeyJwk(toBase64(spki));
    expect(resolved?.kty).toBe("EC");
    expect(resolved?.crv).toBe("P-256");
    expect(typeof resolved?.x).toBe("string");
  });

  test("legacy NULL verifier is reported as absent, not an error", async () => {
    expect(await resolvePublicKeyJwk(null)).toBeNull();
    expect(await resolvePublicKeyJwk("")).toBeNull();
    expect(await resolvePublicKeyJwk("not-a-key")).toBeNull();
  });

  test("a resolved legacy SPKI verifies a real assertion", async () => {
    const keys = await makeKey();
    const spki = toBase64(new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey)));
    const resolved = await resolvePublicKeyJwk(spki);
    const challenge = "legacy-challenge";
    const origin = "https://squidcloud.vercel.app";
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }));
    const auth = new Uint8Array(37);
    auth[32] = 0x05;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", clientJSON));
    const payload = new Uint8Array([...auth, ...digest]);
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, payload);

    const ok = await verifyAssertion({
      credential: { id: "cred", response: {
        clientDataJSON: b64url(clientJSON),
        authenticatorData: b64url(auth),
        signature: b64url(new Uint8Array(sig)),
      } },
      challenge,
      origin,
      publicKeyJwk: resolved!,
    });
    expect(ok).toBe(true);
  });
});
