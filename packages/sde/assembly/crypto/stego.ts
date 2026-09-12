// LSB steganography — production: 1 bit per byte, capacity = floor(cover.length / 8)
export function stegoEmbed(cover: Uint8Array, payload: Uint8Array): Uint8Array {
  const needed = payload.length * 8;
  if (needed > cover.length) throw new Error("cover too small for payload");
  const out = cover.slice(0);
  let bitPos = 0;
  for (let i = 0; i < payload.length; i++) {
    for (let b = 7; b >= 0; b--) {
      const bit = (payload[i] >> b) & 1;
      out[bitPos] = (out[bitPos] & 0xfe) | bit;
      bitPos++;
    }
  }
  return out;
}

export function stegoExtract(stego: Uint8Array, payloadLen: i32): Uint8Array {
  const out = new Uint8Array(payloadLen);
  let bitPos = 0;
  for (let i = 0; i < payloadLen; i++) {
    let byte: u8 = 0;
    for (let b = 7; b >= 0; b--) {
      byte |= u8((stego[bitPos] & 1) << b);
      bitPos++;
    }
    out[i] = byte;
  }
  return out;
}
