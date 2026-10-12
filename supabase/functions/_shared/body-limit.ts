// Shared bounded JSON body parser for edge functions.
// Prevents OOM/DoS from maliciously large request bodies:
// read the raw text first, enforce a byte cap, then JSON.parse.
// Throw contract: Error('BODY_TOO_LARGE') or Error('INVALID_JSON').
// Callers map BODY_TOO_LARGE -> 413, INVALID_JSON -> 400.

export async function readJsonLimited(req: Request, maxBytes = 256 * 1024): Promise<any> {
  const text = await req.text();
  if (!text) return {};
  if (text.length > maxBytes) throw new Error("BODY_TOO_LARGE");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export function isBodyTooLarge(e: unknown): boolean {
  return e instanceof Error && e.message === "BODY_TOO_LARGE";
}

export function isInvalidJson(e: unknown): boolean {
  return e instanceof Error && e.message === "INVALID_JSON";
}
