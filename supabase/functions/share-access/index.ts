import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { shareId, action, password, country, deviceFingerprint, recipientEmail } = await req.json();
    if (!shareId) return json({ error: 'shareId required' }, 400);

    if (action === 'check') {
      const { data: accessCheck, error: checkError } = await supabase.rpc('check_share_access', {
        p_share_id: shareId,
        p_password: password || null,
        p_country: country || null,
        p_device_fingerprint: deviceFingerprint || null,
      });
      if (checkError) return json({ error: checkError.message }, 500);

      return json(accessCheck);
    }

    if (action === 'view') {
      await supabase.rpc('log_share_event', {
        p_share_id: shareId, p_event_type: 'view',
        p_success: true, p_ip: req.headers.get('x-real-ip') || '',
        p_user_agent: req.headers.get('user-agent') || '',
        p_geo_country: country || null,
      });
      return json({ ok: true });
    }

    if (action === 'download') {
      const { data: check } = await supabase.rpc('check_share_access', {
        p_share_id: shareId, p_password: password || null,
        p_country: country || null, p_device_fingerprint: deviceFingerprint || null,
      });
      if (!check?.allowed) return json({ error: check?.reason || 'access_denied' }, 403);

      await supabase.rpc('log_share_event', {
        p_share_id: shareId, p_event_type: 'download',
        p_success: true, p_ip: req.headers.get('x-real-ip') || '',
        p_user_agent: req.headers.get('user-agent') || '',
        p_geo_country: country || null,
      });

      if (check.burn_after_reading) {
        await supabase.rpc('execute_burn_after_reading', { p_share_id: shareId });
      }

      return json({
        ok: true, burn_after_reading: check.burn_after_reading,
        view_only: check.view_only, watermark_email: check.watermark_email,
        shared_encryption_key: check.shared_encryption_key,
      });
    }

    if (action === 'analytics') {
      const { data: logs } = await supabase
        .from('share_audit_logs')
        .select('*')
        .eq('share_id', shareId)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: share } = await supabase
        .from('shares')
        .select('share_views, download_count, created_at, expires_at, max_views, max_downloads, burn_after_reading')
        .eq('share_id', shareId)
        .single();

      return json({ logs: logs || [], share });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});