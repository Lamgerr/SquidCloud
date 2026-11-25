import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSignal } from "../_shared/signals.ts";
import { emitWebhookEvent } from "../_shared/webhook-emitter.ts";

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

async function getShareOwner(
  supabase: ReturnType<typeof createClient>,
  shareId: string,
): Promise<{ user_id: string; file_name: string | null } | null> {
  const { data: share } = await supabase
    .from('shares')
    .select('user_id, file_id, folder_id')
    .eq('share_id', shareId)
    .maybeSingle();
  if (!share?.user_id) return null;

  let file_name: string | null = null;
  if (share.file_id) {
    const { data: file } = await supabase.from('files').select('name').eq('id', share.file_id).maybeSingle();
    file_name = file?.name ?? null;
  } else if (share.folder_id) {
    const { data: folder } = await supabase.from('folders').select('name').eq('id', share.folder_id).maybeSingle();
    file_name = folder?.name ?? null;
  }
  return { user_id: share.user_id, file_name };
}

async function notifyShareOwner(
  supabase: ReturnType<typeof createClient>,
  shareId: string,
  event: 'viewed' | 'downloaded',
) {
  try {
    const owner = await getShareOwner(supabase, shareId);
    if (!owner) return;

    const label = owner.file_name ? `'${owner.file_name}'` : 'your file';
    const type = event === 'viewed' ? 'share_viewed' : 'share_downloaded';
    const severity = event === 'viewed' ? 'info' : 'info';

    await sendSignal({
      service_id: 'cloudbliss',
      user_id: owner.user_id,
      type,
      severity,
      title: event === 'viewed' ? `Shared file viewed: ${label}` : `Shared file downloaded: ${label}`,
      body: event === 'viewed'
        ? 'Someone opened your shared link.'
        : 'Someone downloaded your shared file.',
      link: '/dashboard',
      idempotency_key: `${type}:${shareId}:${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (err) {
    console.error(`[share-access] notify owner ${event} failed`, String(err));
  }
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

      // Non-secret diagnostics: distinguish a mistyped link password from a
      // stale/rotated access code. Never logs the password or code itself.
      if (!accessCheck?.allowed) {
        const { data: dbg } = await supabase.from('shares')
          .select('access_code, share_secret_hash').eq('share_id', shareId).maybeSingle();
        console.log('[share-access] rejected', {
          shareId,
          reason: accessCheck?.reason,
          passwordProvided: !!password,
          passwordLength: password?.length || 0,
          accessCodeSet: !!dbg?.access_code,
          accessCodeLength: dbg?.access_code?.length || 0,
          shareSecretSet: !!dbg?.share_secret_hash,
        });
      }
      return json(accessCheck);
    }

    if (action === 'view') {
      await supabase.rpc('log_share_event', {
        p_share_id: shareId, p_event_type: 'view',
        p_success: true, p_ip: req.headers.get('x-real-ip') || '',
        p_user_agent: req.headers.get('user-agent') || '',
        p_geo_country: country || null,
      });
      void notifyShareOwner(supabase, shareId, 'viewed');
      void emitWebhookEvent({
        userId: (await getShareOwner(supabase, shareId))?.user_id || '',
        event: 'share_link.accessed',
        data: {
          share_id: shareId,
          accessed_at: new Date().toISOString(),
          ip_address: req.headers.get('x-real-ip') || '',
          user_agent: req.headers.get('user-agent') || '',
        },
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

      void notifyShareOwner(supabase, shareId, 'downloaded');
      void emitWebhookEvent({
        userId: (await getShareOwner(supabase, shareId))?.user_id || '',
        event: 'share_link.accessed',
        data: {
          share_id: shareId,
          accessed_at: new Date().toISOString(),
          ip_address: req.headers.get('x-real-ip') || '',
          user_agent: req.headers.get('user-agent') || '',
          action: 'download',
        },
      });

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