import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

const hmacHex = async (key: string, message: string): Promise<string> => {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const ghostEndpoints = [
  '/admin-old',
  '/admin-backup',
  '/api/internal',
  '/api/v2/admin',
  '/_admin',
  '/debug',
  '/config.json',
  '/.env',
  '/management',
  '/wp-admin',
  '/phpmyadmin',
  '/api/users/export',
  '/v1/admin',
]

const honeypotFiles = [
  'credentials.txt',
  'admin-backup.pdf',
  'users-export.csv',
  'database-dump.sql',
  'config-backup.json',
  'secrets.env',
]

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'kza-phantom', operation: 'default' }, async (ctx: PrelContext) => {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const KZA_ENABLED = (Deno.env.get('KZA_ENABLED') ?? 'true').toLowerCase() === 'true'
    const KZA_PHANTOM_ENABLED = (Deno.env.get('KZA_PHANTOM_ENABLED') ?? 'true').toLowerCase() === 'true'

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'KZA phantom misconfigured' }, 500)
    }

    if (!KZA_ENABLED || !KZA_PHANTOM_ENABLED) {
      return jsonResponse({ ok: true, disabled: true })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const payload = await req.json().catch(() => ({} as Record<string, unknown>))
    const url = typeof payload.url === 'string' ? payload.url : req.url
    const method = typeof payload.method === 'string' ? payload.method.toUpperCase() : req.method
    const bodySnapshot = typeof payload.body_snapshot === 'string' ? payload.body_snapshot : ''

    const userId = ctx.userId

    const ipAddress =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

  const endpoint = (() => {
    try {
      return new URL(url).pathname || '/'
    } catch {
      return '/'
    }
  })()

  const requestDetails = {
    url,
    method,
    body_snapshot: bodySnapshot,
    headers: {
      user_agent: req.headers.get('user-agent') ?? '',
      referer: req.headers.get('referer') ?? '',
    },
  }

  const logHoneypotHit = async (trapName: string, trapType: string) => {
    await supabase.from('kza_honeypot_hits').insert({
      trap_name: trapName,
      trap_type: trapType,
      user_id: userId,
      ip_address: ipAddress,
      request_details: requestDetails,
    })

    const { data: asset } = await supabase
      .from('kza_phantom_assets')
      .select('hit_count')
      .eq('asset_name', trapName)
      .eq('asset_type', trapType)
      .maybeSingle()

    await supabase
      .from('kza_phantom_assets')
      .update({ hit_count: (asset?.hit_count ?? 0) + 1 })
      .eq('asset_name', trapName)
      .eq('asset_type', trapType)
  }

  const callSentinel = async (tier: 'RED' | 'BLACK', threatType: string, description: string) => {
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY
    const internalSecret = Deno.env.get('KZA_INTERNAL_SECRET') ?? serviceKey
    const ts = Date.now().toString()
    const sig = await hmacHex(internalSecret, ts)
    return await fetch(`${SUPABASE_URL}/functions/v1/kza-sentinel`, {
      method: 'POST',
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
        'Content-Type': 'application/json',
        'X-KZA-Internal': `${ts}:${sig}`,
        'X-KZA-Session': req.headers.get('X-KZA-Session') ?? '',
        'X-Forwarded-For': req.headers.get('X-Forwarded-For') ?? '',
        'User-Agent': req.headers.get('User-Agent') ?? '',
      },
      body: JSON.stringify({
        url,
        method,
        body_snapshot: bodySnapshot,
        forced_tier: tier,
        threat_type: threatType,
        description,
      }),
    })
  }

  if (ghostEndpoints.includes(endpoint)) {
    await logHoneypotHit(endpoint, 'GHOST_ENDPOINT')
    await supabase.from('kza_admin_incidents').insert({
      incident_title: `BLACK - Ghost endpoint ${endpoint} hit`,
      threat_tier: 'BLACK',
      attacker_profile: { user_id: userId, ip_address: ipAddress },
      attack_timeline: [{
        timestamp: new Date().toISOString(),
        action: 'GHOST_ENDPOINT',
        endpoint,
        result: 'TRIGGERED',
        details: requestDetails,
      }],
      what_was_targeted: endpoint,
      potential_harm: 'Ghost endpoint reconnaissance.',
      techniques_used: ['GHOST_ENDPOINT'],
      actions_taken: ['KZA_PHANTOM_TRIGGER'],
      network_intel: { ip: ipAddress, request_details: requestDetails },
    })
    const sentinelResponse = await callSentinel('BLACK', 'GHOST_ENDPOINT', `Ghost endpoint hit: ${endpoint}`)
    return sentinelResponse
  }

  const tokenHeader = req.headers.get('Authorization') || req.headers.get('x-api-key') || req.headers.get('apikey') || ''
  if (tokenHeader) {
    const { data: tokens } = await supabase
      .from('kza_phantom_assets')
      .select('asset_name')
      .eq('asset_type', 'CANARY_TOKEN')
      .eq('is_active', true)

    const tokenValues = tokens?.map((token) => token.asset_name) ?? []
    const matchedToken = tokenValues.find((token) => token && tokenHeader.includes(token))
    if (matchedToken) {
      await logHoneypotHit(matchedToken, 'CANARY_TOKEN')
      const sentinelResponse = await callSentinel('BLACK', 'CANARY_TOKEN', 'Canary token presented')
      return sentinelResponse
    }
  }

  const fileMatch = honeypotFiles.find((fileName) =>
    endpoint.toLowerCase().includes(fileName.toLowerCase()) || bodySnapshot.toLowerCase().includes(fileName.toLowerCase())
  )
  if (fileMatch) {
    await logHoneypotHit(fileMatch, 'HONEYPOT_FILE')
    const sentinelResponse = await callSentinel('RED', 'HONEYPOT_FILE', `Honeypot file accessed: ${fileMatch}`)
    return sentinelResponse
  }

  const bodyLower = bodySnapshot.toLowerCase()
  if (bodyLower.includes('squidcloud_admin_backup') && bodySnapshot.includes('Sq!dCl0ud@dmin2024')) {
    await logHoneypotHit('squidcloud_admin_backup', 'FAKE_CREDENTIALS')
    const sentinelResponse = await callSentinel('BLACK', 'FAKE_CREDENTIALS', 'Fake admin credentials used')
    return sentinelResponse
  }
  if (bodyLower.includes('admin@squidcloud.app') && bodySnapshot.includes('SquidAdmin!2024')) {
    await logHoneypotHit('admin@squidcloud.app', 'FAKE_CREDENTIALS')
    const sentinelResponse = await callSentinel('BLACK', 'FAKE_CREDENTIALS', 'Fake admin credentials used')
    return sentinelResponse
  }

  return jsonResponse({ ok: true })
  })
})
