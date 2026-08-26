import { sitesApi } from './client.js'
import { openBrowser } from '../../lib/utils/open.js'

export default async function sitesOpen(...args: unknown[]): Promise<void> {
  const slug = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!slug) throw new Error('Usage: squidcloudctl sites open <slug>')
  const res = await sitesApi<{ publications?: Array<{ slug: string; url?: string; site_url?: string }> }>('list')
  const pub = (res.publications || []).find((p) => p.slug === slug)
  const url = pub?.url || pub?.site_url || `https://squidcloud.vercel.app/s/${slug}`
  openBrowser(url)
  console.log(`\n  opened ${url}\n`)
}
