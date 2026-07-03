import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

interface TrashRequest {
  action: 'cleanup' | 'restore' | 'permanent_delete';
  fileId?: string;
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'trash-operations', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { action, fileId }: TrashRequest = await req.json();

      switch (action) {
        case 'cleanup':
          const { error: cleanupError } = await supabaseClient.rpc('cleanup_trashed_files');
          if (cleanupError) throw cleanupError;
          
          return jsonResponse({ message: 'Cleanup completed successfully' });

        case 'restore':
          if (!fileId) {
            return jsonResponse({ error: 'File ID required for restore action' }, 400);
          }

          const { error: restoreError } = await supabaseClient.rpc('restore_from_trash', {
            file_uuid: fileId
          });
          if (restoreError) throw restoreError;

          return jsonResponse({ message: 'File restored successfully' });

        case 'permanent_delete':
          if (!fileId) {
            return jsonResponse({ error: 'File ID required for permanent delete action' }, 400);
          }

          const { error: deleteError } = await supabaseClient
            .from('files')
            .delete()
            .eq('id', fileId)
            .eq('user_id', ctx.userId);

          if (deleteError) throw deleteError;

          return jsonResponse({ message: 'File permanently deleted' });

        default:
          return jsonResponse({ error: 'Invalid action' }, 400);
      }

    } catch (error) {
      console.error('Trash operation error:', error);
      return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
  });
});