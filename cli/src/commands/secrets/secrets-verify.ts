import { apiPost } from '../../lib/api/client.js'
import { success, error as errMark } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function secretsVerify(...args: unknown[]): Promise<void> {
  const [name, value] = args.filter((a) => typeof a === 'string') as string[]
  if (!name || !value) throw new Error('Usage: squidcloudctl secrets verify <name> <value>')
  const res = await apiPost<{ matches?: boolean; verified?: boolean; valid?: boolean }>(`/secrets/${encodeURIComponent(name)}/verify`, { value })
  const ok = !!(res?.matches ?? res?.verified ?? res?.valid)
  if (isJsonMode()) console.log(JSON.stringify({ match: ok }, null, 2))
  else console.log(`\n  ${ok ? success('value matches') : errMark('value does NOT match')}\n`)
  if (!ok) process.exit(1)
}
