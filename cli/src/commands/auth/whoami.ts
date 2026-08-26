import chalk from 'chalk'
import { apiGet } from '../../lib/api/client.js'
import { success, muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

interface WhoAmI {
  id?: string; email?: string; full_name?: string
  total_files?: number
  storage_used?: number
  total_size?: number
  credits?: { remaining?: number; used_today?: number; daily_limit?: number }
}

function humanBytes(n?: number): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n, u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)}${units[u]}`
}

export default async function whoami(): Promise<void> {
  const res = await apiGet<WhoAmI>('/user/whoami')
  if (isJsonMode()) { console.log(JSON.stringify(res, null, 2)); return }
  const used = res.storage_used ?? res.total_size ?? 0
  console.log()
  console.log(`  ${chalk.bold('account')}     ${res.email || res.full_name || 'unknown'}`)
  if (res.id) console.log(`  ${chalk.bold('user id')}     ${muted(res.id)}`)
  if (typeof res.total_files === 'number') {
    console.log(`  ${chalk.bold('storage')}      ${res.total_files} files · ${chalk.bold(humanBytes(used))}`)
  }
  const c = res.credits
  if (c && c.remaining !== undefined) {
    const limit = c.daily_limit === -1 ? 'unlimited' : String(c.daily_limit)
    console.log(`  ${chalk.bold('api credits')}  ${c.remaining === -1 ? '∞ unlimited' : c.remaining} / ${limit}`)
  }
  console.log(`\n  ${success('session valid')} — ${muted('~/.squidcloud/credentials')}\n`)
}
