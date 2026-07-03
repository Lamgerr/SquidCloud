import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }
  return withPrelGateway(req, { functionId: 'check-admin-status', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseKey) {
        return jsonResponse({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }, 500);
      }
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", ctx.userId)
        .single();

      const isAdmin = !!profile?.is_admin;

      return jsonResponse({ isAdmin });

    } catch (error) {
      console.error("Error checking admin status:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  });
});
