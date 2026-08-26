import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { resolveFileRef } from '../../lib/refs.js'
import { downloadFile } from '../../lib/transfer.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function filesDownload(...args: unknown[]): Promise<void> {
  const strArgs = args.filter((a) => typeof a === 'string') as string[]
  const opts = (args.find((a) => a && typeof a === 'object') || {}) as Record<string, unknown>
  const ref = strArgs[0]
  if (!ref) throw new Error('Usage: squidcloudctl files dl <#n | id | name> [-o path]')
  const { entry } = await resolveFileRef(ref)
  if (!isJsonMode()) console.log(`\n  ${chalk.dim(`fetching ${entry.name}…`)}`)
  const finalPath = await downloadFile({ id: entry.id, name: entry.name, userId: (entry as any).user_id }, opts.out ? path.resolve(String(opts.out)) : undefined)
  const size = fs.statSync(finalPath).size
  if (isJsonMode()) console.log(JSON.stringify({ file: finalPath, bytes: size, id: entry.id }, null, 2))
  else console.log(`  ${success('saved')} ${finalPath} (${(size / 1024).toFixed(1)} KB)\n`)
}
