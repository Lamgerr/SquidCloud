// ---- Webhook emitter: SquidCloud event dispatch ----
// Fire-and-forget helper for edge functions. Calls the webhook-dispatch
// function with the service-role key so the caller never needs to know
// which webhooks exist or how delivery works. Safe to call with `void`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

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

export interface WebhookEventPayload {
  userId: string;
  event: string;
  data?: Record<string, unknown>;
  deliveryId?: string;
}

export async function emitWebhookEvent(payload: WebhookEventPayload): Promise<void> {
  try {
    if (!ALLOWED_EVENTS.has(payload.event)) return;
    const url = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    await fetch(`${url}/functions/v1/webhook-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        userId: payload.userId,
        event: payload.event,
        data: payload.data ?? {},
        deliveryId: payload.deliveryId,
      }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {});
  } catch {
    // Fire-and-forget: never let webhook emission break the caller
  }
}
