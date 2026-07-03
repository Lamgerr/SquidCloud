import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

interface DownloadRequest {
  action: 'create' | 'update_status' | 'update_progress';
  fileId: string;
  status?: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progress?: number;
  downloadSpeed?: number;
  estimatedTime?: number;
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'download-manager', operation: 'default' }, async (ctx: PrelContext) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, fileId, status, progress, downloadSpeed, estimatedTime }: DownloadRequest = await req.json();

    switch (action) {
      case 'create':
        const { data: fileData, error: fileError } = await supabaseClient
          .from('files')
          .select('size')
          .eq('id', fileId)
          .eq('user_id', ctx.userId)
          .single();

        if (fileError || !fileData) {
          return jsonResponse({ error: 'File not found' }, 404);
        }

        const { data: downloadData, error: downloadError } = await supabaseClient
          .from('downloads')
          .insert({
            user_id: ctx.userId,
            file_id: fileId,
            total_bytes: fileData.size,
            status: 'queued',
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (downloadError) throw downloadError;

        return jsonResponse({ download: downloadData });

      case 'update_status':
        const updateData: any = { status };
        
        if (status === 'downloading' && !progress) {
          updateData.started_at = new Date().toISOString();
        }
        
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.progress = 100;
        }

        const { error: statusError } = await supabaseClient
          .from('downloads')
          .update(updateData)
          .eq('file_id', fileId)
          .eq('user_id', ctx.userId);

        if (statusError) throw statusError;

        return jsonResponse({ message: 'Status updated successfully' });

      case 'update_progress':
        const progressData: any = { 
          progress: progress || 0,
          download_speed: downloadSpeed || 0,
          estimated_time: estimatedTime || 0,
          bytes_downloaded: Math.floor((progress || 0) / 100 * (await getFileSize(supabaseClient, fileId, ctx.userId)))
        };

        const { error: progressError } = await supabaseClient
          .from('downloads')
          .update(progressData)
          .eq('file_id', fileId)
          .eq('user_id', ctx.userId);

        if (progressError) throw progressError;

        return jsonResponse({ message: 'Progress updated successfully' });

      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }

  } catch (error) {
    console.error('Download manager error:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
}
);
});

async function getFileSize(supabaseClient: any, fileId: string, userId: string): Promise<number> {
  const { data } = await supabaseClient
    .from('files')
    .select('size')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();
  
  return data?.size || 0;
}
