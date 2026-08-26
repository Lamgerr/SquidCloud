import { deleteRequest } from './client.js'
import { success } from '../../lib/output/brand.js'

export default async function filereqDelete(...args: unknown[]): Promise<void> {
  const ref = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!ref) throw new Error('Usage: squidcloudctl filereq delete <#n | id | slug>')
  const { listRequests } = await import('./client.js')
  let id = ref.replace(/^#/, '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    const rows = await listRequests<any[]>()
    const m = (rows || []).find((r) => r.slug === id || String(r.id).startsWith(id) || r.title === id)
    if (!m) throw new Error(`File request "${ref}" not found. Run \`squidcloudctl filereq ls\`.`)
    id = m.id
  }
  await deleteRequest(id)
  console.log(`\n  ${success('file request deleted')}\n`)
}
