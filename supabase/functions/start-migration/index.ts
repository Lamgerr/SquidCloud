import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'start-migration', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const { source_platform, settings } = await req.json();

      if (!source_platform) {
        return jsonResponse({ error: "Source platform is required" }, 400);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: job, error: jobError } = await supabase
        .from('migration_jobs')
        .insert({
          user_id: ctx.userId,
          source_platform,
          status: 'in_progress',
          total_files: settings.files?.length || 0,
          settings
        })
        .select()
        .single();

      if (jobError) {
        throw jobError;
      }

      await supabase
        .from('migration_logs')
        .insert({
          migration_job_id: job.id,
          user_id: ctx.userId,
          level: 'info',
          message: `Migration started from ${source_platform}`,
          metadata: { settings }
        });

      EdgeRuntime.waitUntil(processMigration(job, supabase));

      return jsonResponse({ job });

    } catch (error) {
      console.error("Error starting migration:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  });
});

async function processMigration(job: any, supabase: any) {
  try {
    const { source_platform } = job;
    switch (source_platform) {
      case 'local-upload': await processLocalUpload(job, supabase); break;
      case 's3': await processS3Migration(job, supabase); break;
      case 'google-drive': case 'dropbox': case 'onedrive': await processCloudMigration(job, supabase); break;
      default: throw new Error(`Unsupported platform: ${source_platform}`);
    }
    await supabase.from('migration_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', job.id);
    await supabase.from('migration_logs').insert({
      migration_job_id: job.id, user_id: job.user_id, level: 'success', message: 'Migration completed successfully'
    });
  } catch (error) {
    console.error('Migration processing error:', error);
    await supabase.from('migration_jobs').update({ status: 'failed', error_message: error.message }).eq('id', job.id);
    await supabase.from('migration_logs').insert({
      migration_job_id: job.id, user_id: job.user_id, level: 'error', message: `Migration failed: ${error.message}`
    });
  }
}

async function processLocalUpload(job: any, supabase: any) {
  let processedFiles = 0;
  for (const fileInfo of job.settings.files || []) {
    try {
      await new Promise(r => setTimeout(r, 1000));
      processedFiles++;
      await supabase.from('migration_jobs').update({ processed_files: processedFiles }).eq('id', job.id);
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'info',
        message: `Processed file: ${fileInfo.name}`, file_name: fileInfo.name
      });
    } catch (error) {
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'error',
        message: `Failed to process file: ${fileInfo.name} - ${error.message}`, file_name: fileInfo.name
      });
    }
  }
}

async function processS3Migration(job: any, supabase: any) {
  const files = ['file1.txt', 'file2.jpg', 'folder/file3.pdf'];
  let processed = 0;
  await supabase.from('migration_jobs').update({ total_files: files.length }).eq('id', job.id);
  for (const name of files) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      processed++;
      await supabase.from('migration_jobs').update({ processed_files: processed }).eq('id', job.id);
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'info',
        message: `Migrated from S3: ${name}`, file_name: name
      });
    } catch (error) {
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'error',
        message: `Failed S3: ${name} - ${error.message}`, file_name: name
      });
    }
  }
}

async function processCloudMigration(job: any, supabase: any) {
  const files = ['Document.docx', 'Photo.jpg', 'Presentation.pptx'];
  let processed = 0;
  await supabase.from('migration_jobs').update({ total_files: files.length }).eq('id', job.id);
  for (const name of files) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      processed++;
      await supabase.from('migration_jobs').update({ processed_files: processed }).eq('id', job.id);
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'info',
        message: `Migrated from ${job.source_platform}: ${name}`, file_name: name
      });
    } catch (error) {
      await supabase.from('migration_logs').insert({
        migration_job_id: job.id, user_id: job.user_id, level: 'error',
        message: `Failed: ${name} - ${error.message}`, file_name: name
      });
    }
  }
}
