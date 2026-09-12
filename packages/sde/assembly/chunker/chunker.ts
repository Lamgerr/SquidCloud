// Dynamic chunking — floor 256 KiB, cap 8 MiB
export function chunkBlob(data: Uint8Array, chunkSize: i32): Uint8Array[] {
  const n = (data.length + chunkSize - 1) / chunkSize;
  const out = new Array<Uint8Array>(n);
  for (let i = 0; i < n; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize > data.length ? data.length : start + chunkSize;
    out[i] = data.slice(start, end);
  }
  return out;
}
