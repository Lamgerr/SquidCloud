import { readSession, PID_FILE } from './binary.js'
import fs from 'node:fs'
import { success, warn as warnMark } from '../../lib/output/brand.js'

export default async function fsStop(): Promise<void> {
  const s = readSession()
  if (!s) { console.log(`\n  ${warnMark('no session running')}\n`); return }
  try { process.kill(s.pid, 'SIGTERM') } catch {}
  try { fs.rmSync(PID_FILE, { force: true }) } catch {}
  console.log(`\n  ${success(`stopped squidfs (pid ${s.pid})`)}\n`)
}
