import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const DAYS_THRESHOLD = 50;
const BACKUP_FOLDER_PREFIX = 'autoBackup';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const url = new URL(req.url);
  const isManual = url.searchParams.get('manual') === 'true';
  const dryRun = url.searchParams.get('dry_run') === 'true';

  if (!isManual) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const cutoff = new Date(Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString();
    const backupDate = new Date().toISOString().slice(0, 10);
    const results: Record<string, unknown>[] = [];
    let totalFreed = 0;
    let archivedCount = 0;

    // ── Archive Files ────────────────────────────────────
    const { data: expiredFiles } = await supabase
      .from('files')
      .select('id, user_id, name, size, storage_path, parent_folder')
      .is('archived', false)
      .or(`last_accessed_at.lt.${cutoff},last_accessed_at.is.null`)
      .lte('updated_at', cutoff);

    for (const file of expiredFiles || []) {
      if (dryRun) {
        results.push({ type: 'file', id: file.id, name: file.name, action: 'would_archive' });
        totalFreed += (file.size || 0);
        archivedCount++;
        continue;
      }

      try {
        const backupPath = `${file.user_id}/${BACKUP_FOLDER_PREFIX}[${backupDate}]/${file.name}`;

        // Copy file within storage to backup location
        const { data: copyResult, error: copyError } = await supabase.storage
          .from('files')
          .copy(file.storage_path || `${file.user_id}/${file.parent_folder || ''}/${file.name}`, backupPath);

        if (copyError) throw copyError;

        // Remove original
        await supabase.storage.from('files').remove([file.storage_path || `${file.user_id}/${file.parent_folder || ''}/${file.name}`]);

        // Mark as archived
        await supabase.from('files').update({
          archived: true,
          archived_at: new Date().toISOString(),
          storage_path: backupPath,
          parent_folder: `${BACKUP_FOLDER_PREFIX}[${backupDate}]`,
        }).eq('id', file.id);

        results.push({ type: 'file', id: file.id, name: file.name, action: 'archived', backup_path: backupPath });
        totalFreed += (file.size || 0);
        archivedCount++;
      } catch (err: any) {
        results.push({ type: 'file', id: file.id, name: file.name, action: 'error', error: err.message });
      }
    }

    // ── Archive Sites ────────────────────────────────────
    const { data: expiredSites } = await supabase
      .from('site_publications')
      .select('id, user_id, site_slug, storage_path')
      .is('archived', false)
      .or(`last_accessed_at.lt.${cutoff},last_accessed_at.is.null`)
      .lte('updated_at', cutoff);

    for (const site of expiredSites || []) {
      if (dryRun) {
        results.push({ type: 'site', id: site.id, slug: site.site_slug, action: 'would_archive' });
        archivedCount++;
        continue;
      }

      try {
        const archivePath = `${site.user_id}/${BACKUP_FOLDER_PREFIX}[${backupDate}]/sites/${site.site_slug}`;
        const { error: copyError } = await supabase.storage
          .from('squid-sites')
          .copy(site.storage_path || site.site_slug, archivePath);

        if (copyError) throw copyError;

        await supabase.storage.from('squid-sites').remove([site.storage_path || site.site_slug]);

        await supabase.from('site_publications').update({
          archived: true,
          archived_at: new Date().toISOString(),
          storage_path: archivePath,
        }).eq('id', site.id);

        results.push({ type: 'site', id: site.id, slug: site.site_slug, action: 'archived' });
        archivedCount++;
      } catch (err: any) {
        results.push({ type: 'site', id: site.id, slug: site.site_slug, action: 'error', error: err.message });
      }
    }

    // Log cleanup run
    await supabase.from('storage_cleanup_log').insert({
      files_archived: expiredFiles?.length || 0,
      sites_archived: expiredSites?.length || 0,
      storage_freed_bytes: totalFreed,
      status: 'completed',
      details: results,
    });

    return json({
      success: true,
      dry_run: dryRun,
      archived: archivedCount,
      storage_freed_bytes: totalFreed,
      details: results,
    });
  } catch (err: any) {
    return json({ error: err.message, success: false }, 500);
  }
});