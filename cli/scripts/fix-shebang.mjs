import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.cwd(), 'dist/bin/squidcloud.js')
const nodeBin = process.env.PREFIX
  ? `${process.env.PREFIX}/bin/node`
  : '/usr/bin/env node'

const shebang = `#!${nodeBin}`
const source = readFileSync(target, 'utf8')
const lines = source.split('\n')
if (lines[0]?.startsWith('#!')) {
  lines[0] = shebang
} else {
  lines.unshift(shebang)
}
writeFileSync(target, lines.join('\n'))
console.log(`shebang set: ${shebang}`)
