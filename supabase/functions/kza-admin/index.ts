import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, PrelContext } from '../_shared/kza-prel.ts'

interface AdminPayload {
  action?: string
  user_id?: string
  ip_address?: string
  tier?: string
  shadow?: boolean
  hours?: number
  reason?: string
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'kza-admin', operation: 'default' }, async (ctx: PrelContext) => {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'KZA admin misconfigured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // Admin gate: ctx.userId must be an admin from Profiles
    if (ctx.userId === 'anonymous' || ctx.userId === 'hmac') {
      return jsonResponse({ error: 'Admin authentication required', code: 'KZA_ADMIN_AUTH' }, 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', ctx.userId)
      .maybeSingle()

    if (!profile?.is_admin) {
      return jsonResponse({ error: 'Forbidden', code: 'KZA_ADMIN_FORBIDDEN' }, 403)
    }

    if (req.method === 'GET') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const [bans, incidents, threats] = await Promise.all([
        supabase.from('kza_banned_entities')
          .select('id, user_id, ip_address, ban_type, ban_tier, ban_reason, shadow, is_active, banned_until, created_at')
          .is('is_active', true)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('kza_admin_incidents')
          .select('id, threat_tier, incident_title, threat_event_id, status, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('kza_threat_events')
          .select('threat_tier, threat_type, country, created_at, automated_action_taken')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      return jsonResponse({
        ok: true,
        active_bans: bans.data ?? [],
        incidents_24h: incidents.data ?? [],
        threat_events_24h: threats.data ?? [],
      })
    }

    const payload = (await req.json().catch(() => ({}))) as AdminPayload
    const action = payload.action ?? ''
    const uid = typeof payload.user_id === 'string' ? payload.user_id : null
    const ip = typeof payload.ip_address === 'string' ? payload.ip_address : null

    if (!action || (!uid && !ip)) {
      return jsonResponse({ error: 'action + user_id|ip_address required', code: 'KZA_ADMIN_BAD_REQUEST' }, 400)
    }

    if (action === 'ban' || action === 'shadow') {
      const tier = payload.tier === 'BLACK' ? 'BLACK' : 'RED'
      const shadow = action === 'shadow' || Boolean(payload.shadow)
      const hours = Number(payload.hours ?? 24)
      const banned: Record<string, unknown> = {
        user_id: uid,
        ip_address: ip,
        ban_type: tier === 'BLACK' ? 'PERMANENT' : 'TEMP',
        ban_reason: payload.reason ?? `KZA admin ${shadow ? 'shadow' : 'ban'}`,
        ban_tier: tier,
        banned_until: tier === 'BLACK' ? null : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
        is_active: true,
        shadow,
        ban_source: 'KZA_SENTINEL',
      }
      await supabase.from('kza_banned_entities').insert(banned)

      if (uid) {
        await supabase.from('kza_prel_sessions')
          .update({ consumed_at: new Date().toISOString() })
          .eq('user_id', uid)
          .is('consumed_at', null)
        if (tier === 'BLACK') {
          await supabase.auth.admin.signOut(uid).catch(() => null)
        }
      }

      return jsonResponse({ ok: true, action, banned: true, tier, shadow })
    }

    if (action === 'unban') {
      const query = supabase.from('kza_banned_entities')
        .update({ is_active: false })
        .is('is_active', true)
      if (uid) query.eq('user_id', uid)
      if (ip) query.eq('ip_address', ip)
      await query
      return jsonResponse({ ok: true, unbanned: true })
    }

    if (action === 'export') {
      if (!uid) {
        return jsonResponse({ error: 'user_id required for export', code: 'KZA_ADMIN_BAD_REQUEST' }, 400)
      }
      const { data, error } = await supabase.rpc('kza_veil_export_profile', { p_user_id: uid })
      if (error) return jsonResponse({ ok: false, error: error.message }, 500)
      return jsonResponse({ ok: true, data })
    }

    if (action === 'revoke') {
      if (!uid) return jsonResponse({ error: 'user_id required for revoke', code: 'KZA_ADMIN_BAD_REQUEST' }, 400)
      await supabase.from('kza_prel_sessions')
        .update({ consumed_at: new Date().toISOString() })
        .eq('user_id', uid)
        .is('consumed_at', null)
      await supabase.from('kza_prel_f2fa_seeds')
        .update({ is_active: false })
        .eq('user_id', uid)
      await supabase.auth.admin.signOut(uid).catch(() => null)
      return jsonResponse({ ok: true, revoked: true })
    }

    return jsonResponse({ error: 'Unknown action', code: 'KZA_ADMIN_BAD_REQUEST' }, 400)
  })
})