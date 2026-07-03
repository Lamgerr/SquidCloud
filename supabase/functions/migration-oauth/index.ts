import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

interface OAuthUrls {
  [key: string]: {
    authUrl: string;
    clientId: string;
    redirectUri: string;
    scope: string;
  };
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'migration-oauth', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders() });
    }

    try {
      const { platform } = await req.json();

      if (!platform) {
        return jsonResponse({ error: "Platform is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const userId = ctx.userId;

      // Define OAuth configurations with correct redirect URIs
      const baseRedirectUri = `https://squidcloud.vercel.app/oauth/migration-callback`;

      const oauthConfigs: OAuthUrls = {
        'google-drive': {
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          clientId: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          redirectUri: baseRedirectUri,
          scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email'
        },
        'dropbox': {
          authUrl: 'https://www.dropbox.com/oauth2/authorize',
          clientId: Deno.env.get('DROPBOX_APP_KEY') || '',
          redirectUri: baseRedirectUri,
          scope: 'files.metadata.read files.content.read'
        },
        'onedrive': {
          authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          clientId: Deno.env.get('MICROSOFT_CLIENT_ID') || '',
          redirectUri: baseRedirectUri,
          scope: 'Files.Read Files.Read.All User.Read offline_access'
        }
      };

      const config = oauthConfigs[platform];
      if (!config) {
        return jsonResponse({ error: "Unsupported platform" }, 400);
      }

      if (!config.clientId) {
        return jsonResponse({ error: `${platform} client ID not configured` }, 500);
      }

      // Generate state parameter for security
      const state = crypto.randomUUID();

      // Create migration job
      const { data: job, error: jobError } = await supabase
        .from('migration_jobs')
        .insert({
          user_id: userId,
          source_platform: platform,
          status: 'pending',
          settings: { oauth_state: state }
        })
        .select()
        .single();

      if (jobError) {
        throw jobError;
      }

      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scope,
        response_type: 'code',
        state: `${state}:${userId}:${platform}`,
        access_type: 'offline',
        prompt: 'consent'
      });

      const authUrl = `${config.authUrl}?${params.toString()}`;

      return jsonResponse({ authUrl, state, job });

    } catch (error) {
      console.error("Error in migration-oauth:", error);

      return jsonResponse({ error: "Internal server error" }, 500);
    }
  })
});
