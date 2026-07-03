import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'verify-admin', operation: 'default' }, async (ctx: PrelContext) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(req.url).origin;

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return jsonResponse({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", ctx.userId)
      .single();

    if (!profile?.is_admin) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    return jsonResponse({ verified: true });
  });
});
