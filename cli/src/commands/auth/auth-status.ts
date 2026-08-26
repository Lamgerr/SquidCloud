import fs from 'node:fs'
import os from 'node:os'
import chalk from 'chalk'
import { apiGet } from '../../lib/api/client.js'
import { success, warn as warnMark, muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'
import { tokenExpiresAt, getCredentialsPath } from '../../lib/auth/oauth-session.js'

export default async function authStatus(): Promise<void> {
  const credsExist = fs.existsSync(getCredentialsPath())
  const minsLeft = tokenExpiresAt ? Math.round((tokenExpiresAt - Date.now()) / 60000) : null
  let apiOk = false, email: string | null = null
  try { const r = await apiGet<{ email?: string }>('/user/whoami'); apiOk = !!r; email = r?.email || null } catch {}

  if (isJsonMode()) { console.log(JSON.stringify({ authenticated: apiOk, email, credentials: credsExist, minutes_left: minsLeft }, null, 2)); return }
  console.log()
  console.log(`  ${chalk.bold('session')}      ${apiOk ? success('valid') : warnMark('invalid or expired')}`)
  console.log(`  ${chalk.bold('account')}      ${email || muted('unknown')}`)
  console.log(`  ${chalk.bold('credentials')}  ${credsExist ? muted('~/.squidcloud/credentials') : warnMark('none — run `squidcloudctl login`')}`)
  if (minsLeft !== null) console.log(`  ${chalk.bold('expires in')}    ${minsLeft > 1440 ? `${Math.round(minsLeft / 1440)}d` : minsLeft > 60 ? `${Math.round(minsLeft / 60)}h` : `${minsLeft}m`}`)
  console.log(`  ${chalk.bold('host')}         ${muted(os.hostname())}\n`)
}
