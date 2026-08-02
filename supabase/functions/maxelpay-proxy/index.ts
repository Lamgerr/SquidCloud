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

    const res = await fetch(`${MAXELPAY_API}${endpoint}`, {
      method,
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      return json({ error: data.message || `MaxelPay error: ${res.status}` }, res.status);
    }

    return json(data.data || data);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
  });
});
