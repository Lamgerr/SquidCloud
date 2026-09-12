// SDE WASM entry — AssemblyScript
// Exports are opaque handles validated inside WASM; TS only passes Uint8Array views.

export * from "./crypto/hkdf";
export * from "./crypto/aes_gcm";
export * from "./crypto/blake3";
export * from "./crypto/shake128";
export * from "./crypto/hmac";
export * from "./crypto/stego";
export * from "./identity/dms";
export * from "./identity/derivation";
export * from "./chunker/chunker";
export * from "./chunker/assembler";
export * from "./recall/token";
export * from "./routing/dcap";
export * from "./routing/selector";

// WASM memory helpers
export function alloc(len: i32): usize {
  return heap.alloc(len) as usize;
}
