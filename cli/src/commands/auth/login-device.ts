import os from 'node:os'
import chalk from 'chalk'
import { setAuthState, writeCredentials } from '../../lib/auth/oauth-session.js'
import { machineId, enforceTotpAtLogin } from '../../lib/auth/totp.js'
import { migrateLegacyFile } from '../../lib/secrets/store.js'
import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { renderBanner } from '../../lib/output/banner.js'
import { success, error as errMark, muted } from '../../lib/output/brand.js'

const CLIENT_ID = 'squidcloud-cli'

export default async function loginDevice(): Promise<void> {
  console.log(renderBanner({ tagline: false }))
  const machine = machineId()
  await migrateLegacyFile()
  const deviceResp = await fetch(`${SUPABASE_URL}/functions/v1/cli-oauth/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      machine_id: machine,
      device_name: os.hostname() || 'desktop',
      platform: `${process.platform}-${process.arch}`,
    }),
  })
  const deviceData = (await deviceResp.json()) as Record<string, unknown>
  if (!deviceData.device_code) throw new Error(String(deviceData.error || deviceData.message || 'Device registration failed'))

  const userCode = String(deviceData.user_code || '')
  const verifyUrl = String(deviceData.verification_url || deviceData.verify_url || `https://squidcloud.vercel.app/cli/device?code=${userCode}`)
  const interval = Number(deviceData.interval || 5)
  const expiresAt = Date.now() + Number(deviceData.expires_in || 900) * 1000

  console.log(`  ${chalk.bold('Device authorization')}\n`)
  console.log(`  1. Open:  ${chalk.cyan(verifyUrl)}`)
  console.log(`  2. Code:  ${chalk.bold(userCode)}\n`)
  try { const { openBrowser } = await import('../../lib/utils/open.js'); openBrowser(verifyUrl) } catch {}

  while (Date.now() < expiresAt) {
    await new Promise((r) => setTimeout(r, interval * 1000))
    const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/cli-oauth/device/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code: deviceData.device_code }),
    })
    const pollData = (await pollResp.json()) as Record<string, unknown>
    if (pollData.authorization_pending) continue
    if (pollData.error === 'slow_down' || pollData.slow_down) { await new Promise((r) => setTimeout(r, 3000)); continue }
    if (!pollData.token && !pollData.access_token) {
      throw new Error(String(pollData.error || pollData.message || 'Authorization failed'))
    }
    const token = String(pollData.token || pollData.access_token)
    if ((pollData as any).code === 'TOTP_REQUIRED') {
      console.log(`\n  ${errMark('TOTP is mandatory for CLI access.')}`)
      console.log(`  ${muted('Enroll at https://squidcloud.vercel.app/account/settings → Security Center, then retry.')}\n`)
      process.exit(1)
    }
    const expiresInMs = typeof pollData.expires_in === 'number' ? pollData.expires_in * 1000 : 7776000000
    writeCredentials({
      version: 2, token,
      token_prefix: String(pollData.token_prefix || token.slice(0, 8)),
      email: String(pollData.user_email || 'unknown'),
      expires_at: Math.floor((Date.now() + expiresInMs) / 1000),
      device_id: String(pollData.device_id || ''),
      anon_key: String(pollData.anon_key || ''),
    })
    setAuthState(token, String(pollData.user_email || 'unknown'), Date.now() + expiresInMs, (pollData.anon_key as string) || null)

    // TOTP gate: enrollment mandatory + one fresh verification per login.
    await enforceTotpAtLogin()

    console.log(`\n  ${success(`Authorized as ${pollData.user_email || 'user'}`)}`)
    console.log(`  ${muted('credentials saved — every command now just works')}\n`)
    // Explicit clean exit: lingering keep-alive sockets from polling would
    // otherwise hold the process open until the user hits Ctrl+C.
    process.exit(0)
  }
  console.log(`\n  ${errMark('Device code expired. Try again.')}\n`)
  process.exit(1)
}
