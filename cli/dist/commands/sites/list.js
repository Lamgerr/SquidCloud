import chalk from 'chalk'
import { sitesApi } from './client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'



export default async function sitesList() {
  const res = await sitesApi('list')
  const pubs = res.publications || []
  if (isJsonMode()) { console.log(JSON.stringify({ count: pubs.length, sites: pubs }, null, 2)); return }
  console.log()
  for (const p of pubs) {
    const vis = p.is_public === false ? chalk.dim('[private]') : chalk.green('[public]')
    console.log(`  ${chalk.cyan(p.slug.padEnd(24))} ${vis}  ${muted(p.url || p.site_url || '')}`)
  }
  console.log(`\n  ${pubs.length} site(s)\n`)
}
