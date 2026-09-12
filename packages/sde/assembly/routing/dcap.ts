import { shake128_expand } from "../crypto/shake128";

export function expandRouteSeed(routeSeed: Uint8Array): Uint8Array {
  return shake128_expand(routeSeed, 256);
}
