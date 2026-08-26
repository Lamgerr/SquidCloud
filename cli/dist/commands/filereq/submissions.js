 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import chalk from 'chalk'
import { resolveFileRef } from '../../lib/refs.js'
import { submissionsFor } from './client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function filereqSubs(...args) {
  const ref = (args.filter((a) => typeof a === 'string')[0] ) || ''
  if (!ref) throw new Error('Usage: squidcloudctl filereq submissions <#n | id | slug>')
  // Accept a request number from `filereq ls` OR any file-ref form.
  let id = ref.replace(/^#/, '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    try { id = (await resolveFileRef(ref)).entry.id } catch (e) { /* keep raw */ }
  }
  const rows = await submissionsFor(id)
  if (isJsonMode()) { console.log(JSON.stringify({ count: _nullishCoalesce(_optionalChain([rows, 'optionalAccess', _ => _.length]), () => ( 0)), submissions: rows }, null, 2)); return }
  console.log()
  for (const s of rows || []) {
    const f = s.file || {}
    console.log(`  ${chalk.cyan((f.name || s.file_name || '—').padEnd(30).slice(0, 30))} ${muted(String(_nullishCoalesce(_nullishCoalesce(f.size, () => ( s.file_size)), () => ( ''))).padStart(9))}  ${muted(s.uploader_name || s.uploader_email || 'anonymous')}  ${muted(f.id || s.file_id || '')}`)
  }
  console.log(`\n  ${(rows || []).length} submission(s)\n`)
}
