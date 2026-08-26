import chalk from 'chalk'
import { createFolder } from './folders-helpers.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function foldersCreate(...args: unknown[]): Promise<void> {
  const name = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!name) throw new Error('Usage: squidcloudctl folders mkdir <name>')
  const folder = await createFolder(name)
  if (isJsonMode()) { console.log(JSON.stringify(folder, null, 2)); return }
  console.log(`\n  ${success('created')} ${chalk.bold(folder.name || name)} · ${folder.id}\n`)
}
