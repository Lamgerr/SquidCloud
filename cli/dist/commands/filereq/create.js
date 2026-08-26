 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import chalk from 'chalk'
import { createRequest } from './client.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function filereqCreate(...args) {
  const strArgs = args.filter((a) => typeof a === 'string') 
  const opts = (args.find((a) => a && typeof a === 'object') || {}) 
  const title = strArgs[0]
  if (!title) throw new Error('Usage: squidcloudctl filereq create "Design assets" [--max-files 5] [--expires 7d]')
  let expiresAt = null
  if (opts.expires) {
    const m = String(opts.expires).match(/^(\d+)([dhm])$/)
    expiresAt = m
      ? new Date(Date.now() + Number(m[1]) * (m[2] === 'd' ? 86400 : m[2] === 'h' ? 3600 : 60) * 1000).toISOString()
      : String(opts.expires)
  }
  const res = await createRequest({
    p_title: title,
    p_description: String(opts.description || ''),
    p_folder_path: '',
    p_max_files: Number(opts.maxFiles || 0),
    p_max_size_per_file: 0,
    p_allowed_types: null,
    p_expires_at: expiresAt,
  })
  const out = Array.isArray(res) ? res[0] : res
  if (isJsonMode()) { console.log(JSON.stringify(out, null, 2)); return }
  console.log(`\n  ${success('file request created')}`)
  if (_optionalChain([out, 'optionalAccess', _ => _.slug])) console.log(`  ${chalk.bold(`https://squidcloud.vercel.app/r/${out.slug}`)}`)
  console.log()
}
