import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders() })
  }
  return withPrelGateway(req, { functionId: 'api-file-delete', operation: 'default' }, async (ctx: PrelContext) => {
    const startTime = Date.now()
    let statusCode = 500
    let errorMessage = null

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer cb_')) {
        statusCode = 401
        throw new Error('Invalid API key format')
      }

      const apiKey = authHeader.replace('Bearer ', '')

      const encoder = new TextEncoder()
      const data = encoder.encode(apiKey)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('user_id, name, scopes, is_active')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

      if (keyError || !keyData) {
        statusCode = 401
        throw new Error('Invalid or inactive API key')
      }

      if (!keyData.scopes.includes('delete')) {
        statusCode = 403
        throw new Error('API key does not have delete permissions')
      }

      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', keyHash)

      const url = new URL(req.url)
      const fileId = url.pathname.split('/').pop()

      if (!fileId) {
        statusCode = 400
        throw new Error('File ID is required')
      }

      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', keyData.user_id)
        .single()

      if (fileError || !fileData) {
        statusCode = 404
        throw new Error('File not found or access denied')
      }

      if (fileData.github_repo) {
        await supabase.functions.invoke('github-storage', {
          body: {
            action: 'delete',
            fileName: fileData.name,
            userId: keyData.user_id,
            repo: fileData.github_repo
          }
        })
      }

      const { error: deleteError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', keyData.user_id)

      if (deleteError) {
        statusCode = 500
        throw new Error(`Failed to delete file record: ${deleteError.message}`)
      }

      statusCode = 200

      return jsonResponse({
        success: true,
        message: 'File deleted successfully'
      })

    } catch (error) {
      console.error('API delete error:', error)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return jsonResponse({
        error: errorMessage,
        success: false
      }, statusCode)
    } finally {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const authHeader = req.headers.get('Authorization')
        if (authHeader && authHeader.startsWith('Bearer cb_') ) {
          const apiKey = authHeader.replace('Bearer ', '')

          const encoder = new TextEncoder()
          const data = encoder.encode(apiKey)
          const hashBuffer = await crypto.subtle.digest('SHA-256', data)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

          const { data: keyData } = await supabase
            .from('api_keys')
            .select('id, user_id')
            .eq('key_hash', keyHash)
            .single()

          if (keyData) {
            await supabase
              .from('api_request_logs')
              .insert({
                api_key_id: keyData.id,
                user_id: keyData.user_id,
                endpoint: '/api-file-delete',
                method: req.method,
                ip_address: req.headers.get('x-forwarded-for') || 'unknown',
                user_agent: req.headers.get('user-agent'),
                status_code: statusCode,
                response_time_ms: Date.now() - startTime,
                error_message: errorMessage
              })
          }
        }
      } catch (logError) {
        console.error('Failed to log request:', logError)
      }
    }
  })
})
