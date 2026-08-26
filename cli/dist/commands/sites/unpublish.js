import { apiDelete } from '../../lib/api/client.js'
import { sitesApi } from './client.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

async function resolvePublication(ref) {
  const res = await sitesApi('list')
  const pubs = res.publications || []
  const q = ref.replace(/^#/, '')
  const pub = pubs.find((p) => p.slug === q || String(p.id).startsWith(q))
  if (!pub) throw new Error(`Site "${ref}" not found. Run \`squidcloudctl sites ls\`.`)
  return pub
}

export default async function sitesUnpublish(...args) {
  const ref = (args.filter((a) => typeof a === 'string')[0] ) || ''
  if (!ref) throw new Error('Usage: squidcloudctl sites unpublish <slug | #id>')
  const pub = await resolvePublication(ref)
  try {
    await sitesApi('unpublish', { publicationId: pub.id })
  } catch (e) {
    await sitesApi('unpublish', { resourceId: (pub ).resource_id })
  }
  // Best-effort cleanup of any API-side file record backing the site.
  if ((pub ).resource_id) await apiDelete(`/files/${(pub ).resource_id}`).catch(() => {})
  if (isJsonMode()) console.log(JSON.stringify({ unpublished: pub.slug }))
  else console.log(`\n  ${success(`site "${pub.slug}" unpublished`)}\n`)
}
