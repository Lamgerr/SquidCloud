import chalk from 'chalk'
import { readHostPid } from './api.js'

export default async function hostStatus() {
  const p = readHostPid()
  console.log()
  if (!p) console.log(`  ${chalk.dim('no local API host running')} — start one with \`squidcloudctl host api\``)
  else {
    console.log(`  pid      ${p.pid}`)
    console.log(`  api      http://127.0.0.1:${p.port}  (${p.mode}, ${p.profile})`)
    console.log(`  redis    127.0.0.1:${p.redisPort}`)
    console.log(`  uptime   ${Math.round((Date.now() - p.started_at) / 1000)}s`)
  }
  console.log()
}
