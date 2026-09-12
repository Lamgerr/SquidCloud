export async function aesGcmEncrypt(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: 128 } as AesGcmParams,
    k,
    plaintext as BufferSource
  );
  return new Uint8Array(ct); // ct || tag already appended by Subtle
}

export async function aesGcmDecrypt(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, ctWithTag: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: 128 } as AesGcmParams,
    k,
    ctWithTag as BufferSource
  );
  return new Uint8Array(pt);
}
