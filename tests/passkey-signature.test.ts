import { describe, expect, test } from "bun:test";
import { verifyAssertion } from "../supabase/functions/passkey-auth/verify";

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Wrap a WebCrypto P1363 signature (r||s) into ASN.1 DER, as authenticators emit. */
function p1363ToDer(sig: Uint8Array): Uint8Array {
  const half = sig.length / 2;
  const int = (raw: Uint8Array) => {
    let i = 0;
    while (i < raw.length - 1 && raw[i] === 0) i++;
    let bytes = raw.slice(i);
    if (bytes[0] & 0x80) bytes = new Uint8Array([0, ...bytes]);
    return new Uint8Array([0x02, bytes.length, ...bytes]);
  };
  const r = int(sig.slice(0, half));
  const s = int(sig.slice(half));
  const body = new Uint8Array([...r, ...s]);
  return new Uint8Array([0x30, body.length, ...body]);
}

async function keys() {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
}

async function assertion(key: CryptoKeyPair, signature: Uint8Array) {
  const challenge = "sig-challenge";
  const origin = "https://squidcloud.vercel.app";
  const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }));
  const auth = new Uint8Array(37);
  auth[32] = 0x05;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", clientJSON));
  const payload = new Uint8Array([...auth, ...digest]);
  return verifyAssertion({
    credential: { id: "cred", response: {
      clientDataJSON: b64url(clientJSON),
      authenticatorData: b64url(auth),
      signature: b64url(signature),
    } },
    challenge,
    origin,
    publicKeyJwk: await crypto.subtle.exportKey("jwk", key.publicKey),
  });
}

describe("WebAuthn ECDSA signature encodings", () => {
  test("accepts DER-encoded signatures from real authenticators", async () => {
    const key = await keys();
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge: "sig-challenge", origin: "https://squidcloud.vercel.app", crossOrigin: false }));
    const auth = new Uint8Array(37);
    auth[32] = 0x05;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", clientJSON));
    const payload = new Uint8Array([...auth, ...digest]);
    const p1363 = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, payload));

    expect(await assertion(key, p1363ToDer(p1363))).toBe(true);
  });

  test("still accepts P1363 signatures", async () => {
    const key = await keys();
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge: "sig-challenge", origin: "https://squidcloud.vercel.app", crossOrigin: false }));
    const auth = new Uint8Array(37);
    auth[32] = 0x05;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", clientJSON));
    const payload = new Uint8Array([...auth, ...digest]);
    const p1363 = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, payload));

    expect(await assertion(key, p1363)).toBe(true);
  });
});
