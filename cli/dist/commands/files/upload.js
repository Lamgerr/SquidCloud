import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { apiGet } from '../../lib/api/client.js'
import { uploadFile } from '../../lib/transfer.js'
import { success, error as errMark } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function filesUpload(...args) {
  const strArgs = args.filter((a) => typeof a === 'string') 
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 
  if (strArgs.length === 0) throw new Error('Usage: squidcloudctl files up <path> [more…] [--folder <id|name>]')

  const resolved = []
  for (const p of strArgs) {
    const abs = path.resolve(p)
    if (!fs.existsSync(abs)) throw new Error(`Path not found: ${p}`)
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs)) {
        const fp = path.join(abs, f)
        if (fs.statSync(fp).isFile()) resolved.push(fp)
      }
    } else resolved.push(abs)
  }
  if (resolved.length === 0) throw new Error('No files found to upload')

  let folderId
  if (opts.folder) {
    const res = await apiGet('/files?per_page=100')
    const q = String(opts.folder).replace(/^#/, '')
    const match = (res.folders || []).find((f) => f.name === q || f.id.startsWith(q))
    if (!match) throw new Error(`Folder "${opts.folder}" not found. Run \`squidcloudctl folders ls\`.`)
    folderId = match.id
  }

  const uploaded = []
  let failed = 0
  for (const filePath of resolved) {
    try {
      const r = await uploadFile(filePath, { folderId, quiet: !!opts.quiet || isJsonMode() })
      uploaded.push(r)
      if (!isJsonMode() && !opts.quiet && resolved.length === 1) console.log(`\n  ${success('uploaded')} ${chalk.bold(r.name)} → ${r.id}`)
    } catch (err) {
      failed++
      console.error(`  ${errMark('failed')} ${path.basename(filePath)} — ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (isJsonMode()) console.log(JSON.stringify({ uploaded: uploaded.length, failed, files: uploaded }, null, 2))
  else if (resolved.length > 1) console.log(`\n  ${uploaded.length} uploaded${failed ? `, ${failed} failed` : ''}. Run \`files ls\` for numbers.\n`)
}
