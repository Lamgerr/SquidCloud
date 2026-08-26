 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import chalk from 'chalk'
import { listFiles } from '../../lib/refs.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

function humanBytes(n) {
  if (!n && n !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n, u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)}${units[u]}`
}

export default async function filesList(...args) {
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 
  const entries = await listFiles({ refresh: !!opts.refresh })
  if (isJsonMode()) { console.log(JSON.stringify({ count: entries.length, files: entries }, null, 2)); return }
  if (entries.length === 0) {
    console.log(`\n  No files yet. Upload one:\n\n    ${chalk.cyan('squidcloudctl files upload ./report.pdf')}\n`)
    return
  }
  console.log()
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    console.log(`  ${chalk.cyan(`[${String(i + 1).padStart(3)}]`)} ${(_nullishCoalesce(e.name, () => ( '—'))).padEnd(36).slice(0, 36)}  ${muted(humanBytes(e.size).padStart(9))}  ${muted(e.created_at ? String(e.created_at).slice(0, 10) : '')}  ${muted(e.id)}`)
  }
  console.log(`\n  ${entries.length} file(s) · reference any file as [#n | id-prefix | name] in every command\n`)
}
