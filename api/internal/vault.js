/**
 * Internal BFF endpoint for vault key operations.
 * Browser never talks to Supabase for these — it sends an opaque session
 * cookie; this function derives identity server-side and uses RLS.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const send = (res, body, status = 200) => res.status(status).json(body);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, { error: 'method' }, 405);
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return send(res, { error: 'unauthorized' }, 401);
  if (!SUPABASE_URL || !SERVICE) return send(res, { error: 'not configured' }, 503);

  const token = auth.slice(7);
  const supabase = createClient(SUPABASE_URL, SERVICE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return send(res, { error: 'unauthorized' }, 401);

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { return send(res, { error: 'bad request' }, 400); }

  // Identity is ALWAYS from the verified session; body userId is rejected.
  if ('userId' in body || 'user_id' in body || 'owner_id' in body) return send(res, { error: 'identity fields rejected' }, 400);

  const op = String(body.op || '');
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
