import chalk from 'chalk'
import { apiPost } from '../../lib/api/client.js'
import { resolveFileRef } from '../../lib/refs.js'
import { success, muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function shareCreate(...args: unknown[]): Promise<void> {
  const strArgs = args.filter((a) => typeof a === 'string') as string[]
  const opts = (args.find((a) => a && typeof a === 'object') || {}) as Record<string, unknown>
  if (strArgs.length === 0) throw new Error('Usage: squidcloudctl share create <#n | id | name> [--expires 7d] [--max-downloads n] [--view-only]')

  const body: Record<string, unknown> = {}
  const { entry } = await resolveFileRef(strArgs[0])
  body.file_id = entry.id
  if (opts.expires) {
    const m = String(opts.expires).match(/^(\d+)([dhm])$/)
    body.expires_at = m
      ? new Date(Date.now() + Number(m[1]) * (m[2] === 'd' ? 86400 : m[2] === 'h' ? 3600 : 60) * 1000).toISOString()
      : new Date(String(opts.expires)).toISOString()
  }
  if (opts.maxDownloads !== undefined) body.max_downloads = Number(opts.maxDownloads)
  if (opts.viewOnly) body.view_only = true

  const res = await apiPost<{ share_url?: string; share_id?: string }>('/shares', body)
  if (isJsonMode()) { console.log(JSON.stringify(res, null, 2)); return }
  console.log(`\n  ${success('share ready')}`)
  console.log(`  ${chalk.bold(res.share_url || '—')}`)
  if (res.share_id) console.log(`  ${muted(`share id: ${res.share_id}`)}`)
  console.log()
}
