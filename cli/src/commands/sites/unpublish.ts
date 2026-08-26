import { apiDelete } from '../../lib/api/client.js'
import { sitesApi } from './client.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

async function resolvePublication(ref: string): Promise<{ id: string; slug: string; resource_id?: string }> {
  const res = await sitesApi<{ publications?: any[] }>('list')
  const pubs = res.publications || []
  const q = ref.replace(/^#/, '')
  const pub = pubs.find((p: any) => p.slug === q || String(p.id).startsWith(q))
  if (!pub) throw new Error(`Site "${ref}" not found. Run \`squidcloudctl sites ls\`.`)
  return pub
}

export default async function sitesUnpublish(...args: unknown[]): Promise<void> {
  const ref = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!ref) throw new Error('Usage: squidcloudctl sites unpublish <slug | #id>')
  const pub = await resolvePublication(ref)
  try {
    await sitesApi('unpublish', { publicationId: pub.id })
  } catch {
    await sitesApi('unpublish', { resourceId: (pub as any).resource_id })
  }
  // Best-effort cleanup of any API-side file record backing the site.
  if ((pub as any).resource_id) await apiDelete(`/files/${(pub as any).resource_id}`).catch(() => {})
  if (isJsonMode()) console.log(JSON.stringify({ unpublished: pub.slug }))
  else console.log(`\n  ${success(`site "${pub.slug}" unpublished`)}\n`)
}
