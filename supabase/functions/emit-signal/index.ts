// ---- emit-signal: client-safe signal producer ----
// Lets the authenticated user emit signals for themselves (e.g. password
// changed, file shared). The user_id is always forced to auth.uid(), so a
// user can never signal anyone else. Only a small allowlist of types is
// accepted; everything else is rejected by the shared validator anyway.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSignal } from "../_shared/signals.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

// Types the app UI is allowed to emit for the signed-in user.
const CLIENT_ALLOWLIST = new Set(['password_changed', 'file_shared']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: 'Invalid token' }, 401);

    const body = await req.json().catch(() => ({}));
    const { type, severity, title, body: bodyText, link, idempotency_key } = body as {
      type?: string;
      severity?: 'info' | 'warning' | 'urgent';
      title?: string;
      body?: string;
      link?: string;
      idempotency_key?: string;
    };

    if (!type || !CLIENT_ALLOWLIST.has(type)) {
      return json({ error: `Type '${type ?? ''}' is not allowed from the client` }, 400);
    }
    if (!title) {
      return json({ error: 'title is required' }, 400);
    }

    const result = await sendSignal({
      service_id: 'cloudbliss',
      user_id: user.id, // always the caller — never client-supplied
      type,
      severity,
      title,
      body: bodyText,
      link,
      idempotency_key,
    });

    if (!result.ok) {
      return json({ error: result.error ?? 'Failed to send signal' }, 400);
    }
    return json({ ok: true, id: result.id });
  } catch (err) {
    console.error('[emit-signal] error', String(err));
    return json({ error: String(err) }, 500);
  }
});
