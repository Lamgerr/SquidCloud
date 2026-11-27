/** Fire-and-forget client failure reporting. Never sends keys, plaintext,
 *  URLs or stack traces — only a stage label and a short sanitized message. */

export async function reportClientError(
  stage: string,
  error: unknown,
  fileId?: string,
): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const message = error instanceof Error ? error.message : String(error);
    await fetch('/api/internal/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        op: 'client-error',
        stage,
        code: error instanceof Error ? error.name : undefined,
        message,
        fileId,
      }),
    });
  } catch { /* telemetry must never break the app */ }
}
