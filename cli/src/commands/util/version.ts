import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBanner } from '../../lib/output/banner.js'
import { muted } from '../../lib/output/brand.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function showVersion(): Promise<void> {
  let version = '3.0.0'
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'))
    version = pkg.version || version
  } catch {}
  console.log(renderBanner({ tagline: true }))
  console.log(`  ${muted(`squidcloudctl v${version} · node ${process.version} · ${process.platform}-${process.arch}`)}`)
}
