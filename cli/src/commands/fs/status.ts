import chalk from 'chalk'
import { readSession } from './binary.js'

export default async function fsStatus(): Promise<void> {
  const s = readSession()
  console.log()
  if (!s) console.log(`  ${chalk.dim('no SquidFS session running')} — start one with \`squidcloudctl fs mount\``)
  else {
    console.log(`  pid     ${s.pid}`)
    console.log(`  mode    ${s.mode}`)
    if (s.port) console.log(`  webdav  http://localhost:${s.port}/`)
    if (s.mount) console.log(`  mount   ${s.mount}`)
    console.log(`  up      ${Math.round((Date.now() - s.started_at) / 1000)}s`)
  }
  console.log()
}
