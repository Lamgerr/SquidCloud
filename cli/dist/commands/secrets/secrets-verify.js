 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { apiPost } from '../../lib/api/client.js'
import { success, error as errMark } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

export default async function secretsVerify(...args) {
  const [name, value] = args.filter((a) => typeof a === 'string') 
  if (!name || !value) throw new Error('Usage: squidcloudctl secrets verify <name> <value>')
  const res = await apiPost(`/secrets/${encodeURIComponent(name)}/verify`, { value })
  const ok = !!(_nullishCoalesce(_nullishCoalesce(_optionalChain([res, 'optionalAccess', _ => _.matches]), () => ( _optionalChain([res, 'optionalAccess', _2 => _2.verified]))), () => ( _optionalChain([res, 'optionalAccess', _3 => _3.valid]))))
  if (isJsonMode()) console.log(JSON.stringify({ match: ok }, null, 2))
  else console.log(`\n  ${ok ? success('value matches') : errMark('value does NOT match')}\n`)
  if (!ok) process.exit(1)
}
