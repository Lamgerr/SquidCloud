import { sitesApi } from './client.js'
import { success } from '../../lib/output/brand.js'

export default async function sitesVisibility(...args) {
  const strArgs = args.filter((a) => typeof a === 'string') 
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 
  const ref = strArgs[0]
  if (!ref) throw new Error('Usage: squidcloudctl sites visibility <slug> [--public|--private]')
  const pub = await sitesApi('list').then((r) => (r.publications || []).find((p) => p.slug === ref.replace(/^#/, '')))
  if (!pub) throw new Error(`Site "${ref}" not found.`)
  const current = (pub ).is_public === false ? false : true
  const next = opts.public ? true : opts.private ? false : !current
  await sitesApi('visibility', { publicationId: (pub ).id, isPublic: next })
  console.log(`\n  ${success(`"${(pub ).slug}" is now ${next ? 'public' : 'private'}`)}\n`)
}
