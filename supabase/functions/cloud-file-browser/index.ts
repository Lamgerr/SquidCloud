import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() });
  }
  return withPrelGateway(req, { functionId: 'cloud-file-browser', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { jobId, path = '', action = 'list' } = await req.json();

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: job, error: jobError } = await supabase
        .from('migration_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', ctx.userId)
        .single();

      if (jobError || !job) {
        throw new Error('Migration job not found');
      }

      const tokens = job.settings?.oauth_tokens;
      if (!tokens) {
        throw new Error('No OAuth tokens found');
      }

      if (action === 'storage-info') {
        let storage;
        switch (job.source_platform) {
          case 'google-drive':
            storage = await getGoogleDriveStorage(tokens);
            break;
          case 'dropbox':
            storage = await getDropboxStorage(tokens);
            break;
          case 'onedrive':
            storage = await getOneDriveStorage(tokens);
            break;
          default:
            throw new Error(`Unsupported platform: ${job.source_platform}`);
        }
        return jsonResponse({ storage });
      }

      let files;
      switch (job.source_platform) {
        case 'google-drive':
          files = await listGoogleDriveFiles(tokens, path);
          break;
        case 'dropbox':
          files = await listDropboxFiles(tokens, path);
          break;
        case 'onedrive':
          files = await listOneDriveFiles(tokens, path);
          break;
        default:
          throw new Error(`Unsupported platform: ${job.source_platform}`);
      }

      return jsonResponse({ files });

    } catch (error) {
      console.error("Cloud file browser error:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  });
});
