import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!jwtToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { storagePath, originalName, totalSize, totalFiles } = await req.json();

    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'storagePath is required' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { data: job, error: jobError } = await supabase
      .from('migration_jobs')
      .insert({
        user_id: user.id,
        source_platform: 'zip-upload',
        status: 'scheduled',
        total_files: totalFiles || 0,
        settings: {
          storagePath,
          originalName,
          totalSize: totalSize || 0,
          totalFiles: totalFiles || 0,
          processedSize: 0,
        }
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return new Response(JSON.stringify({ job }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
