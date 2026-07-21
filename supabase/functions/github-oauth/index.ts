import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { action } = body

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    let user = null
    if (authHeader) {
      const { data, error } = await supabase.auth.getUser(authHeader)
      if (!error && data?.user) user = data.user
    }

    if (action === 'auth-url') {
      const clientId = Deno.env.get('GITHUB_CLIENT_ID')
      if (!clientId) return jsonResponse({ error: 'GitHub OAuth not configured on server' }, 500)

      const state = crypto.randomUUID()
      const redirectUri = body.redirectUri || 'https://squidcloud.vercel.app/github/oauth/callback'
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`

      return jsonResponse({ authUrl, state })
    }

    if (action === 'exchange') {
      const { code } = body
      if (!code) return jsonResponse({ error: 'Authorization code is required' }, 400)

      const clientId = Deno.env.get('GITHUB_CLIENT_ID')
      const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')
      if (!clientId || !clientSecret) {
        return jsonResponse({ error: 'GitHub OAuth not configured on server' }, 500)
      }

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      })

      if (!tokenResponse.ok) {
        return jsonResponse({ error: 'Failed to exchange authorization code' }, 500)
      }

      const tokenData = await tokenResponse.json()
      if (tokenData.error) {
        return jsonResponse({ error: tokenData.error_description || tokenData.error }, 400)
      }

      const accessToken = tokenData.access_token
      const scope = tokenData.scope || ''

      const ghUserResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'Squidcloud-OAuth', 'Accept': 'application/vnd.github.v3+json' },
      })
      if (!ghUserResponse.ok) return jsonResponse({ error: 'Failed to fetch GitHub user info' }, 500)
      const ghUser = await ghUserResponse.json()

      return jsonResponse({
        success: true,
        access_token: accessToken,
        github_username: ghUser.login,
        github_user_id: String(ghUser.id),
        scope,
      })
    }

    if (!user) return jsonResponse({ error: 'Authentication required' }, 401)

    if (action === 'store-token') {
      const { accessToken, ghUserId, ghUsername, scope } = body
      if (!accessToken || !ghUserId) return jsonResponse({ error: 'accessToken and ghUserId required' }, 400)

      const { data: existing } = await supabase
        .from('github_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('github_user_id', String(ghUserId))
        .maybeSingle()

      if (existing) {
        await supabase.from('github_connections').update({
          access_token: accessToken, scope, github_username: ghUsername, updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('github_connections').insert({
          user_id: user.id, github_user_id: String(ghUserId), github_username: ghUsername, access_token: accessToken, scope,
        })
      }

      return jsonResponse({ success: true, github_username: ghUsername })
    }

    if (action === 'connections') {
      const { data: connections, error } = await supabase
        .from('github_connections')
        .select('id, github_user_id, github_username, scope, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ connections: connections || [] })
    }

    if (action === 'disconnect') {
      const { connectionId } = body
      const { error } = await supabase.from('github_connections').delete().eq('id', connectionId).eq('user_id', user.id)
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true })
    }

    if (action === 'repos') {
      const { data: conn } = await supabase
        .from('github_connections')
        .select('access_token, github_username')
        .eq('user_id', user.id)
        .single()
      if (!conn) return jsonResponse({ error: 'No GitHub connection found' }, 404)

      const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&type=all', {
        headers: { 'Authorization': `Bearer ${conn.access_token}`, 'User-Agent': 'Squidcloud', 'Accept': 'application/vnd.github.v3+json' },
      })
      if (!reposResponse.ok) return jsonResponse({ error: 'Failed to fetch repositories' }, 500)

      const repos = await reposResponse.json()
      const filtered = (repos as any[]).map((r: any) => ({
        id: r.id, name: r.name, full_name: r.full_name, private: r.private,
        description: r.description, html_url: r.html_url, clone_url: r.clone_url,
        default_branch: r.default_branch, updated_at: r.updated_at, owner: r.owner?.login,
      }))

      return jsonResponse({ repos: filtered, username: conn.github_username })
    }

    return jsonResponse({ error: 'Unknown action' }, 404)
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
