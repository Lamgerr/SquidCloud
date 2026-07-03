
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'add-app-update', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { version, platform, changelog, download_url, size, is_mandatory } = await req.json();
      
      if (!version || !platform || !changelog || !download_url) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', ctx.userId)
        .single();

      if (profileError || !profile || !profile.is_admin) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }

      const { data, error } = await supabase
        .from('app_versions')
        .insert({
          version,
          platform,
          changelog,
          download_url,
          size: size || 0,
          is_mandatory: is_mandatory || false,
          released_by: ctx.userId,
        })
        .select('*')
        .single();
        
      if (error) {
        throw new Error(error.message);
      }
      
      return jsonResponse({ success: true, data });
      
    } catch (error) {
      console.error("Error adding app update:", error);
      
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  });
});
