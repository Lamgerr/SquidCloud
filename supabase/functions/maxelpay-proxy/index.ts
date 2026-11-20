import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withPrelGateway } from "../_shared/kza-prel.ts";

const MAXELPAY_API = "https://api.maxelpay.com/api/v1";

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
  return withPrelGateway(req, { functionId: 'maxelpay-proxy', operation: 'default' }, async () => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { endpoint, method = 'POST', payload, mode = 'live' } = body;

    if (!endpoint) {
      return json({ error: 'Missing endpoint' }, 400);
    }

    const keyName = mode === 'test' ? 'MAXELPAY_TEST_API_KEY' : 'MAXELPAY_LIVE_API_KEY';
    const { data: config } = await supabase.from('system_config').select('value').eq('key', keyName).single();
    const apiKey = config?.value;
    if (!apiKey) {
      return json({ error: `${keyName} not configured` }, 500);
    }

    // MaxelPay occasionally returns an HTML error page (e.g. CloudFront 504)
    // or times out. Guard the upstream call with a timeout and never feed a
    // non-JSON body to JSON.parse — otherwise the browser sees a cryptic
    // "Unexpected token '<'" error instead of an actionable message.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(`${MAXELPAY_API}${endpoint}`, {
        method,
        signal: controller.signal,
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      console.error('[maxelpay-proxy] non-JSON upstream response', {
        status: res.status,
        contentType: res.headers.get('content-type'),
        preview: raw.slice(0, 200),
      });
      return json(
        { error: 'The payment provider is temporarily unavailable. Please try again shortly.', code: 'PAYMENT_PROVIDER_UNAVAILABLE', upstreamStatus: res.status },
        502
      );
    }

    if (!res.ok) {
      return json(
        { error: data?.message || data?.error || `Payment provider error (${res.status})`, code: 'PAYMENT_PROVIDER_ERROR', upstreamStatus: res.status },
        res.status
      );
    }

    if (data == null) {
      return json({ error: 'Empty response from payment provider. Please try again.', code: 'PAYMENT_PROVIDER_EMPTY' }, 502);
    }

    return json(data.data || data);
  } catch (err: any) {
    console.error('[maxelpay-proxy] error', err);
    const message = err?.name === 'AbortError'
      ? 'The payment provider took too long to respond. Please try again.'
      : err?.message || 'Failed to create payment session';
    return json({ error: message, code: 'PAYMENT_PROXY_ERROR' }, 502);
  }
  });
});
