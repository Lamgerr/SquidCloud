 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import fs from 'node:fs'
import os from 'node:os'
import chalk from 'chalk'
import { apiGet } from '../../lib/api/client.js'
import { success, warn as warnMark, muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'
import { tokenExpiresAt, getCredentialsPath } from '../../lib/auth/oauth-session.js'

export default async function authStatus() {
  const credsExist = fs.existsSync(getCredentialsPath())
  const minsLeft = tokenExpiresAt ? Math.round((tokenExpiresAt - Date.now()) / 60000) : null
  let apiOk = false, email = null
  try { const r = await apiGet('/user/whoami'); apiOk = !!r; email = _optionalChain([r, 'optionalAccess', _ => _.email]) || null } catch (e) {}

  if (isJsonMode()) { console.log(JSON.stringify({ authenticated: apiOk, email, credentials: credsExist, minutes_left: minsLeft }, null, 2)); return }
  console.log()
  console.log(`  ${chalk.bold('session')}      ${apiOk ? success('valid') : warnMark('invalid or expired')}`)
  console.log(`  ${chalk.bold('account')}      ${email || muted('unknown')}`)
  console.log(`  ${chalk.bold('credentials')}  ${credsExist ? muted('~/.squidcloud/credentials') : warnMark('none — run `squidcloudctl login`')}`)
  if (minsLeft !== null) console.log(`  ${chalk.bold('expires in')}    ${minsLeft > 1440 ? `${Math.round(minsLeft / 1440)}d` : minsLeft > 60 ? `${Math.round(minsLeft / 60)}h` : `${minsLeft}m`}`)
  console.log(`  ${chalk.bold('host')}         ${muted(os.hostname())}\n`)
}
