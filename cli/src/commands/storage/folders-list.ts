import chalk from 'chalk'
import { listFolders } from './folders-helpers.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function foldersList(): Promise<void> {
  const folders = await listFolders()
  if (isJsonMode()) { console.log(JSON.stringify({ count: folders.length, folders }, null, 2)); return }
  console.log()
  for (const f of folders) console.log(`  ${chalk.blue.bold('DIR')}  ${f.name}  ${chalk.dim(f.id)}`)
  console.log(`\n  ${folders.length} folder(s)\n`)
}
