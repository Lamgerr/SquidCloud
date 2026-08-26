// cli-oauth — OAuth server for SquidCloud CLI

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import postgres from 'npm:postgres@3.4.5'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateDeviceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

async function getUserEmail(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user) return 'unknown'
    return data.user.email || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function verifyUser(supabase: any, req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  return { userId: user.id, email: user.email || '' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const path = url.pathname.replace('/cli-oauth', '').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  const method = req.method

  try {
    if (path === '/authorize' && method === 'GET') {
      return handleAuthorizeGet(req, url)
    }

    if (path === '/authorize' && method === 'POST') {
      return handleAuthorizePost(req, supabase)
    }

    if (path === '/token' && method === 'POST') {
      return handleTokenPost(req, supabase)
    }

    if (path === '/device' && method === 'POST') {
      return handleDevicePost(req, supabase)
    }

    if (path === '/device/authorize' && method === 'POST') {
      return handleDeviceAuthorizePost(req, supabase)
    }

    if (path === '/device/poll' && method === 'POST') {
      return handleDevicePollPost(req, supabase)
    }

    if (path === '/revoke' && method === 'POST') {
      return handleRevokePost(req, supabase)
    }

    if (path === '/device/ban' && method === 'POST') {
      return handleDeviceBanPost(req, supabase)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  } catch (error: any) {
    console.error('cli-oauth error:', error)
    return jsonResponse({ error: error.message || 'Internal server error' }, 500)
  }
})

function handleAuthorizeGet(req: Request, url: URL): Response {
  const clientId = url.searchParams.get('client_id') || 'squidcloud-cli'
  const redirectUri = url.searchParams.get('redirect_uri') || ''
  const state = url.searchParams.get('state') || ''
  const scope = url.searchParams.get('scope') || 'read write'
  const deviceCode = url.searchParams.get('device_code') || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SquidCloud CLI — Authorize</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 40px;
      max-width: 440px;
      width: 100%;
    }
    .logo { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    .subtitle { font-size: 14px; color: #71717a; margin-bottom: 28px; }
    .app-info {
      background: #111113;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .app-info .label { font-size: 12px; color: #71717a; margin-bottom: 4px; }
    .app-info .value { font-size: 14px; color: #e4e4e7; font-weight: 500; }
    .scopes { margin-bottom: 28px; }
    .scopes h3 { font-size: 13px; color: #a1a1aa; margin-bottom: 8px; font-weight: 500; }
    .scope-tag {
      display: inline-block;
      background: #27272a;
      color: #d4d4d8;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 9999px;
      margin: 0 4px 4px 0;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-approve { background: #6d28d9; color: #fff; margin-bottom: 10px; }
    .btn-approve:hover { background: #7c3aed; }
    .btn-deny { background: transparent; color: #71717a; border: 1px solid #27272a; }
    .btn-deny:hover { background: #1a1a1e; color: #a1a1aa; }
    .form-row { margin-bottom: 16px; }
    .form-row label { display: block; font-size: 13px; color: #a1a1aa; margin-bottom: 6px; }
    .form-row input {
      width: 100%;
      padding: 10px 12px;
      background: #111113;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    .form-row input:focus { border-color: #6d28d9; }
    .error-msg { color: #ef4444; font-size: 13px; margin-bottom: 12px; display: none; }
    .device-code-box {
      background: #111113;
      border: 1px solid #6d28d9;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .device-code-box .code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 32px;
      font-weight: 700;
      color: #a78bfa;
      letter-spacing: 4px;
      margin-bottom: 8px;
    }
    .device-code-box .hint { font-size: 13px; color: #71717a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SquidCloud CLI</div>
    <p class="subtitle">An application is requesting access to your account.</p>

    ${deviceCode ? `
      <div class="device-code-box">
        <div class="code">${deviceCode}</div>
        <div class="hint">Enter this code in your terminal</div>
      </div>
    ` : ''}

    <div class="app-info">
      <div class="label">Application</div>
      <div class="value">${clientId}</div>
    </div>

    <div class="scopes">
      <h3>Requested permissions</h3>
      ${scope.split(' ').map(s => `<span class="scope-tag">${s}</span>`).join('')}
    </div>

    <div id="error" class="error-msg"></div>

    <form id="authForm">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="scope" value="${scope}">
      <input type="hidden" name="device_code" value="${deviceCode}">
      <button type="submit" class="btn btn-approve">Approve</button>
      <button type="button" class="btn btn-deny" onclick="window.history.back()">Deny</button>
    </form>

    <script>
      document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errorEl = document.getElementById('error');
        errorEl.style.display = 'none';

        const body = new URLSearchParams(new FormData(form));

        try {
          const res = await fetch('/cli-oauth/authorize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Bearer ' + (await supabaseAuth()),
            },
            body: body.toString(),
          });

          const data = await res.json();
          if (!res.ok) {
            errorEl.textContent = data.error || 'Authorization failed';
            errorEl.style.display = 'block';
            return;
          }

          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else if (data.device_code) {
            document.querySelector('.card').innerHTML =
              '<div class="logo">Authorized</div>' +
              '<p class="subtitle">You can return to your terminal.</p>';
          }
        } catch (err) {
          errorEl.textContent = 'Network error. Please try again.';
          errorEl.style.display = 'block';
        }
      });

      async function supabaseAuth() {
        const session = await fetch('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': '${Deno.env.get('SUPABASE_ANON_KEY') || ''}' },
          body: JSON.stringify({}),
        }).then(r => r.json()).catch(() => null);
        return session?.access_token || '';
      }
    </script>
  </div>
</body>
</html>`

  return htmlResponse(html)
}

async function handleAuthorizePost(req: Request, supabase: any): Promise<Response> {
  const user = await verifyUser(supabase, req)
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const contentType = req.headers.get('Content-Type') || ''
  let params: Record<string, string>

  if (contentType.includes('application/json')) {
    params = await req.json()
  } else {
    const text = await req.text()
    params = Object.fromEntries(new URLSearchParams(text))
  }

  const clientId = params.client_id || 'squidcloud-cli'
  const redirectUri = params.redirect_uri || ''
  const state = params.state || ''
  const scope = params.scope || 'read write'
  const deviceCode = params.device_code || ''

  const code = generateToken()
  const codeHash = await hashToken(code)

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insertError } = await supabase.from('cli_authorizations').insert({
    code_hash: codeHash,
    user_id: user.userId,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    device_code: deviceCode || null,
    status: deviceCode ? 'pending' : 'approved',
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('Failed to insert authorization:', insertError)
    return jsonResponse({ error: 'Failed to create authorization' }, 500)
  }

  if (deviceCode) {
    const { error: updateError } = await supabase
      .from('cli_devices')
      .update({ status: 'authorized', user_id: user.userId, authorized_at: new Date().toISOString() })
      .eq('device_code', deviceCode)

    if (updateError) {
      console.error('Failed to update device:', updateError)
    }
  }

  if (redirectUri) {
    const redirectUrl = new URL(redirectUri)
    redirectUrl.searchParams.set('code', code)
    if (state) redirectUrl.searchParams.set('state', state)
    return jsonResponse({ redirect_url: redirectUrl.toString(), code })
  }

  return jsonResponse({ code, device_code: deviceCode || undefined })
}

async function handleTokenPost(req: Request, supabase: any): Promise<Response> {
  const body = await req.json()
  const grantType = body.grant_type || (body.code ? 'authorization_code' : '')
  const clientId = body.client_id || 'squidcloud-cli'

  if (grantType === 'authorization_code') {
    const code = body.code || ''
    const codeHash = await hashToken(code)

    const { data: auth, error: lookupError } = await supabase
      .from('cli_authorizations')
      .select('*')
      .eq('code_hash', codeHash)
      .eq('status', 'approved')
      .maybeSingle()

    if (lookupError || !auth) {
      return jsonResponse({ error: 'Invalid or expired authorization code' }, 400)
    }

    if (new Date(auth.expires_at) < new Date()) {
      return jsonResponse({ error: 'Authorization code has expired' }, 400)
    }

    if (auth.used) {
      return jsonResponse({ error: 'Authorization code has already been used' }, 400)
    }

    const machineId = body.machine_id || ''
    if (machineId) {
      const { data: banned } = await supabase
        .from('cli_devices')
        .select('id')
        .eq('machine_id', machineId)
        .eq('is_banned', true)
        .maybeSingle()

      if (banned) {
        return jsonResponse({ error: 'This machine has been banned' }, 403)
      }
    }

    const accessToken = generateToken()
    const tokenHash = await hashToken(accessToken)

    const { error: updateError } = await supabase
      .from('cli_authorizations')
      .update({ token_hash: tokenHash, used: true })
      .eq('code_hash', codeHash)

    if (updateError) {
      console.error('Failed to update authorization:', updateError)
      return jsonResponse({ error: 'Failed to issue token' }, 500)
    }

    let deviceId = ''
    if (machineId) {
      const { data: deviceRow, error: deviceError } = await supabase
        .from('cli_devices')
        .insert({
          user_id: auth.user_id,
          machine_id: machineId,
          client_id: clientId,
          token_hash: tokenHash,
          scope: auth.scope,
          status: 'active',
        })
        .select('id')
        .single()

      if (!deviceError && deviceRow) {
        deviceId = deviceRow.id
      }
    }

    const userEmail = await getUserEmail(supabase, auth.user_id)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    return jsonResponse({
      success: true,
      token: accessToken,
      access_token: accessToken,
      token_prefix: accessToken.slice(0, 8),
      token_type: 'Bearer',
      user_email: userEmail,
      user_id: auth.user_id,
      device_id: deviceId,
      expires_in: 3600 * 24 * 30,
      scope: auth.scope,
      anon_key: anonKey,
    })
  }

  if (grantType === 'refresh_token') {
    return jsonResponse({ error: 'Refresh tokens not supported. Re-authorize.' }, 400)
  }

  return jsonResponse({ error: 'Unsupported grant_type' }, 400)
}

async function handleDevicePost(req: Request, supabase: any): Promise<Response> {
  const user = await verifyUser(supabase, req)

  const body = await req.json().catch(() => ({}))
  const clientId = body.client_id || 'squidcloud-cli'
  const machineId = body.machine_id || ''
  const deviceName = body.device_name || ''
  const platform = body.platform || ''
  const deviceCode = generateDeviceCode()

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error } = await supabase.from('cli_devices').insert({
    user_id: user?.userId || null,
    machine_id: machineId,
    device_code: deviceCode,
    client_id: clientId,
    device_name: deviceName,
    platform,
    status: 'pending',
    expires_at: expiresAt,
  })

  if (error) {
    console.error('Failed to create device:', error)
    return jsonResponse({ error: 'Failed to create device code' }, 500)
  }

  return jsonResponse({
    device_code: deviceCode,
    user_code: deviceCode,
    verification_uri: 'https://squidcloud.vercel.app/cli/device?action=device',
    expires_in: 900,
    interval: 5,
  })
}

async function handleDeviceAuthorizePost(req: Request, supabase: any): Promise<Response> {
  const user = await verifyUser(supabase, req)

  const body = await req.json().catch(() => ({}))
  const deviceCode = body.device_code || ''

  if (!deviceCode) {
    return jsonResponse({ error: 'device_code is required' }, 400)
  }

  const { data: device, error: lookupError } = await supabase
    .from('cli_devices')
    .select('*')
    .eq('device_code', deviceCode)
    .maybeSingle()

  if (lookupError || !device) {
    return jsonResponse({ error: 'Invalid device code' }, 400)
  }

  if (device.is_banned) {
    return jsonResponse({ error: 'This device has been banned' }, 403)
  }

  if (device.expires_at && new Date(device.expires_at) < new Date()) {
    return jsonResponse({ error: 'Device code has expired' }, 400)
  }

  if (device.status !== 'pending') {
    return jsonResponse({ error: 'Device code is not pending' }, 400)
  }

  const { error: updateError } = await supabase
    .from('cli_devices')
    .update({
      status: 'authorized',
      user_id: user?.userId || device.user_id,
      authorized_at: new Date().toISOString(),
    })
    .eq('device_code', deviceCode)

  if (updateError) {
    console.error('Failed to authorize device:', updateError)
    return jsonResponse({ error: 'Failed to authorize device' }, 500)
  }

  return jsonResponse({ success: true, device_code: deviceCode, user_id: user?.userId || device.user_id })
}

async function handleDevicePollPost(req: Request, supabase: any): Promise<Response> {
  const body = await req.json()
  const deviceCode = body.device_code || ''

  if (!deviceCode) {
    return jsonResponse({ error: 'device_code is required' }, 400)
  }

  const { data: device, error: lookupError } = await supabase
    .from('cli_devices')
    .select('*')
    .eq('device_code', deviceCode)
    .maybeSingle()

  if (lookupError || !device) {
    return jsonResponse({ error: 'Invalid device code' }, 400)
  }

  if (device.is_banned) {
    return jsonResponse({ error: 'This device has been banned' }, 403)
  }

  if (device.expires_at && new Date(device.expires_at) < new Date()) {
    return jsonResponse({ error: 'Device code has expired' }, 400)
  }

  if (device.status === 'pending') {
    return jsonResponse({ status: 'pending', authorized: false })
  }

  if (device.status === 'authorized') {
    // TOTP is mandatory for CLI/devtools access: never hand out a device
    // token to an account without a verified TOTP factor.
    if (device.user_id) {
      let hasVerifiedTotp = false
      try {
        const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL')
        if (!dbUrl) throw new Error('SUPABASE_DB_URL not configured')
        const sql = postgres(dbUrl, { prepare: false, max: 1 })
        try {
          const rows = await sql`
            SELECT 1 FROM auth.mfa_factors
            WHERE user_id = ${device.user_id} AND status = 'verified' AND factor_type = 'totp'
            LIMIT 1`
          hasVerifiedTotp = rows.length > 0
        } finally {
          await sql.end({ timeout: 5 })
        }
      } catch (e) {
        console.error('[cli-oauth] totp gate:', e instanceof Error ? e.message : e)
        return jsonResponse({
          error: 'Server configuration error while enforcing the TOTP requirement',
          code: 'TOTP_GATE_ERROR',
        }, 500)
      }
      if (!hasVerifiedTotp) {
        return jsonResponse({
          error: 'TOTP two-factor authentication is mandatory for CLI access. Enroll at https://squidcloud.vercel.app/account/settings',
          code: 'TOTP_REQUIRED',
          enrollment_url: 'https://squidcloud.vercel.app/account/settings',
        }, 403)
      }
    }

    const accessToken = generateToken()
    const tokenHash = await hashToken(accessToken)

    await supabase
      .from('cli_devices')
      .update({ status: 'active', token_hash: tokenHash, authorized_at: new Date().toISOString() })
      .eq('device_code', deviceCode)

    const userEmail = device.user_id ? await getUserEmail(supabase, device.user_id) : 'unknown'
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    return jsonResponse({
      status: 'authorized',
      authorized: true,
      token: accessToken,
      access_token: accessToken,
      token_prefix: accessToken.slice(0, 8),
      token_type: 'Bearer',
      user_email: userEmail,
      user_id: device.user_id || '',
      device_id: device.id,
      expires_in: 3600 * 24 * 30,
      scope: device.scope || 'read write',
      anon_key: anonKey,
    })
  }

  if (device.status === 'expired') {
    return jsonResponse({ status: 'expired', expired: true })
  }

  return jsonResponse({ status: device.status, authorized: false })
}

async function handleRevokePost(req: Request, supabase: any): Promise<Response> {
  const user = await verifyUser(supabase, req)
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const body = await req.json()
  const tokenHash = body.token ? await hashToken(body.token) : body.token_hash || ''

  if (!tokenHash) {
    return jsonResponse({ error: 'token or token_hash is required' }, 400)
  }

  const { error: authError } = await supabase
    .from('cli_authorizations')
    .update({ status: 'revoked' })
    .eq('token_hash', tokenHash)
    .eq('user_id', user.userId)

  const { error: deviceError } = await supabase
    .from('cli_devices')
    .update({ status: 'revoked' })
    .eq('token_hash', tokenHash)
    .eq('user_id', user.userId)

  if (authError && deviceError) {
    return jsonResponse({ error: 'Token not found' }, 404)
  }

  return jsonResponse({ success: true })
}

async function handleDeviceBanPost(req: Request, supabase: any): Promise<Response> {
  const user = await verifyUser(supabase, req)
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const body = await req.json()
  const machineId = body.machine_id || ''

  if (!machineId) {
    return jsonResponse({ error: 'machine_id is required' }, 400)
  }

  const { error } = await supabase
    .from('cli_devices')
    .update({ is_banned: true, status: 'banned', banned_at: new Date().toISOString() })
    .eq('machine_id', machineId)

  if (error) {
    console.error('Failed to ban device:', error)
    return jsonResponse({ error: 'Failed to ban device' }, 500)
  }

  await supabase
    .from('cli_devices')
    .update({ status: 'banned' })
    .eq('machine_id', machineId)
    .eq('is_banned', false)

  return jsonResponse({ success: true, machine_id: machineId, banned: true })
}
