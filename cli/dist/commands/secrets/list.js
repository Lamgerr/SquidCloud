import { apiGet } from '../../lib/api/client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'



export async function secretsList() {
  const res = await apiGet('/secrets')
  const rows = res.secrets || res.data || []
  if (isJsonMode()) { console.log(JSON.stringify({ count: rows.length, secrets: rows }, null, 2)); return }
  console.log()
  rows.forEach((s, i) => console.log(`  ${muted(`[${i + 1}]`)} ${s.name}  ${muted(s.id)}`))
  console.log(`\n  ${rows.length} secret(s)\n`)
}
