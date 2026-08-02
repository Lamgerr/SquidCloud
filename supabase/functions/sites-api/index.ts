import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emitWebhookEvent } from "../_shared/webhook-emitter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const SITES_BUCKET = 'squid-sites';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'site';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return json({ error: 'Unauthorized' }, 401);

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return json({ error: 'Invalid token' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body OK */ }

  const action = body.action as string || '';

  try {
    // action: create - Create new publication record
    if (action === 'create') {
      const { resourceId, resourceType, siteName, visibility, fileCount, totalSizeBytes } = body;

      if (!resourceId || !resourceType) {
        return json({ error: 'resourceId and resourceType are required' }, 400);
      }
      if (!['file', 'folder'].includes(resourceType as string)) {
        return json({ error: 'resourceType must be file or folder' }, 400);
      }

      let resourceName = siteName as string | undefined;
      if (!resourceName) {
        if (resourceType === 'file') {
          const { data: file } = await supabase.from('files').select('name').eq('id', resourceId).eq('user_id', user.id).single();
          if (!file) return json({ error: 'File not found' }, 404);
          resourceName = file.name.replace(/\.html?$/, '');
        } else {
          const { data: folder } = await supabase.from('folders').select('name').eq('id', resourceId).eq('user_id', user.id).single();
          if (!folder) return json({ error: 'Folder not found' }, 404);
          resourceName = folder.name;
        }
      }

      let siteSlug = slugify(resourceName);
      if (siteSlug.length < 3) siteSlug = siteSlug + '-site';
      if (siteSlug.length > 48) siteSlug = siteSlug.slice(0, 48);

      const { count } = await supabase.from('site_publications').select('*', { head: true, count: 'exact' }).eq('site_slug', siteSlug);
      if (count && count > 0) {
        const { count: userSites } = await supabase.from('site_publications').select('*', { head: true, count: 'exact' }).eq('owner_id', user.id);
        siteSlug = `${siteSlug}-${(userSites || 0) + 1}`;
      }

      const siteUrl = `https://squidcloud.vercel.app/api/serve/${user.id}/${siteSlug}`;

      const { data: pub, error: insertError } = await supabase.from('site_publications').insert({
        resource_id: resourceId,
        resource_type: resourceType,
        owner_id: user.id,
        site_slug: siteSlug,
        site_url: siteUrl,
        visibility: visibility || 'public',
        file_count: (fileCount as number) || 0,
        total_size_bytes: (totalSizeBytes as number) || 0,
        status: 'live',
      }).select().single();

      if (insertError) return json({ error: insertError.message }, 500);

      void emitWebhookEvent({
        userId: user.id,
        event: 'site.published',
        data: {
          site_id: pub.id,
          site_slug: pub.site_slug,
          site_name: siteSlug,
          url: siteUrl,
          visibility: pub.visibility,
          published_at: new Date().toISOString(),
        },
      });

      return json({ publication: pub, siteSlug, siteUrl });
    }

    // action: list - List user's publications
    if (action === 'list') {
      const { data: pubs } = await supabase.from('site_publications').select('*').eq('owner_id', user.id).order('published_at', { ascending: false });
      return json({ publications: pubs || [] });
    }

    // action: status - Get publication status for a resource
    if (action === 'status') {
      const resourceId = body.resourceId as string;
      if (!resourceId) return json({ error: 'resourceId required' }, 400);
      const { data: pub } = await supabase.from('site_publications').select('*')
        .eq('resource_id', resourceId).eq('owner_id', user.id).maybeSingle();
      return json({ publication: pub || null });
    }

    // action: update - Update publication fields
    if (action === 'update') {
      const slug = body.slug as string;
      if (!slug) return json({ error: 'slug required' }, 400);

      const { data: pub } = await supabase.from('site_publications').select('*').eq('site_slug', slug).eq('owner_id', user.id).single();
      if (!pub) return json({ error: 'Publication not found' }, 404);

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.visibility) updateData.visibility = body.visibility;
      if (body.fileCount !== undefined) updateData.file_count = body.fileCount;
      if (body.totalSizeBytes !== undefined) updateData.total_size_bytes = body.totalSizeBytes;

      const { data: updated } = await supabase.from('site_publications').update(updateData).eq('id', pub.id).select().single();
      return json({ publication: updated });
    }

    // action: visibility - Toggle public/private
    if (action === 'visibility') {
      const slug = body.slug as string;
      const visibility = body.visibility as string;
      if (!slug) return json({ error: 'slug required' }, 400);
      if (!['public', 'private'].includes(visibility)) return json({ error: 'visibility must be public or private' }, 400);

      const { data: pub } = await supabase.from('site_publications').select('*').eq('site_slug', slug).eq('owner_id', user.id).single();
      if (!pub) return json({ error: 'Publication not found' }, 404);

      const { data: updated } = await supabase.from('site_publications').update({ visibility, updated_at: new Date().toISOString() }).eq('id', pub.id).select().single();
      return json({ publication: updated });
    }

    // action: unpublish - Delete publication and files
    if (action === 'unpublish') {
      const slug = body.slug as string;
      if (!slug) return json({ error: 'slug required' }, 400);

      const { data: pub } = await supabase.from('site_publications').select('*').eq('site_slug', slug).eq('owner_id', user.id).single();
      if (!pub) return json({ error: 'Publication not found' }, 404);

      const { data: files } = await supabase.storage.from(SITES_BUCKET).list(slug, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map(f => `${slug}/${f.name}`);
        await supabase.storage.from(SITES_BUCKET).remove(paths);
      }

      await supabase.from('site_publications').delete().eq('id', pub.id);

      void emitWebhookEvent({
        userId: user.id,
        event: 'site.unpublished',
        data: {
          site_id: pub.id,
          site_slug: pub.site_slug,
          site_name: pub.site_slug,
          unpublished_at: new Date().toISOString(),
        },
      });

      return json({ success: true, message: 'Site unpublished' });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
