// SHA-256 — pure AssemblyScript (production, no host dependency)
// Based on FIPS 180-4. Used by HMAC/HKDF when WASM runs without host imports.

const K = new Uint32Array(64);
K[0]=0x428a2f98;K[1]=0x71374491;K[2]=0xb5c0fbcf;K[3]=0xe9b5dba5;K[4]=0x3956c25b;K[5]=0x59f111f1;K[6]=0x923f82a4;K[7]=0xab1c5ed5;
K[8]=0xd807aa98;K[9]=0x12835b01;K[10]=0x243185be;K[11]=0x550c7dc3;K[12]=0x72be5d74;K[13]=0x80deb1fe;K[14]=0x9bdc06a7;K[15]=0xc19bf174;
K[16]=0xe49b69c1;K[17]=0xefbe4786;K[18]=0x0fc19dc6;K[19]=0x240ca1cc;K[20]=0x2de92c6f;K[21]=0x4a7484aa;K[22]=0x5cb0a9dc;K[23]=0x76f988da;
K[24]=0x983e5152;K[25]=0xa831c66d;K[26]=0xb00327c8;K[27]=0xbf597fc7;K[28]=0xc6e00bf3;K[29]=0xd5a79147;K[30]=0x06ca6351;K[31]=0x14292967;
K[32]=0x27b70a85;K[33]=0x2e1b2138;K[34]=0x4d2c6dfc;K[35]=0x53380d13;K[36]=0x650a7354;K[37]=0x766a0abb;K[38]=0x81c2c92e;K[39]=0x92722c85;
K[40]=0xa2bfe8a1;K[41]=0xa81a664b;K[42]=0xc24b8b70;K[43]=0xc76c51a3;K[44]=0xd192e819;K[45]=0xd6990624;K[46]=0xf40e3585;K[47]=0x106aa070;
K[48]=0x19a4c116;K[49]=0x1e376c08;K[50]=0x2748774c;K[51]=0x34b0bcb5;K[52]=0x391c0cb3;K[53]=0x4ed8aa4a;K[54]=0x5b9cca4f;K[55]=0x682e6ff3;
K[56]=0x748f82ee;K[57]=0x78a5636f;K[58]=0x84c87814;K[59]=0x8cc70208;K[60]=0x90befffa;K[61]=0xa4506ceb;K[62]=0xbef9a3f7;K[63]=0xc67178f2;

function rotr(x: u32, n: u32): u32 { return (x >>> n) | (x << (32 - n)); }

export function sha256(data: Uint8Array): Uint8Array {
  let h0: u32 = 0x6a09e667, h1: u32 = 0xbb67ae85, h2: u32 = 0x3c6ef372, h3: u32 = 0xa54ff53a;
  let h4: u32 = 0x510e527f, h5: u32 = 0x9b05688c, h6: u32 = 0x1f83d9ab, h7: u32 = 0x5be0cd19;

  const ml = data.length * 8;
  const padLen = ((data.length + 9 + 63) & ~63) - data.length;
  const total = data.length + padLen;
  const padded = new Uint8Array(total);
  padded.set(data, 0);
  padded[data.length] = 0x80;
  // length in bits, big-endian at end
  padded[total - 8] = u8((ml >>> 24) & 0xff); // JS numbers 32-bit, but WASM i64 would be better; for <4 GiB blobs this is sufficient
  padded[total - 7] = u8((ml >>> 16) & 0xff);
  padded[total - 6] = u8((ml >>> 8) & 0xff);
  padded[total - 5] = u8(ml & 0xff);

  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (u32(padded[off + i*4]) << 24) | (u32(padded[off + i*4 + 1]) << 16) | (u32(padded[off + i*4 + 2]) << 8) | u32(padded[off + i*4 + 3]);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = w[i-16] + s0 + w[i-7] + s1;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = h + S1 + ch + K[i] + w[i];
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = S0 + maj;
      h = g; g = f; f = e; e = d + temp1; d = c; c = b; b = a; a = temp1 + temp2;
    }
    h0 += a; h1 += b; h2 += c; h3 += d; h4 += e; h5 += f; h6 += g; h7 += h;
  }
  const out = new Uint8Array(32);
  const hs = [h0,h1,h2,h3,h4,h5,h6,h7];
  for (let i = 0; i < 8; i++) {
    out[i*4] = u8((hs[i] >>> 24) & 0xff); out[i*4+1] = u8((hs[i] >>> 16) & 0xff); out[i*4+2] = u8((hs[i] >>> 8) & 0xff); out[i*4+3] = u8(hs[i] & 0xff);
  }
  return out;
}
