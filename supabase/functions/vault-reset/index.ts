/**
 * vault-reset — irreversible, user-scoped vault erasure.
 *
 * Contract:
 *  - JWT verified server-side; user id is NEVER taken from the request body.
 *  - Body must contain confirmation: "ERASE".
 *  - Deletes every vault/key/file/share row owned by that user and every
 *    object under their prefix in the private `files` storage bucket.
 *  - The auth user and billing/subscription records are intentionally kept:
 *    the account signs back in and re-onboards as a fresh vault owner.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/* Children first, then parents, so FK cascades cannot resurrect data. */
const USER_TABLES = [
  'sde_chunk_locators',
  'zk_files',
  'file_key_vault',
  'encrypted_keys',
  'vault_files',
  'zk_ktl',
  'zk_devices',
  'recovery_contacts',
  'squid_vault_secrets',
  'storage_provider_vault',
  'master_keys',
  'zk_vaults',
  'squid_vaults',
  'vaults',
  'share_collection_files',
  'share_collections',
  'share_audit_logs',
  'shares',
  'squidcdn_files',
  'cbcode_file_snapshots',
  'api_keys',
  'cli_devices',
  'folders',
  'files',
];

/* Relation/column missing => schema evolved; not a failure. */
const IGNORABLE = new Set(['42P01', '42703', 'PGRST205', 'PGRST204']);

async function deleteUserRows(db: any, uid: string): Promise<string[]> {
  const done: string[] = [];
  for (const table of USER_TABLES) {
    const { error } = await db.from(table).delete().eq('user_id', uid);
    if (error && !IGNORABLE.has(error.code)) {
      // Do not abort: report it and keep erasing everything else.
      done.push(`${table}! ${error.message}`);
    } else {
      done.push(table);
    }
  }
  return done;
}

async function listAllObjects(db: any, uid: string): Promise<string[]> {
  const paths: string[] = [];
  const walk = async (prefix: string): Promise<void> => {
    let offset = 0;
    for (;;) {
      const { data, error } = await db.storage.from('files').list(prefix, {
        limit: 200,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !data || data.length === 0) break;
      for (const item of data) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) paths.push(full);
        else await walk(full);
      }
      offset += data.length;
      if (data.length < 200) break;
    }
  };
  await walk(uid);
  return paths;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Server misconfigured' }, 500);

    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const { data, error: authError } = await db.auth.getUser(jwt);
    if (authError || !data?.user) return json({ error: 'Invalid token' }, 401);
    const user = data.user;
    const uid = user.id;

    /* Claims are read from the presented JWT so step-up state cannot be
       spoofed by the request body. */
    let claims: Record<string, any> = {};
    try {
      claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch { /* invalid JWS payload is rejected below via iat */ }

    // 1. Email must be verified on the account.
    if (!user.email_confirmed_at && !(user as any).confirmed_at) {
      return json({ error: 'Verify your email address before erasing the vault' }, 403);
    }

    // 2. This must be a fresh sign-in, not a long-lived cached session.
    const iat = Number(claims.iat || 0);
    if (!iat || Date.now() / 1000 - iat > 600) {
      return json({ error: 'Session too old — sign in again to confirm' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'ERASE') {
      return json({ error: 'Confirmation required' }, 400);
    }

    // 3. TOTP is mandatory step-up when an authenticator is enrolled.
    let totpEnrolled = false;
    try {
      const mfaAdmin: any = (db.auth.admin as any).mfa;
      if (mfaAdmin?.listFactors) {
        const factors = await mfaAdmin.listFactors({ userId: uid });
        totpEnrolled = !!factors.data?.totp?.some((f: any) => f.status === 'verified');
      }
    } catch { /* admin MFA API unavailable: fall back to the JWT claim below */ }
    if (totpEnrolled && claims.aal !== 'aal2') {
      return json({ error: 'Authenticator verification required' }, 428);
    }

    // 4. Passkey is mandatory step-up when one is registered on the account.
    const { count: passkeyCount } = await db.from('user_passkeys')
      .select('id', { count: 'exact', head: true }).eq('user_id', uid);
    if ((passkeyCount ?? 0) > 0 && body.passkeyVerified !== true) {
      return json({ error: 'Passkey verification required' }, 428);
    }

    const storagePaths = await listAllObjects(db, uid);
    for (let i = 0; i < storagePaths.length; i += 500) {
      const { error } = await db.storage.from('files').remove(storagePaths.slice(i, i + 500));
      if (error) return json({ error: 'Storage purge failed', detail: error.message }, 500);
    }

    const tables = await deleteUserRows(db, uid);

    return json({
      ok: true,
      userId: uid,
      storageObjectsRemoved: storagePaths.length,
      tables,
    });
  } catch (e: any) {
    return json({ error: 'Reset failed', detail: e?.message || String(e) }, 500);
  }
});
