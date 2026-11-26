import { describe, expect, test } from "bun:test";
import { verifyAssertion } from "../supabase/functions/passkey-auth/verify";

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function makeKey() {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
}

function authData(challenge: string, origin: string, type = "webauthn.get"): Uint8Array {
  const client = encoder.encode(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  const rpHash = new Uint8Array(32);
  const flags = new Uint8Array([0x05]);
  const counter = new Uint8Array([0, 0, 0, 1]);
  const out = new Uint8Array(32 + flags.length + counter.length + client.length);
  out.set(rpHash, 0);
  out.set(flags, 32);
  out.set(counter, 33);
  return out;
}

describe("passkey assertion verification", () => {
  test("rejects a clientDataJSON with the wrong origin", async () => {
    const keys = await makeKey();
    const challenge = "challenge-1";
    const origin = "https://squidcloud.vercel.app";
    const authenticator = authData(challenge, "https://evil.example");
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge, origin: "https://evil.example", crossOrigin: false }));
    const signed = new Uint8Array([...new Uint8Array(32), ...new Uint8Array([0x05]), ...new Uint8Array([0,0,0,1])]);
    const digest = await crypto.subtle.digest("SHA-256", clientJSON);
    const payload = new Uint8Array([...signed, ...new Uint8Array(digest)]);
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, payload);

    const ok = await verifyAssertion({
      credential: {
        id: "cred-1",
        response: {
          clientDataJSON: b64url(clientJSON),
          authenticatorData: b64url(authenticator),
          signature: b64url(new Uint8Array(sig)),
        },
      },
      challenge,
      origin,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", keys.publicKey),
    });
    expect(ok).toBe(false);
  });

  test("rejects a mismatched challenge", async () => {
    const keys = await makeKey();
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge: "wrong", origin: "https://squidcloud.vercel.app", crossOrigin: false }));
    const ok = await verifyAssertion({
      credential: { id: "cred-1", response: {
        clientDataJSON: b64url(clientJSON), authenticatorData: b64url(authData("wrong", "https://squidcloud.vercel.app")),
        signature: b64url(new Uint8Array(32)),
      } },
      challenge: "expected",
      origin: "https://squidcloud.vercel.app",
      publicKeyJwk: await crypto.subtle.exportKey("jwk", keys.publicKey),
    });
    expect(ok).toBe(false);
  });

  test("rejects a bad signature when origin and challenge are correct", async () => {
    const keys = await makeKey();
    const other = await makeKey();
    const challenge = "challenge-2";
    const origin = "https://squidcloud.vercel.app";
    const clientJSON = encoder.encode(JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }));
    const auth = authData(challenge, origin);
    const digest = await crypto.subtle.digest("SHA-256", clientJSON);
    const payload = new Uint8Array([...auth, ...new Uint8Array(digest)]);
    const badSig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, other.privateKey, payload);

    const ok = await verifyAssertion({
      credential: { id: "cred-1", response: {
        clientDataJSON: b64url(clientJSON), authenticatorData: b64url(auth),
        signature: b64url(new Uint8Array(badSig)),
      } },
      challenge,
      origin,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", keys.publicKey),
    });
    expect(ok).toBe(false);
  });
});
