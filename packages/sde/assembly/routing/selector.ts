// Weighted substrate selection — production: uses expanded seed windows as deterministic PRNG.

export function selectSubstrates(expandedSeed: Uint8Array, n: i32, replication: i32): Int32Array {
  const out = new Int32Array(replication);
  const used = new Uint8Array(n);
  let filled: i32 = 0;
  let windowIdx: i32 = 0;
  while (filled < replication && windowIdx < 32) {
    const base = windowIdx * 8;
    let v: u32 = 0;
    for (let k = 0; k < 4; k++) v = (v << 8) | u32(expandedSeed[(base + k) % 256]);
    let idx = i32(v % u32(n));
    // linear probe on collision to ensure distinct picks
    let probe: i32 = 0;
    while (used[idx] == 1 && probe < n) { idx = (idx + 1) % n; probe++; }
    if (used[idx] == 0) { out[filled] = idx; used[idx] = 1; filled++; }
    windowIdx++;
  }
  return out;
}
