import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

interface AuthUser {
  id: string;
  email?: string;
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'serve-pdf', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders() })
    }

    try {
      const url = new URL(req.url)
      const fileId = url.searchParams.get('fileId')

      if (!fileId) {
        return jsonResponse({ error: 'File ID is required' }, 400)
      }

      // Get authorization header
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return jsonResponse({ error: 'Authorization header is required' }, 401)
      }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Verify user authentication
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      // Get file metadata from database
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single()

      if (fileError || !fileData) {
        return jsonResponse({ error: 'File not found' }, 404)
      }

      // Check if file is a PDF
      if (!fileData.content_type || !fileData.content_type.includes('pdf')) {
        return jsonResponse({ error: 'File is not a PDF' }, 400)
      }

      // Download file from storage
      const { data: fileContent, error: downloadError } = await supabase.storage
        .from('files')
        .download(fileData.storage_path)

      if (downloadError || !fileContent) {
        return jsonResponse({ error: 'Failed to download file' }, 500)
      }

      // Decrypt file if it has RES54 encryption
      let finalContent = fileContent

      if (fileData.encryption_algorithm === 'RES54') {
        try {
          // Convert blob to array buffer
          const encryptedData = await fileContent.arrayBuffer()

          // Import RES54 decryption logic
          const { decrypt } = await import('./res54.ts')

          // Decrypt the content
          const decryptedData = await decrypt(
            new Uint8Array(encryptedData),
            fileData.encryption_key
          )

          // Convert back to blob
          finalContent = new Blob([decryptedData], { type: 'application/pdf' })
        } catch (decryptError) {
          console.error('Decryption failed:', decryptError)
          return jsonResponse({ error: 'Failed to decrypt file' }, 500)
        }
      }

      // Return the PDF content with proper headers
      const arrayBuffer = await finalContent.arrayBuffer()

      return new Response(arrayBuffer, {
        headers: {
          ...getCorsHeaders(),
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fileData.name}"`,
          'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
          'Content-Length': arrayBuffer.byteLength.toString(),
        }
      })

    } catch (error) {
      console.error('Error serving PDF:', error)
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
  })
})
