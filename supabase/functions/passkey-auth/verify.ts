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
    if (!input.publicKeyJwk?.kty || !input.publicKeyJwk?.crv) return false;

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
    const key = await crypto.subtle.importKey(
      "jwk", input.publicKeyJwk,
      { name: "ECDSA", namedCurve: input.publicKeyJwk.crv as P256Param },
      false, ["verify"],
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, key, signature, signedData,
    );
  } catch {
    return false;
  }
}

type P256Param = "P-256";
