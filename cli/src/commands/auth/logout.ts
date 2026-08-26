import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SUPABASE_URL } from '../../lib/auth/constants.js'
import { clearOAuthSession, authToken } from '../../lib/auth/oauth-session.js'
import { success, muted } from '../../lib/output/brand.js'

export default async function logout(): Promise<void> {
  if (authToken) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/cli-oauth/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: authToken }),
      })
    } catch { /* local sign-out still safe */ }
  }
  clearOAuthSession()
  try { fs.rmSync(path.join(os.homedir(), '.squidcloud', 'cache', 'files.json'), { force: true }) } catch {}
  console.log(`\n  ${success('Signed out.')} Local credentials removed.`)
  console.log(`  ${muted('Run `squidcloudctl login` to authenticate again.')}\n`)
}
