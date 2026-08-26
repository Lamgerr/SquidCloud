 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { generateApiKey } from '../../lib/host/security.js'
import chalk from 'chalk'
import { error as errMark } from '../../lib/output/brand.js'

/** Keys live inside the running host's MicroRedis — this helper talks to it
    over loopback so `keys add/list/revoke` work while the server is up. */

async function redisCommand(...args) {
  const pid = (await import('./api.js')).readHostPid()
  if (!pid) throw new Error('No host running — start one with `squidcloudctl host api`.')
  const net = await import('node:net')
  return new Promise((resolve, reject) => {
    const socket = net.connect(pid.redisPort, '127.0.0.1', () => {
      socket.write(`*${args.length}\r\n${args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}`).join('\r\n')}\r\n`)
    })
    let data = ''
    socket.on('data', (d) => {
      data += d.toString()
      setTimeout(() => { socket.end(); resolve(data) }, 40)
    })
    socket.on('error', reject)
    setTimeout(() => reject(new Error('redis timeout')), 3000)
  })
}

export async function hostKeysAdd() {
  const k = generateApiKey()
  await redisCommand('SET', `key:${k.hash}`, k.prefix)
  console.log(`\n  ${chalk.bold.yellow('NEW LOCAL KEY (shown once)')}\n  ${chalk.cyan(k.key)}\n`)
}

export async function hostKeysList() {
  const raw = await redisCommand('KEYS', 'key:*')
  const count = Number(_optionalChain([raw, 'access', _ => _.split, 'call', _2 => _2('\r\n'), 'access', _3 => _3[0], 'optionalAccess', _4 => _4.slice, 'call', _5 => _5(1)]) || 0)
  const keys = []
  const lines = raw.split('\r\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('$')) keys.push(_nullishCoalesce(lines[i + 1], () => ( '')))
  }
  console.log(`\n  ${count} key(s)`)
  for (const k of keys) console.log(`   ${k.replace('key:', '').slice(0, 16)}…`)
  console.log()
}

export async function hostKeysRevoke(...args) {
  const prefix = (args.filter((a) => typeof a === 'string')[0] ) || ''
  if (!prefix) throw new Error('Usage: squidcloudctl host keys revoke <key-prefix>')
  const raw = await redisCommand('KEYS', 'key:*')
  const lines = raw.split('\r\n')
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('$')) {
      const full = _nullishCoalesce(lines[i + 1], () => ( ''))
      if (full.includes(prefix)) { await redisCommand('DEL', full); n++ }
    }
  }
  if (n === 0) console.log(`\n  ${errMark(`no key matches "${prefix}"`)}\n`)
  else console.log(`\n  revoked ${n} key(s)\n`)
}
