/**
 * Internal BFF endpoint for vault key operations.
 * Browser never talks to Supabase for these — it sends an opaque session
 * cookie; this function derives identity server-side and uses RLS.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (body, status = 200) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export default async function handler(req, res) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  if (!SUPABASE_URL || !SERVICE) return json({ error: 'not configured' }, 503);

  const token = auth.slice(7);
  const supabase = createClient(SUPABASE_URL, SERVICE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return json({ error: 'unauthorized' }, 401);

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { return json({ error: 'bad request' }, 400); }

  // Identity is ALWAYS from the verified session; body userId is rejected.
  if ('userId' in body || 'user_id' in body || 'owner_id' in body) return json({ error: 'identity fields rejected' }, 400);

  const op = String(body.op || '');
  if (op === 'vault-state') {
    const { data } = await supabase.from('zk_vaults').select('status, crypto_version, epoch, verifier').eq('user_id', user.id).maybeSingle();
    return json({ vault: data || null });
  }
  if (op === 'file-meta') {
    if (!body.fileId) return json({ error: 'fileId required' }, 400);
    const { data } = await supabase.from('zk_files').select('file_salt, iv, version').eq('file_id', body.fileId).eq('user_id', user.id).maybeSingle();
    return json({ meta: data || null });
  }
  if (op === 'ktl-head') {
    const { data } = await supabase.from('zk_ktl').select('seq, hash').eq('user_id', user.id).order('seq', { ascending: false }).limit(1).maybeSingle();
    return json({ head: data || null });
  }
  return json({ error: 'unknown op' }, 400);
}
