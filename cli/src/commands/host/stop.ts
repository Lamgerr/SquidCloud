import fs from 'node:fs'
import { readHostPid, HOST_PID_FILE } from './api.js'
import { success, warn as warnMark } from '../../lib/output/brand.js'

export default async function hostStop(): Promise<void> {
  const p = readHostPid()
  if (!p) { console.log(`\n  ${warnMark('no host running')}\n`); return }
  try { process.kill(p.pid, 'SIGTERM') } catch {}
  try { fs.rmSync(HOST_PID_FILE, { force: true }) } catch {}
  console.log(`\n  ${success(`host stopped (pid ${p.pid})`)}\n`)
}
