/**
 * Best-effort client IP lookup for audit logging only.
 * Uses Cloudflare's trace endpoint (CORS-enabled) instead of api.ipify.org,
 * which is commonly blocked by adblockers / tracking prevention and then
 * surfaces as "Cross-Origin Request Blocked" console noise that try/catch
 * cannot suppress. Never throws — returns 'unknown' on any failure.
 */
export async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 'unknown';
    const text = await res.text();
    const match = text.match(/^ip=(.+)$/m);
    const ip = match?.[1]?.trim();
    return ip || 'unknown';
  } catch {
    return 'unknown';
  }
}
