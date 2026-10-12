// ---- Signals: SquidCloud internal notification platform ----
// Producer helper for edge functions. Creates its own service-role client
// against the public schema, so it works from any function regardless of
// the caller's database schema. Validates everything before inserting;
// insertion is the only delivery step — Realtime broadcasts the row to
// the recipient's clients, which surface it as a toast + bell signal.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const ALLOWED_SERVICES = new Set(['cloudbliss', 'squidveil', 'signals']);

const SERVICE_TYPE_ALLOWLIST: Record<string, string[]> = {
  cloudbliss: [
    'share_viewed',
    'share_downloaded',
    'file_shared',
    'file_request_filled',
    'credits_low',
    'subscription_expiring',
    'subscription_payment_failed',
    'payment_success',
    'trash_purge',
    'workspace_invite',
    'upload_failed',
    'import_completed',
    'import_failed',
    'password_changed',
  ],
  squidveil: [
    'token_created',
    'token_rotated',
    'token_revoked',
    'rotation_failed',
    'audit_anomaly',
    'secret_expired',
    'policy_changed',
  ],
  signals: ['system'],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SignalPayload {
  service_id: string;
  user_id: string;
  type: string;
  severity?: 'info' | 'warning' | 'urgent';
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
  idempotency_key?: string;
}

interface SignalResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function makeSignalsClient(): ReturnType<typeof createClient> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'x-application-name': 'signals' } },
  });
}

/** Validate a signal payload. Returns an error string or null. */
export function validateSignal(payload: SignalPayload): string | null {
  if (!ALLOWED_SERVICES.has(payload.service_id)) {
    return `Unknown service '${payload.service_id}'`;
  }
  const allowlist = SERVICE_TYPE_ALLOWLIST[payload.service_id] ?? [];
  if (!allowlist.includes(payload.type)) {
    return `Type '${payload.type}' is not allowed for service '${payload.service_id}'`;
  }
  if (!UUID_RE.test(payload.user_id)) {
    return 'user_id must be a valid UUID';
  }
  if (payload.severity && !['info', 'warning', 'urgent'].includes(payload.severity)) {
    return `Invalid severity '${payload.severity}'`;
  }
  if (typeof payload.title !== 'string' || payload.title.length < 1 || payload.title.length > 200) {
    return 'title must be 1-200 characters';
  }
  if (payload.body != null && (typeof payload.body !== 'string' || payload.body.length > 1000)) {
    return 'body must be at most 1000 characters';
  }
  if (payload.link != null) {
    if (typeof payload.link !== 'string' || payload.link.length > 500) {
      return 'link must be at most 500 characters';
    }
    if (!payload.link.startsWith('/')) {
      return 'link must be an app-relative route (start with /)';
    }
  }
  if (payload.data != null) {
    if (typeof payload.data !== 'object') return 'data must be an object';
    const size = new TextEncoder().encode(JSON.stringify(payload.data)).byteLength;
    if (size > 8192) return 'data must be at most 8KB';
  }
  if (payload.idempotency_key != null && (typeof payload.idempotency_key !== 'string' || payload.idempotency_key.length > 200)) {
    return 'idempotency_key must be at most 200 characters';
  }
  return null;
}

/**
 * Send a signal to a user. Idempotent when idempotency_key is provided
 * (duplicate keys are ignored). Never throws — returns { ok: false, error }
 * instead so producers are never broken by the notification layer.
 */
export async function sendSignal(
  payload: SignalPayload,
  opts: { expires_at?: string } = {},
): Promise<SignalResult> {
  try {
    const error = validateSignal(payload);
    if (error) {
      console.error('[signals] rejected', error, JSON.stringify(payload));
      return { ok: false, error };
    }

    const supabase = makeSignalsClient();
    const severity = payload.severity ?? 'info';
    const data = payload.data ?? {};

    const { data: row, error: insertError } = await supabase
      .from('signals')
      .upsert(
        {
          service_id: payload.service_id,
          user_id: payload.user_id,
          type: payload.type,
          severity,
          title: payload.title,
          body: payload.body ?? null,
          link: payload.link ?? null,
          data,
          idempotency_key: payload.idempotency_key ?? null,
          expires_at: opts.expires_at ?? null,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error('[signals] insert failed', insertError.message);
      return { ok: false, error: insertError.message };
    }

    return { ok: true, id: row?.id };
  } catch (err) {
    console.error('[signals] unexpected error', String(err));
    return { ok: false, error: String(err) };
  }
}
