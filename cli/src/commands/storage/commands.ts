import chalk from 'chalk'
import { apiGet, apiDelete, apiPut, apiPost } from '../../lib/api/client.js'
import { resolveFileRef } from '../../lib/refs.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

function humanBytes(n?: number): string {
  if (!n && n !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n, u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)}${units[u]}`
}

export async function storageLs(...args: unknown[]): Promise<void> {
  const opts = (args.find((a) => a && typeof a === 'object') || {}) as Record<string, unknown>
  const qs = new URLSearchParams({ per_page: '100' })
  if (opts.search) qs.set('search', String(opts.search))
  if (opts.folder) {
    const res0 = await apiGet<{ folders?: Array<{ id: string; name: string }> }>('/files?per_page=100')
    const q = String(opts.folder).replace(/^#/, '')
    const m = (res0.folders || []).find((f) => f.name === q || f.id.startsWith(q))
    qs.set('folder_id', m?.id || String(opts.folder))
  }
  const res = await apiGet<{ files?: any[]; folders?: any[] }>(`/files?${qs.toString()}`)
  if (isJsonMode()) { console.log(JSON.stringify(res, null, 2)); return }
  console.log()
  for (const f of res.folders || []) console.log(`  ${chalk.blue.bold('DIR')}   ${f.name}/`)
  for (const f of res.files || []) console.log(`       ${(f.name ?? '').padEnd(34).slice(0, 34)}  ${humanBytes(f.size).padStart(9)}  ${chalk.dim(f.id.slice(0, 8))}`)
  console.log(`\n  ${(res.folders || []).length} folder(s) · ${(res.files || []).length} file(s)\n`)
}

export async function storageInfo(...args: unknown[]): Promise<void> {
  const ref = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!ref) throw new Error('Usage: squidcloudctl storage info <#n | id | name>')
  const { entry } = await resolveFileRef(ref)
  const full = await apiGet<{ file?: Record<string, unknown> }>(`/files/${entry.id}/metadata`)
  const f = full.file || (entry as Record<string, unknown>)
  if (isJsonMode()) { console.log(JSON.stringify(f, null, 2)); return }
  console.log()
  for (const k of ['id', 'name', 'type', 'size', 'encrypted', 'processor', 'created_at']) {
    if (f[k] !== undefined) console.log(`  ${k.padEnd(12)} ${String(f[k]).slice(0, 72)}`)
  }
  console.log()
}

export async function storageRm(...args: unknown[]): Promise<void> {
  const refs = args.filter((a) => typeof a === 'string') as string[]
  if (refs.length === 0) throw new Error('Usage: squidcloudctl storage rm <#n | id | name> [more…]')
  const resolved = []
  for (const r of refs) resolved.push(await resolveFileRef(r))
  for (const { entry } of resolved) {
    await apiDelete(`/files/${entry.id}`)
    if (isJsonMode()) console.log(JSON.stringify({ deleted: entry.id }))
    else console.log(`  ${success('deleted')} ${entry.name}`)
  }
}

export async function storageMv(...args: unknown[]): Promise<void> {
  const [ref, newName] = args.filter((a) => typeof a === 'string') as string[]
  if (!ref || !newName) throw new Error('Usage: squidcloudctl storage mv <#n | id | name> <new-name>')
  const { entry } = await resolveFileRef(ref)
  await apiPut(`/files/${entry.id}/rename`, { name: newName })
  if (isJsonMode()) console.log(JSON.stringify({ id: entry.id, renamed_to: newName }))
  else console.log(`  ${success('renamed')} ${entry.name} → ${newName}`)
}

export async function storageCp(...args: unknown[]): Promise<void> {
  const [ref, newName] = args.filter((a) => typeof a === 'string') as string[]
  if (!ref || !newName) throw new Error('Usage: squidcloudctl storage cp <#n | id | name> <copy-name>')
  const { entry } = await resolveFileRef(ref)
  try {
    const copyRes = await apiPost<{ id?: string; file?: { id?: string }; data?: any }>(`/files/${entry.id}/copy`, { name: newName })
    const newId = (copyRes as any)?.id || (copyRes as any)?.file?.id || (copyRes as any)?.data?.id || ''
    if (isJsonMode()) console.log(JSON.stringify({ source: entry.id, copy_id: newId }))
    else console.log(`  ${success('copied')} ${newId || newName}`)
  } catch {
    throw new Error('Server-side copy is not enabled for this account — download + re-upload works today.')
  }
}

export async function storageSearch(...args: unknown[]): Promise<void> {
  const q = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!q) throw new Error('Usage: squidcloudctl storage search <query>')
  const { listFiles } = await import('../../lib/refs.js')
  const entries = await listFiles({ search: q, refresh: true })
  if (isJsonMode()) { console.log(JSON.stringify({ matches: entries.length, files: entries }, null, 2)); return }
  console.log()
  entries.forEach((e, i) => console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${e.name}  ${chalk.dim(e.id)}`))
  console.log(`\n  ${entries.length} match(es)\n`)
}
