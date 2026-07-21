import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function parseRepoUrl(url: string): { owner: string; repo: string; ref?: string } | null {
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '')
  let match
  match = clean.match(/github.com[:\/]([^\/]+)\/([^\/]+?)(?:\/tree\/(.+))?$/)
  if (match) return { owner: match[1], repo: match[2], ref: match[3] || undefined }
  match = clean.match(/^https?:\/\/github.com\/([^\/]+)\/([^\/]+?)(?:\/tree\/(.+))?$/)
  if (match) return { owner: match[1], repo: match[2], ref: match[3] || undefined }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Missing or invalid Authorization header', 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return jsonError('Authentication failed', 401)

    const { repoUrl } = await req.json()
    if (!repoUrl) return jsonError('repoUrl is required', 400)

    const parsed = parseRepoUrl(repoUrl)
    if (!parsed) return jsonError('Invalid GitHub URL', 400)

    const fallbackToken = Deno.env.get('GITHUB_TOKEN')
    let githubToken: string | undefined

    if (fallbackToken) {
      githubToken = fallbackToken
    } else {
      const { data: conn } = await supabase
        .from('github_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .maybeSingle()
      if (conn) githubToken = (conn as any).access_token
    }

    const refPath = parsed.ref || 'HEAD'
    const ghUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball/${refPath}`
    const ghHeaders: Record<string, string> = {
      'User-Agent': 'Squidcloud-Clone/1.0',
      'Accept': 'application/vnd.github.v3+json',
    }
    if (githubToken) ghHeaders['Authorization'] = `Bearer ${githubToken}`

    const ghRes = await fetch(ghUrl, { headers: ghHeaders })

    if (ghRes.status === 404) return jsonError(`Repository ${parsed.owner}/${parsed.repo} not found`, 404)
    if (ghRes.status === 403) {
      return jsonError(
        `Access denied. For private repos, connect your GitHub account first.`,
        403,
      )
    }
    if (!ghRes.ok) return jsonError(`GitHub API error: ${ghRes.status}`, ghRes.status)

    const zipData = await ghRes.arrayBuffer()

    return new Response(zipData, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/zip',
        'Content-Length': zipData.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('clone-repo error:', error)
    return jsonError(error instanceof Error ? error.message : 'Internal server error', 500)
  }
})
