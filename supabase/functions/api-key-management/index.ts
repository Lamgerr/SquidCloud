import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders() })
  }
  return withPrelGateway(req, { functionId: 'api-key-management', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { action, name, scopes } = await req.json()

      if (action === 'generate') {
        const { data: existingKeys, error: countError } = await supabase
          .from('api_keys')
          .select('id')
          .eq('user_id', ctx.userId)
          .eq('is_active', true)

        if (countError) throw countError

        if (existingKeys && existingKeys.length >= 10) {
          return jsonResponse({ error: 'Maximum of 10 API keys allowed' }, 400)
        }

        let apiKey: string

        try {
          const { data: keyResult, error: keyError } = await supabase.rpc('generate_api_key')
          if (keyError) throw keyError
          apiKey = keyResult as string
        } catch (error) {
          console.log('PostgreSQL function failed, using client-side generation:', error)
          const randomBytes = new Uint8Array(32)
          crypto.getRandomValues(randomBytes)
          const hexString = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          apiKey = `cb_${hexString}`
        }

        const keyPrefix = apiKey.substring(0, 8)

        const salt = new Uint8Array(32)
        crypto.getRandomValues(salt)
        const saltBase64 = btoa(String.fromCharCode.apply(null, Array.from(salt)))

        const encoder = new TextEncoder()
        const apiKeyBytes = encoder.encode(apiKey)

        const combined = new Uint8Array(salt.length + apiKeyBytes.length)
        combined.set(salt)
        combined.set(apiKeyBytes, salt.length)

        const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        const { data: keyData, error: insertError } = await supabase
          .from('api_keys')
          .insert({
            user_id: ctx.userId,
            name,
            key_hash: keyHash,
            key_salt: saltBase64,
            key_prefix: keyPrefix,
            scopes: scopes || ['read', 'write', 'delete']
          })
          .select()
          .single()

        if (insertError) throw insertError

        console.log(`Generated API key for user ${ctx.userId}: ${keyPrefix}...`)

        return jsonResponse({
          apiKey,
          keyData: keyData
        })
      }

      return jsonResponse({ error: 'Invalid action' }, 400)

    } catch (error) {
      console.error('Error:', error)
      return jsonResponse({ error: error.message }, 500)
    }
  })
})
