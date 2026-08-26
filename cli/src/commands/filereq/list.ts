import chalk from 'chalk'
import { listRequests } from './client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

interface Req { id: string; title: string; slug?: string; is_active?: boolean; created_at?: string }

export default async function filereqList(): Promise<void> {
  const rows = await listRequests<Req[]>()
  if (isJsonMode()) { console.log(JSON.stringify({ count: rows?.length ?? 0, requests: rows }, null, 2)); return }
  console.log()
  for (const r of rows || []) {
    const state = r.is_active === false ? chalk.dim('[closed]') : chalk.green('[open]')
    console.log(`  ${chalk.cyan(r.title.padEnd(26).slice(0, 26))} ${state}  ${muted(r.slug || r.id)}`)
  }
  console.log(`\n  ${(rows || []).length} request(s)\n`)
}
