import { sitesApi } from './client.js'
import { success } from '../../lib/output/brand.js'

export default async function sitesVisibility(...args: unknown[]): Promise<void> {
  const strArgs = args.filter((a) => typeof a === 'string') as string[]
  const opts = (args.find((a) => a && typeof a === 'object') || {}) as Record<string, unknown>
  const ref = strArgs[0]
  if (!ref) throw new Error('Usage: squidcloudctl sites visibility <slug> [--public|--private]')
  const pub = await sitesApi<{ publications?: any[] }>('list').then((r) => (r.publications || []).find((p) => p.slug === ref.replace(/^#/, '')))
  if (!pub) throw new Error(`Site "${ref}" not found.`)
  const current = (pub as any).is_public === false ? false : true
  const next = opts.public ? true : opts.private ? false : !current
  await sitesApi('visibility', { publicationId: (pub as any).id, isPublic: next })
  console.log(`\n  ${success(`"${(pub as any).slug}" is now ${next ? 'public' : 'private'}`)}\n`)
}
