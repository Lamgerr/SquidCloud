export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const d = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(d);
}
