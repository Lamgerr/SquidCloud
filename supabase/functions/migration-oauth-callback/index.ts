import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = 'https://squidcloud.vercel.app/oauth/migration-callback';
const BASE_URL = 'https://squidcloud.vercel.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // POST from Vercel ImportOAuthCallback page
  if (req.method === 'POST') {
    try {
      const { code, state } = await req.json();

      if (!code || !state) {
        return json({ error: 'Missing authorization code or state' }, 400);
      }

      const [stateToken, userId, platform] = state.split(':');
      if (!stateToken || !userId || !platform) {
        return json({ error: 'Invalid state parameter' }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: job } = await supabase
        .from('migration_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('source_platform', platform)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!job || job.settings?.oauth_state !== stateToken) {
        return json({ error: 'Invalid state parameter' }, 400);
      }

      let tokenData;
      switch (platform) {
        case 'google-drive':
          tokenData = await exchangeGoogleCode(code);
          break;
        case 'dropbox':
          tokenData = await exchangeDropboxCode(code);
          break;
        case 'onedrive':
          tokenData = await exchangeOneDriveCode(code);
          break;
        default:
          return json({ error: `Unsupported platform: ${platform}` }, 400);
      }

      await supabase
        .from('migration_jobs')
        .update({
          status: 'authenticated',
          settings: {
            ...job.settings,
            oauth_tokens: tokenData,
            oauth_state: null
          }
        })
        .eq('id', job.id);

      return json({ success: true, platform, jobId: job.id });

    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }

  // GET from provider redirect (legacy fallback)
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent(errorParam)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent('Missing authorization code or state')}`, 302);
    }

    const [stateToken, userId, platform] = state.split(':');
    if (!stateToken || !userId || !platform) {
      return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent('Invalid state parameter')}`, 302);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('source_platform', platform)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!job || job.settings?.oauth_state !== stateToken) {
      return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent('Invalid state parameter')}`, 302);
    }

    let tokenData;
    switch (platform) {
      case 'google-drive':
        tokenData = await exchangeGoogleCode(code);
        break;
      case 'dropbox':
        tokenData = await exchangeDropboxCode(code);
        break;
      case 'onedrive':
        tokenData = await exchangeOneDriveCode(code);
        break;
      default:
        return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent(`Unsupported platform: ${platform}`)}`, 302);
    }

    await supabase
      .from('migration_jobs')
      .update({
        status: 'authenticated',
        settings: {
          ...job.settings,
          oauth_tokens: tokenData,
          oauth_state: null
        }
      })
      .eq('id', job.id);

    return Response.redirect(
      `${BASE_URL}/oauth/migration-callback?platform=${encodeURIComponent(platform)}&jobId=${encodeURIComponent(job.id)}`,
      302
    );

  } catch (error) {
    const msg = error.message.replace(/'/g, "\\'");
    return Response.redirect(`${BASE_URL}/oauth/migration-callback?error=${encodeURIComponent(msg)}`, 302);
  }
});

async function exchangeGoogleCode(code: string) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Google Drive OAuth not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Google token exchange failed: ${tokenResponse.status} - ${errorBody}`);
  }

  return await tokenResponse.json();
}

async function exchangeDropboxCode(code: string) {
  const appKey = Deno.env.get('DROPBOX_APP_KEY');
  const appSecret = Deno.env.get('DROPBOX_APP_SECRET');
  if (!appKey || !appSecret) {
    throw new Error('Dropbox OAuth not configured');
  }

  const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appKey,
      client_secret: appSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Dropbox token exchange failed: ${tokenResponse.status} - ${errorBody}`);
  }

  return await tokenResponse.json();
}

async function exchangeOneDriveCode(code: string) {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('OneDrive OAuth not configured');
  }

  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`OneDrive token exchange failed: ${tokenResponse.status} - ${errorBody}`);
  }

  return await tokenResponse.json();
}
