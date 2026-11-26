/**
 * Pure policy helpers for sealed previews. An opaque-origin sandboxed iframe
 * cannot expose its origin to the parent, so the security boundary is the
 * message *source* window on both sides, plus keeping object URLs inside the
 * frame. These helpers are deliberately free of DOM globals so they are
 * unit-testable.
 */

/** True only for a `blob:` URL created on the app's own origin. */
export function isAppOriginBlobUrl(url: string, appOrigin: string): boolean {
  if (!url.startsWith("blob:")) return false;
  const rest = url.slice("blob:".length);
  // Opaque origins serialize as `blob:null/<uuid>` — safe for previews.
  if (rest === "null" || rest.startsWith("null/")) return false;
  return rest === appOrigin || rest.startsWith(`${appOrigin}/`);
}

/** Fail closed when a preview would use an object URL from the app origin. */
export function assertNoAppOriginPreviewUrl(url: string | null | undefined, appOrigin: string): void {
  if (url && isAppOriginBlobUrl(url, appOrigin)) {
    throw new Error("Preview object URLs must be created inside the sealed frame");
  }
}

export function isSealedReadyMessage(event: MessageEvent, expectedSource: Window | null): boolean {
  return !!expectedSource && event.source === expectedSource && event.data === "sealed-ready";
}

function hasExpectedSource(event: MessageEvent, expectedSource: Window | null): boolean {
  return !!expectedSource && event.source === expectedSource;
}

export function isRenderMessage(event: MessageEvent, expectedSource: Window | null): boolean {
  if (!hasExpectedSource(event, expectedSource)) return false;
  const data = event.data;
  return !!data && data.type === "render" && typeof data.html === "string";
}

export function isBlobMessage(event: MessageEvent, expectedSource: Window | null): boolean {
  if (!hasExpectedSource(event, expectedSource)) return false;
  const data = event.data;
  return !!data && data.type === "blob" && typeof data.kind === "string" && data.blob != null;
}
