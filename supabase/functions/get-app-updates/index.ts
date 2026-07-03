
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'get-app-updates', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { platform, currentVersion } = await req.json();
      
      if (!platform) {
        return jsonResponse({ error: "Platform is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: latestVersion, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', platform)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        return jsonResponse({ latestVersion: null, updateRequired: false });
      }
      
      let updateRequired = false;
      if (currentVersion) {
        updateRequired = latestVersion.version !== currentVersion;
      }
      
      return jsonResponse({ latestVersion, updateRequired });
      
    } catch (error) {
      console.error("Error fetching app updates:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  });
});
