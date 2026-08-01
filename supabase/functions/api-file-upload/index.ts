import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'
import { sendSignal } from '../_shared/signals.ts'

const validateEncryptionKeyFormat = (key: string): boolean => {
  return key.length >= 8 && key.length <= 512
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders() })
  }
  return withPrelGateway(req, { functionId: 'api-file-upload', operation: 'default' }, async (ctx: PrelContext) => {
    const startTime = Date.now()
    let statusCode = 500
    let fileName = null
    let fileSize = null
    let errorMessage = null
    let keyUserId: string | null = null

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

      keyUserId = keyData.user_id

      if (!keyData.scopes.includes('write')) {
        statusCode = 403
        throw new Error('API key does not have write permissions')
      }

      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', keyHash)

      const formData = await req.formData()
      const file = formData.get('file') as File
      const formEncryptionKey = (formData.get('encryption_key') || formData.get('encryptionKey')) as string | null
      const headerEncryptionKey = req.headers.get('x-squidcloud-encryption-key') || req.headers.get('x-encryption-key')
      const encryptionKey = (formEncryptionKey || headerEncryptionKey || '').trim() || null

      if (!file) {
        statusCode = 400
        throw new Error('No file provided')
      }

      if (encryptionKey && !validateEncryptionKeyFormat(encryptionKey)) {
        statusCode = 400
        throw new Error('Invalid encryption key format')
      }

      fileName = file.name
      fileSize = file.size

      const fileBuffer = await file.arrayBuffer()
      const fileContent = new Uint8Array(fileBuffer)

      const uploadResponse = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: file.name,
          fileContent: Array.from(fileContent),
          userId: keyData.user_id,
          encrypted: true,
          encryptionKey
        }
      })

      if (uploadResponse.error) {
        statusCode = 500
        throw new Error(`Upload failed: ${uploadResponse.error.message}`)
      }

      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: keyData.user_id,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          storage_path: 'github_distributed',
          encrypted: true,
          encryption_key: encryptionKey,
          github_repo: uploadResponse.data.repo
        })
        .select()
        .single()

      if (dbError) {
        statusCode = 500
        throw new Error(`Database error: ${dbError.message}`)
      }

      statusCode = 201

      return jsonResponse({
        success: true,
        file: fileRecord,
        message: 'File uploaded successfully',
        encryption: {
          mode: encryptionKey ? 'provided' : 'platform',
        },
      })

    } catch (error: unknown) {
      console.error('API upload error:', error)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (keyUserId && statusCode >= 400) {
        void sendSignal({
          service_id: 'cloudbliss',
          user_id: keyUserId,
          type: 'upload_failed',
          severity: 'warning',
          title: fileName ? `Upload failed: ${fileName}` : 'Upload failed',
          body: errorMessage.slice(0, 500),
          link: '/dashboard',
          idempotency_key: `upload_failed:${keyUserId}:${fileName ?? 'file'}:${new Date().toISOString().slice(0, 10)}`,
        });
      }

      return jsonResponse({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }, statusCode)
    } finally {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const authHeader = req.headers.get('Authorization')
        if (authHeader && authHeader.startsWith('Bearer cb_')) {
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
                endpoint: '/api-file-upload',
                method: req.method,
                ip_address: req.headers.get('x-forwarded-for') || 'unknown',
                user_agent: req.headers.get('user-agent'),
                status_code: statusCode,
                response_time_ms: Date.now() - startTime,
                file_name: fileName,
                file_size: fileSize,
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
