 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import chalk from 'chalk'
import { setAuthState, writeCredentials, writeSbTokenFromUrl } from '../../lib/auth/oauth-session.js'
import { machineId, enforceTotpAtLogin } from '../../lib/auth/totp.js'
import { migrateLegacyFile } from '../../lib/secrets/store.js'
import { openBrowser } from '../../lib/utils/open.js'
import { renderBanner } from '../../lib/output/banner.js'
import { success, muted, error as errMark } from '../../lib/output/brand.js'

const SUPABASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co'
const CLIENT_ID = 'squidcloud-cli'

export default async function loginOAuth() {
  console.log(renderBanner({ tagline: false }))
  await migrateLegacyFile()

  const server = createServer()
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', () => resolveListen()))
  const address = server.address() 
  const state = randomUUID().replace(/-/g, '').slice(0, 16)
  const redirectUri = `http://localhost:${address.port}/cli/callback`

  const authorizeUrl = `https://squidcloud.vercel.app/cli/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  console.log(`  ${chalk.bold('Authorize SquidCloud CLI')}`)
  console.log(`  ${muted('A browser window should have opened — approve access to continue.')}\n`)
  console.log(`  ${muted('Or paste this link into any browser:')}`)
  console.log(`  ${chalk.cyan(authorizeUrl)}\n`)
  openBrowser(authorizeUrl)

  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    try { _optionalChain([server, 'access', _ => _.closeIdleConnections, 'optionalCall', _2 => _2()]) } catch (e) {}
    try { _optionalChain([server, 'access', _3 => _3.closeAllConnections, 'optionalCall', _4 => _4()]) } catch (e2) {}
    server.close()
  }

  server.on('request', async (req, res) => {
    if (settled) return
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/cli/callback')) {
      res.writeHead(404).end()
      return
    }
    const code = url.searchParams.get('code')
    const stateFromUrl = url.searchParams.get('state')
    const sbTok = url.searchParams.get('sb_token')
    if (sbTok) writeSbTokenFromUrl(sbTok)

    if (!code || stateFromUrl !== state) {
      settled = true
      res.writeHead(400).end('Invalid authorization code or state mismatch', () => {
        _optionalChain([server, 'access', _5 => _5.closeAllConnections, 'optionalCall', _6 => _6()])
        server.close()
        process.exit(1)
      })
      return
    }

    try {
      const machine = machineId()
      const tokenResp = await fetch(`${SUPABASE_URL}/functions/v1/cli-oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, machine_id: machine }),
      })
      const tokenData = (await tokenResp.json()) 

      const token = (tokenData.token || tokenData.access_token) 
      if (!token) throw new Error(String(tokenData.error || 'No token returned'))

      // TOTP gate BEFORE the success page — fail closed.
      await setAuthState(token, String(tokenData.user_email || 'unknown'), Date.now() + 900000, null)
      await enforceTotpAtLogin()

      const expiresInMs = typeof tokenData.expires_in === 'number' ? tokenData.expires_in * 1000 : 7776000000
      writeCredentials({
        version: 2,
        token,
        token_prefix: String(tokenData.token_prefix || token.slice(0, 8)),
        email: String(tokenData.user_email || 'unknown'),
        expires_at: Math.floor((Date.now() + expiresInMs) / 1000),
        device_id: String(tokenData.device_id || ''),
        anon_key: String(tokenData.anon_key || ''),
      })
      setAuthState(token, String(tokenData.user_email || 'unknown'), Date.now() + expiresInMs, (tokenData.anon_key ) || null)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      // Flush the success page to the socket, then tear everything down and
      // exit — otherwise the browser's keep-alive socket keeps the process
      // alive and the user has to Ctrl+C.
      res.end(
        '<html><body style="background:#050505;color:#fafafa;font-family:sans-serif;display:grid;place-items:center;height:100vh"><div><h2>&#10003; Authorized</h2><p>You can close this window and return to the terminal.</p></div></body></html>',
        () => {
          console.log(`\n  ${success(`Authorized as ${tokenData.user_email || 'user'}`)}`)
          console.log(`  ${muted('credentials saved to ~/.squidcloud/credentials — every command now just works')}\n`)
          finish()
          process.exit(0)
        },
      )
    } catch (err) {
      console.error(`\n  ${errMark(err instanceof Error ? err.message : String(err))}\n`)
      if (!res.headersSent) {
        res.writeHead(500).end('Token exchange error', () => { finish(); process.exit(1) })
      } else {
        finish()
        process.exit(1)
      }
    }
  })
}
