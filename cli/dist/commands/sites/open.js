 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { sitesApi } from './client.js'
import { openBrowser } from '../../lib/utils/open.js'

export default async function sitesOpen(...args) {
  const slug = (args.filter((a) => typeof a === 'string')[0] ) || ''
  if (!slug) throw new Error('Usage: squidcloudctl sites open <slug>')
  const res = await sitesApi('list')
  const pub = (res.publications || []).find((p) => p.slug === slug)
  const url = _optionalChain([pub, 'optionalAccess', _ => _.url]) || _optionalChain([pub, 'optionalAccess', _2 => _2.site_url]) || `https://squidcloud.vercel.app/s/${slug}`
  openBrowser(url)
  console.log(`\n  opened ${url}\n`)
}
