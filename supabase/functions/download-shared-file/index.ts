
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'download-shared-file', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { shareId, password } = await req.json();
      
      if (!shareId) {
        return jsonResponse({ error: "Share ID is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error: shareError } = await supabase
        .rpc('get_shared_file_info', { share_id_param: shareId });
        
      if (shareError || !data || data.length === 0) {
        console.error('Share validation error:', shareError);
        return jsonResponse({ error: "Share not found or has been revoked" }, 404);
      }

      const shareInfo = data[0];

      if (shareInfo.share_expires_at) {
        const expiresAt = new Date(shareInfo.share_expires_at);
        if (expiresAt < new Date()) {
          return jsonResponse({ error: "This share link has expired" }, 403);
        }
      }

      // SECURITY: access_code is never returned by get_shared_file_info.
      // Validate it with a service-role lookup inside this trusted function.
      const { data: shareRow } = await supabase
        .from('shares')
        .select('access_code, is_active')
        .eq('share_id', shareId)
        .maybeSingle();
      const requiredCode = shareRow?.access_code?.trim();
      if (requiredCode && requiredCode !== password) {
        return jsonResponse({ error: "Invalid password", requiresPassword: true }, 401);
      }
      if (shareRow && shareRow.is_active === false) {
        return jsonResponse({ error: "Share link is no longer active" }, 403);
      }
      
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .select('storage_path, user_id, type, name')
        .eq('id', shareInfo.file_id)
        .single();
      
      if (fileError || !fileRecord) {
        console.error('File lookup error:', fileError);
        return jsonResponse({ error: "File not found" }, 404);
      }
      
      const { data: userRepos, error: repoError } = await supabase
        .from('repositories')
        .select('repo_name, node_id')
        .eq('user_id', fileRecord.user_id);
      
      if (repoError || !userRepos || userRepos.length === 0) {
        console.error('Repo lookup error:', repoError);
        return jsonResponse({ error: "Storage repository not found" }, 500);
      }
      
      const repo = userRepos[0];
      const storagePath = fileRecord.storage_path || `${fileRecord.user_id}/${shareInfo.file_name || fileRecord.name}`;
      
      const response = await supabase.functions.invoke('github-storage', {
        body: { 
          action: 'download', 
          path: storagePath,
          repo: repo.repo_name,
          nodeId: repo.node_id
        }
      });
      
      if (response.error || !response.data) {
        console.error('Storage download error:', response.error);
        return jsonResponse({ error: "Failed to download file from storage" }, 500);
      }
      
      return jsonResponse({ 
        content: response.data.content, 
        contentType: shareInfo.file_type || fileRecord.type,
        fileName: shareInfo.file_name || fileRecord.name,
        fileSize: shareInfo.file_size
      });
      
    } catch (error) {
      console.error("Error downloading shared file:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  });
});
