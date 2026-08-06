import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, PrelContext } from '../_shared/kza-prel.ts'

interface HealthCheck {
  check: string
  status: string
  detail: string
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'kza-heartbeat', operation: 'default' }, async (ctx: PrelContext) => {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'KZA heartbeat misconfigured' }, 500)
    }

    const url = new URL(req.url)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // SQL heartbeat: cleanup + registry/keyring/session checks (also on pg_cron)
    if (url.searchParams.get('run') === 'sql') {
      const { data, error } = await supabase.rpc('kza_heartbeat_check')
      if (error) {
        return jsonResponse({ ok: false, error: error.message }, 500)
      }
      return jsonResponse({ ok: true, report: data })
    }

    const checks: HealthCheck[] = []
    const add = (check: string, status: string, detail: string) => checks.push({ check, status, detail })

    // 1. Gateway reachability + token lifecycle smoke test
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kza-prel/gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ function_id: 'get-app-updates', operation: 'default' }),
      })
      const body = await res.json().catch(() => ({}))
      const ok = res.status === 200 && Boolean(body.prel_token)
      add('gateway', ok ? 'PASS' : 'FAIL', ok ? 'token issued' : `HTTP ${res.status} ${body.code ?? ''}`.trim())
    } catch (e) {
      add('gateway', 'FAIL', String(e))
    }

    // 2. Sentinel reachability
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kza-sentinel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ url: '/kza-heartbeat', method: 'GET', body_snapshot: '' }),
      })
      add('sentinel', res.status === 200 ? 'PASS' : 'FAIL', 'HTTP ' + res.status)
    } catch (e) {
      add('sentinel', 'FAIL', String(e))
    }

    // 3. Keyring integrity (all required keys present)
    try {
      const { data: keys } = await supabase.from('security_keyring').select('name')
      const required = ['kza_prel_hmac_v2', 'kza_veil_master', 'kza_prel_f2fa_master']
      const have = new Set((keys ?? []).map((k: { name: string }) => k.name))
      const missing = required.filter((k) => !have.has(k))
      add('keyring', missing.length === 0 ? 'PASS' : 'FAIL', missing.length === 0 ? 'all keys present' : 'missing: ' + missing.join(','))
    } catch (e) {
      add('keyring', 'FAIL', String(e))
    }

    // 4. Session pressure
    try {
      const { count } = await supabase
        .from('kza_prel_sessions')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())
        .is('consumed_at', null)
      add('session_pressure', (count ?? 0) > 1000 ? 'WARN' : 'PASS', `${count ?? 0} unconsumed expired`)
    } catch (e) {
      add('session_pressure', 'FAIL', String(e))
    }

    await supabase.from('kza_health_checks').insert(
      checks.map((c) => ({ check_name: c.check, status: c.status, details: { detail: c.detail } }))
    ).catch(() => null)

    const failed = checks.filter((c) => c.status === 'FAIL')
    return jsonResponse({ ok: failed.length === 0, checks }, failed.length === 0 ? 200 : 503)
  })
})