 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import chalk from 'chalk'
import { listRequests } from './client.js'
import { muted } from '../../lib/output/brand.js'
import { isJsonMode } from '../../lib/output/logger.js'



export default async function filereqList() {
  const rows = await listRequests()
  if (isJsonMode()) { console.log(JSON.stringify({ count: _nullishCoalesce(_optionalChain([rows, 'optionalAccess', _ => _.length]), () => ( 0)), requests: rows }, null, 2)); return }
  console.log()
  for (const r of rows || []) {
    const state = r.is_active === false ? chalk.dim('[closed]') : chalk.green('[open]')
    console.log(`  ${chalk.cyan(r.title.padEnd(26).slice(0, 26))} ${state}  ${muted(r.slug || r.id)}`)
  }
  console.log(`\n  ${(rows || []).length} request(s)\n`)
}
