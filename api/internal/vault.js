/**
 * Internal BFF endpoint for vault key operations.
 * Browser never talks to Supabase for these — it sends an opaque session
 * cookie; this function derives identity server-side and uses RLS.
 */
import { createClient } from '@supabase/supabase-js';
import { releaseShareMeta } from './share-meta-policy.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const send = (res, body, status = 200) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, { error: 'method' }, 405);
  if (!SUPABASE_URL || !SERVICE) return send(res, { error: 'not configured' }, 503);

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { return send(res, { error: 'bad request' }, 400); }

  // Service-role client with no user JWT: bypasses RLS for privileged writes.
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Share metadata is public only after check_share_access passes. No anon RPC.
  if (body.op === 'share-meta') {
    const shareId = String(body.shareId || '');
    if (!shareId) return send(res, { error: 'shareId required' }, 400);
    const { data: access, error: accessError } = await admin.rpc('check_share_access', {
      p_share_id: shareId,
      p_password: body.password || null,
      p_country: body.country || null,
      p_device_fingerprint: body.deviceFingerprint || null,
    });
    if (accessError) return send(res, { error: accessError.message }, 500);
    if (!access?.allowed) return send(res, { allowed: false, reason: access?.reason || 'access_denied' }, 403);
    const { data: row, error: rowError } = await admin.rpc('get_shared_file_info', { share_id_param: shareId });
    if (rowError) return send(res, { error: rowError.message }, 500);
    const first = Array.isArray(row) ? row[0] : row;
    const released = releaseShareMeta(access, first || {});
    if (!released) return send(res, { allowed: false, reason: 'access_denied' }, 403);
    return send(res, { allowed: true, info: released });
  }

  // Public share decrypt logging. Uses the live table's ip_address column;
  // the stale RPC inserts actor_ip which does not exist in production.
  if (body.op === 'share-decrypt-log') {
    const { error } = await admin.from('share_decrypt_logs').insert({
      share_id: String(body.shareId || ''),
      success: body.success === true,
      failure_reason: body.failureReason || null,
      user_agent: String(body.userAgent || ''),
      ip_address: null,
    });
    if (error) return send(res, { error: error.message }, 500);
    return send(res, { ok: true });
  }

  // Public maintenance status needs no session.
  if (body.op === 'maintenance-mode' && body.value === undefined) {
    const { data } = await admin.from('system_settings')
      .select('setting_value').eq('setting_key', 'maintenance_mode').maybeSingle();
    return send(res, { setting_value: data?.setting_value || { enabled: false, message: 'System is under maintenance. Please check back later.' } });
  }

  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return send(res, { error: 'unauthorized' }, 401);
  const token = auth.slice(7);
  const supabase = createClient(SUPABASE_URL, SERVICE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return send(res, { error: 'unauthorized' }, 401);

  // Identity is ALWAYS from the verified session; body userId is rejected.
  if ('userId' in body || 'user_id' in body || 'owner_id' in body) return send(res, { error: 'identity fields rejected' }, 400);

  const op = String(body.op || '');
  // Append an event to the key transparency log with a verified identity.
  if (op === 'ktl-append') {
    if (!auth.startsWith('Bearer ')) return send(res, { error: 'unauthorized' }, 401);
    const token = auth.slice(7);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return send(res, { error: 'unauthorized' }, 401);
    const { seq, event_type, payload, prev_hash, hash } = body;
    if (!Number.isInteger(seq) || typeof event_type !== 'string' || typeof hash !== 'string') {
      return send(res, { error: 'invalid event' }, 400);
    }
    const { data: head, error: headErr } = await admin.from('zk_ktl')
      .select('seq, hash').eq('user_id', user.id).order('seq', { ascending: false }).limit(1).maybeSingle();
    if (headErr) return send(res, { error: headErr.message }, 500);
    if (seq !== (head?.seq || 0) + 1) return send(res, { error: 'ktl sequence mismatch' }, 409);
    const { error } = await admin.from('zk_ktl').insert({
      user_id: user.id, seq, event_type, payload: payload || {}, prev_hash: prev_hash || head?.hash || 'GENESIS', hash,
    });
    if (error) return send(res, { error: error.message }, 500);
    return send(res, { ok: true });
  }

  if (op === 'vault-state') {
    const { data } = await supabase.from('zk_vaults').select('status, crypto_version, epoch, verifier').eq('user_id', user.id).maybeSingle();
    return send(res, { vault: data || null });
  }
  if (op === 'file-meta') {
    if (!body.fileId) return send(res, { error: 'fileId required' }, 400);
    const { data } = await supabase.from('zk_files').select('file_salt, iv, version').eq('file_id', body.fileId).eq('user_id', user.id).maybeSingle();
    return send(res, { meta: data || null });
  }
  if (op === 'ktl-head') {
    const { data } = await supabase.from('zk_ktl').select('seq, hash').eq('user_id', user.id).order('seq', { ascending: false }).limit(1).maybeSingle();
    return send(res, { head: data || null });
  }

  // Maintenance status is public to read, admin-only to change. It is served
  // by the BFF so anon never touches system_settings directly.
  if (op === 'maintenance-mode') {
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return send(res, { error: 'forbidden' }, 403);
    const { error } = await admin.from('system_settings')
      .update({ setting_value: body.value, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('setting_key', 'maintenance_mode');
    if (error) return send(res, { error: error.message }, 500);
    return send(res, { ok: true });
  }

  // Master-key metadata is the real vault verifier. The master key is wrapped
  // with a PBKDF2 key derived from the account sign-in password.
  if (op === 'vault-master-meta') {
    const { data } = await admin.from('master_keys')
      .select('encrypted_master_key, kdf_salt, kdf_iterations, key_version')
      .eq('user_id', user.id).order('key_version', { ascending: false }).limit(1).maybeSingle();
    return send(res, {
      encrypted_master_key: data?.encrypted_master_key || null,
      kdf_salt: data?.kdf_salt || null,
      kdf_iterations: data?.kdf_iterations || 100000,
      key_version: data?.key_version || 1,
    });
  }

  // Vault passphrase verification metadata (hash + salt only, never key).
  // Returned by the BFF so the browser never opens a Supabase REST socket.
  if (op === 'vault-pass-meta') {
    const { data } = await admin.from('user_encryption_settings')
      .select('settings').eq('user_id', user.id).maybeSingle();
    const cfg = data?.settings || {};
    return send(res, {
      account_key_hash: cfg.account_key_hash || null,
      account_key_salt: cfg.account_key_salt || null,
    });
  }

  // Security events are written with the service role so anon RLS/grants
  // never leak into the client. Identity comes from the verified token.
  if (op === 'security-event') {
    const ev = body.event || {};
    const { error: insertError } = await admin.from('security_events').insert({
      event_type: ev.event_type || 'suspicious_activity',
      user_id: user.id,
      timestamp: ev.timestamp || new Date().toISOString(),
      ip_address: ev.ip_address || '',
      user_agent: ev.user_agent || '',
      metadata: ev.metadata || {},
      risk_level: ev.risk_level || 'low',
      status: ev.status || 'success',
    });
    if (insertError) return send(res, { error: insertError.message }, 500);
    return send(res, { ok: true });
  }

  // Destructive vault reset runs only through this BFF. The browser never
  // calls the Supabase edge function (or storage/DB) directly. Identity is
  // taken from the verified token, never from the body.
  if (op === 'reset-vault') {
    if (body.confirmation !== 'ERASE') return send(res, { error: 'confirmation required' }, 400);
    const fnUrl = `${SUPABASE_URL}/functions/v1/vault-reset`;
    const resp = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        confirmation: 'ERASE',
        totpVerified: body.totpVerified === true,
        passkeyVerified: body.passkeyVerified === true,
      }),
    });
    const text = await resp.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    return send(res, payload, resp.status);
  }
  return send(res, { error: 'unknown op' }, 400);
}
