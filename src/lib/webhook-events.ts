import { supabase } from '@/integrations/supabase/client';

// Client-side webhook emitter. Fire-and-forget: never blocks or throws.
// The dispatch function resolves the user from the JWT.
const ALLOWED_EVENTS = new Set([
  'file.uploaded',
  'file.shared',
  'file.renamed',
  'file.moved',
  'file.deleted',
  'site.published',
  'site.unpublished',
  'site.redeployed',
  'site.archived',
  'share_link.accessed',
  'share_link.revoked',
  'pipeline.completed',
  'pipeline.failed',
  'api_tokens.quota_warning',
]);

export async function emitWebhookEvent(
  event: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!ALLOWED_EVENTS.has(event)) return;
  try {
    await supabase.functions.invoke('webhook-dispatch', {
      body: { event, data: data ?? {} },
    });
  } catch (error) {
    console.error('emitWebhookEvent failed:', error);
  }
}
