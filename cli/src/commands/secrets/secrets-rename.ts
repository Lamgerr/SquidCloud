import { apiPatch } from '../../lib/api/client.js'
import { success } from '../../lib/output/brand.js'

export default async function secretsRename(...args: unknown[]): Promise<void> {
  const [id, name] = args.filter((a) => typeof a === 'string') as string[]
  if (!id || !name) throw new Error('Usage: squidcloudctl secrets rename <id> <new-name>')
  await apiPatch(`/secrets/${id}/rename`, { name })
  console.log(`\n  ${success(`renamed to ${name}`)}\n`)
}
