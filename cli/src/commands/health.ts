import { apiGet } from '../lib/api/client.js'
import { success, error as errMark, muted } from '../lib/output/brand.js'
import { isJsonMode } from '../lib/output/logger.js'

export default async function health(): Promise<void> {
  try {
    await apiGet('/health')
    if (isJsonMode()) console.log(JSON.stringify({ status: 'ok' }, null, 2))
    else console.log(`\n  ${success('API healthy')}\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (isJsonMode()) console.log(JSON.stringify({ status: 'down', error: msg }, null, 2))
    else console.log(`\n  ${errMark('API unreachable')} — ${muted(msg)}\n`)
    process.exit(1)
  }
}
