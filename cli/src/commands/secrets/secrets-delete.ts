import { apiDelete } from '../../lib/api/client.js'
import { success } from '../../lib/output/brand.js'

export default async function secretsDelete(...args: unknown[]): Promise<void> {
  const id = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!id) throw new Error('Usage: squidcloudctl secrets delete <id>')
  await apiDelete(`/secrets/${id}`)
  console.log(`\n  ${success('secret deleted')}\n`)
}
