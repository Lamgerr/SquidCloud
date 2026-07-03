import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'generate-pdf-url', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { fileId } = await req.json()

      if (!fileId) {
        return jsonResponse({ error: 'Invalid request parameters' }, 400)
      }

      console.log('Generating PDF URL for file:', fileId, 'user:', ctx.userId)

      const { data: fileData, error: fileError } = await supabaseClient
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single()

      if (fileError || !fileData) {
        console.error('File not found:', fileError)
        return jsonResponse({ error: 'File not found' }, 404)
      }

      const hasAccess = fileData.user_id === ctx.userId || fileData.shared

      if (!hasAccess && fileData.user_id !== ctx.userId) {
        const { data: shareData, error: shareError } = await supabaseClient
          .from('shares')
          .select('id, share_type, allowed_users, expires_at, is_active')
          .eq('file_id', fileId)
          .eq('is_active', true)
          .or(`share_type.eq.public,allowed_users.cs.{${ctx.userId}}`)
          .maybeSingle()

        if (shareError || !shareData) {
          return jsonResponse({ error: 'Access denied' }, 403)
        }

        if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
          return jsonResponse({ error: 'Access denied' }, 403)
        }
      }

      const isPDF = fileData.type?.includes('pdf') || 
                    fileData.name?.toLowerCase().endsWith('.pdf')

      if (!isPDF) {
        return jsonResponse({ error: 'File is not a PDF document' }, 400)
      }

      let secureUrl: string
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000))

      if (fileData.encrypted && fileData.storage_path === 'res54_distributed') {
        secureUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/encrypted/${fileData.id}?expires=${expiresAt.getTime()}`
      } else {
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
          .from('files')
          .createSignedUrl(fileData.storage_path, 24 * 3600)

        if (signedUrlError || !signedUrlData) {
          console.error('Error generating signed URL:', signedUrlError)
          return jsonResponse({ error: 'Failed to generate secure URL' }, 500)
        }

        secureUrl = signedUrlData.signedUrl
      }

      console.log('PDF URL generated successfully for file:', fileId)

      await supabaseClient
        .from('pdf_secure_urls')
        .upsert({
          file_id: fileId,
          user_id: ctx.userId,
          secure_url: secureUrl,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })

      return jsonResponse({
        url: secureUrl,
        fileName: fileData.name,
        expiresAt: expiresAt.toISOString(),
        encrypted: fileData.encrypted || false
      })

    } catch (error) {
      console.error('Error in generate-pdf-url function:', error)
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
  });
});
