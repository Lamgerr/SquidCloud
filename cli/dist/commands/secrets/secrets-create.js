 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } async function _asyncOptionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = await fn(value); } else if (op === 'call' || op === 'optionalCall') { value = await fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { apiPost } from '../../lib/api/client.js'
import { success } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'

function readStdinMaybe() {
  if (process.stdin.isTTY) return Promise.resolve(null)
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    setTimeout(() => resolve(data || null), 1500)
  })
}

export default async function secretsCreate(...args) {
  const parts = args.filter((a) => typeof a === 'string') 
  let name = parts[0]
  let value = parts[1]
  if (!value && !process.stdin.isTTY) value = await _asyncOptionalChain([(await readStdinMaybe()), 'optionalAccess', async _ => _.trim, 'call', async _2 => _2()]) || undefined
  if (!name || !value) throw new Error('Usage: squidcloudctl secrets create <name> <value>   (or pipe value on stdin)')
  const res = await apiPost('/secrets', { name, value })
  if (isJsonMode()) console.log(JSON.stringify({ name, id: _optionalChain([res, 'optionalAccess', _3 => _3.id]) }, null, 2))
  else console.log(`\n  ${success(`secret "${name}" stored`)}${_optionalChain([res, 'optionalAccess', _4 => _4.id]) ? ` — ${res.id}` : ''}\n`)
}
