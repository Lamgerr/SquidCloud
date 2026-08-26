import chalk from 'chalk'
import { resolveFileRef } from '../../lib/refs.js'
import { submissionsFor } from './client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function filereqSubs(...args: unknown[]): Promise<void> {
  const ref = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!ref) throw new Error('Usage: squidcloudctl filereq submissions <#n | id | slug>')
  // Accept a request number from `filereq ls` OR any file-ref form.
  let id = ref.replace(/^#/, '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    try { id = (await resolveFileRef(ref)).entry.id } catch { /* keep raw */ }
  }
  const rows = await submissionsFor<any[]>(id)
  if (isJsonMode()) { console.log(JSON.stringify({ count: rows?.length ?? 0, submissions: rows }, null, 2)); return }
  console.log()
  for (const s of rows || []) {
    const f = s.file || {}
    console.log(`  ${chalk.cyan((f.name || s.file_name || '—').padEnd(30).slice(0, 30))} ${muted(String(f.size ?? s.file_size ?? '').padStart(9))}  ${muted(s.uploader_name || s.uploader_email || 'anonymous')}  ${muted(f.id || s.file_id || '')}`)
  }
  console.log(`\n  ${(rows || []).length} submission(s)\n`)
}
