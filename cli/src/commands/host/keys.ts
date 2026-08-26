import { generateApiKey } from '../../lib/host/security.js'
import chalk from 'chalk'
import { error as errMark } from '../../lib/output/brand.js'

/** Keys live inside the running host's MicroRedis — this helper talks to it
    over loopback so `keys add/list/revoke` work while the server is up. */

async function redisCommand(...args: string[]): Promise<string> {
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

export async function hostKeysAdd(): Promise<void> {
  const k = generateApiKey()
  await redisCommand('SET', `key:${k.hash}`, k.prefix)
  console.log(`\n  ${chalk.bold.yellow('NEW LOCAL KEY (shown once)')}\n  ${chalk.cyan(k.key)}\n`)
}

export async function hostKeysList(): Promise<void> {
  const raw = await redisCommand('KEYS', 'key:*')
  const count = Number(raw.split('\r\n')[0]?.slice(1) || 0)
  const keys: string[] = []
  const lines = raw.split('\r\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('$')) keys.push(lines[i + 1] ?? '')
  }
  console.log(`\n  ${count} key(s)`)
  for (const k of keys) console.log(`   ${k.replace('key:', '').slice(0, 16)}…`)
  console.log()
}

export async function hostKeysRevoke(...args: unknown[]): Promise<void> {
  const prefix = (args.filter((a) => typeof a === 'string')[0] as string) || ''
  if (!prefix) throw new Error('Usage: squidcloudctl host keys revoke <key-prefix>')
  const raw = await redisCommand('KEYS', 'key:*')
  const lines = raw.split('\r\n')
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('$')) {
      const full = lines[i + 1] ?? ''
      if (full.includes(prefix)) { await redisCommand('DEL', full); n++ }
    }
  }
  if (n === 0) console.log(`\n  ${errMark(`no key matches "${prefix}"`)}\n`)
  else console.log(`\n  revoked ${n} key(s)\n`)
}
