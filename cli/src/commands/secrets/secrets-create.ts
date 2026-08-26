import { apiPost } from '../../lib/api/client.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

function readStdinMaybe(): Promise<string | null> {
  if (process.stdin.isTTY) return Promise.resolve(null)
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    setTimeout(() => resolve(data || null), 1500)
  })
}

export default async function secretsCreate(...args: unknown[]): Promise<void> {
  const parts = args.filter((a) => typeof a === 'string') as string[]
  let name = parts[0]
  let value = parts[1]
  if (!value && !process.stdin.isTTY) value = (await readStdinMaybe())?.trim() || undefined
  if (!name || !value) throw new Error('Usage: squidcloudctl secrets create <name> <value>   (or pipe value on stdin)')
  const res = await apiPost<{ id?: string }>('/secrets', { name, value })
  if (isJsonMode()) console.log(JSON.stringify({ name, id: res?.id }, null, 2))
  else console.log(`\n  ${success(`secret "${name}" stored`)}${res?.id ? ` — ${res.id}` : ''}\n`)
}
