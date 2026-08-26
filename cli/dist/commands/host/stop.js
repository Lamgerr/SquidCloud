import fs from 'node:fs'
import { readHostPid, HOST_PID_FILE } from './api.js'
import { success, warn as warnMark } from '../../lib/output/brand.js'

export default async function hostStop() {
  const p = readHostPid()
  if (!p) { console.log(`\n  ${warnMark('no host running')}\n`); return }
  try { process.kill(p.pid, 'SIGTERM') } catch (e) {}
  try { fs.rmSync(HOST_PID_FILE, { force: true }) } catch (e2) {}
  console.log(`\n  ${success(`host stopped (pid ${p.pid})`)}\n`)
}
