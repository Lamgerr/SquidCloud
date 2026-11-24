
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';
import { sendSignal } from '../_shared/signals.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'validate-share', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { shareId, password } = await req.json();
      
      if (!shareId) {
        return jsonResponse({ success: false, message: "Share ID is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .rpc('get_shared_file_info', { share_id_param: shareId });

      if (error || !data || data.length === 0) {
        return jsonResponse({ success: false, message: "Share not found or may have been removed" }, 404);
      }

      const shareInfo = data[0];

      // SECURITY: access_code is deliberately NOT returned by get_shared_file_info
      // (it must never reach an anonymous caller). Validate the password with a
      // service-role lookup here, inside the trusted function.
      const { data: shareRow } = await supabase
        .from('shares')
        .select('access_code, is_active, expires_at')
        .eq('share_id', shareId)
        .maybeSingle();

      const requiredCode = shareRow?.access_code?.trim();
      if (requiredCode && requiredCode !== password) {
        return jsonResponse({
          success: false,
          message: "Password required",
          requiresPassword: true,
        }, 401);
      }
      if (shareRow && shareRow.is_active === false) {
        return jsonResponse({ success: false, message: "This share link is no longer active" }, 403);
      }

      if (shareInfo.share_expires_at) {
        const expiresAt = new Date(shareInfo.share_expires_at);
        if (expiresAt < new Date()) {
          return jsonResponse({ success: false, message: "This share link has expired" }, 403);
        }
      }

      // Notify the share owner once per share per day.
      if (shareInfo.owner_id) {
        void sendSignal({
          service_id: 'cloudbliss',
          user_id: shareInfo.owner_id,
          type: 'share_viewed',
          severity: 'info',
          title: `Your file '${shareInfo.file_name}' was viewed`,
          body: 'Someone opened your shared link.',
          link: '/dashboard',
          idempotency_key: `share_viewed:${shareId}:${new Date().toISOString().slice(0, 10)}`,
        });
      }

      return jsonResponse({ 
        success: true, 
        file: {
          id: shareInfo.file_id,
          name: shareInfo.file_name,
          type: shareInfo.file_type,
          size: shareInfo.file_size,
          created_at: shareInfo.file_created_at,
          updated_at: shareInfo.file_updated_at,
          encrypted: shareInfo.is_encrypted,
          storage_path: shareInfo.storage_path,
          user_id: shareInfo.owner_id,
          share_created_at: shareInfo.share_created_at,
          share_expires_at: shareInfo.share_expires_at
        },
        message: "Share link is valid" 
      });
      
    } catch (error) {
      console.error("Error validating share:", error);
      
      return jsonResponse({ 
        success: false, 
        message: "Internal server error while validating share link" 
      }, 500);
    }
  });
});
