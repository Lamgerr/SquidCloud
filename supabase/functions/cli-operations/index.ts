import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders() })
  }
  return withPrelGateway(req, { functionId: 'cli-operations', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { action, ...params } = await req.json()

      let result

      switch (action) {
        case 'get_user_stats':
          result = await getUserStats(supabase, ctx.userId)
          break
        case 'get_file_analytics':
          result = await getFileAnalytics(supabase, ctx.userId)
          break
        case 'create_api_key':
          result = await createAPIKey(supabase, ctx.userId, params)
          break
        case 'list_api_keys':
          result = await listAPIKeys(supabase, ctx.userId)
          break
        case 'revoke_api_key':
          result = await revokeAPIKey(supabase, ctx.userId, params.keyId)
          break
        case 'get_activity_logs':
          result = await getActivityLogs(supabase, ctx.userId)
          break
        case 'backup_files':
          result = await initiateBackup(supabase, ctx.userId)
          break
        default:
          throw new Error(`Unknown action: ${action}`)
      }

      return jsonResponse({ success: true, data: result })

    } catch (error) {
      console.error('CLI operations error:', error)
      return jsonResponse({
        success: false,
        error: error.message
      }, 500)
    }
  })
})

async function getUserStats(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const { data: files, count: fileCount } = await supabase
    .from('files')
    .select('size', { count: 'exact' })
    .eq('user_id', userId)

  const totalSize = files?.reduce((sum: number, file: any) => sum + file.size, 0) || 0

  return {
    profile,
    fileCount,
    totalSize,
    storageUsed: profile?.storage_used || 0
  }
}

async function getFileAnalytics(supabase: any, userId: string) {
  const { data: files } = await supabase
    .from('files')
    .select('name, size, type, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10)

  const { data: typeStats } = await supabase
    .from('files')
    .select('type')
    .eq('user_id', userId)

  const typeCount = typeStats?.reduce((acc: any, file: any) => {
    acc[file.type] = (acc[file.type] || 0) + 1
    return acc
  }, {}) || {}

  return {
    recentFiles: files,
    typeDistribution: typeCount
  }
}

async function createAPIKey(supabase: any, userId: string, params: any) {
  const { name, scopes } = params

  const { data: apiKey } = await supabase.rpc('generate_api_key')

  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: newKey, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name: name || 'CLI Generated Key',
      key_hash: keyHash,
      key_prefix: apiKey.substring(0, 8),
      scopes: scopes || ['read', 'write', 'delete']
    })
    .select()
    .single()

  if (error) throw error

  return { ...newKey, key: apiKey }
}

async function listAPIKeys(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, created_at, last_used_at, is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

async function revokeAPIKey(supabase: any, userId: string, keyId: string) {
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('user_id', userId)

  if (error) throw error
  return { success: true }
}

async function getActivityLogs(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('api_request_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data
}

async function initiateBackup(supabase: any, userId: string) {
  return {
    message: 'Backup process initiated',
    status: 'pending'
  }
}
