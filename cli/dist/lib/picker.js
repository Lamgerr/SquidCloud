 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import readline from 'node:readline'
import chalk from 'chalk'


/** Arrow-key numbered picker for ambiguous matches. Dependency-free. */
export async function pickInteractive(entries, query) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null
  const candidates = entries.slice(0, 9)
  if (candidates.length === 0) return null

  const headerLines = [
    '',
    `"${query}" matched ${entries.length} files:`,
    ...candidates.map((e, i) => `  [${i + 1}] ${e.name}  ${chalk.dim(e.id)}`),
    '  ↑/↓ move · 1-9 jump · enter select · esc cancel',
    '',
  ]
  console.log(chalk.dim(headerLines.join('\n')))

  let cursor = 0
  const baseRow = headerLines.length - 2 + 1
  const renderCursor = () => {
    candidates.forEach((_, i) => {
      process.stdout.write(`\x1b[${baseRow + i};1H\x1b[2K${i === cursor ? chalk.cyan('→') : ' '}[${i + 1}] ${candidates[i].name}`)
    })
    process.stdout.write(`\x1b[${baseRow + candidates.length};1H`)
  }

  const wasRaw = process.stdin.isRaw
  if (typeof (process.stdin ).setRawMode === 'function') (process.stdin ).setRawMode(true)
  process.stdin.resume()
  readline.emitKeypressEvents(process.stdin)

  const choice = await new Promise((resolve) => {
    const handler = (_ch, key) => {
      if (!key) return
      if (key.name === 'up') cursor = (cursor - 1 + candidates.length) % candidates.length
      else if (key.name === 'down') cursor = (cursor + 1) % candidates.length
      else if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(cursor); return }
      else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) { cleanup(); resolve(null); return }
      else if (/^[1-9]$/.test(key.sequence || '')) {
        const idx = Number(key.sequence) - 1
        if (idx < candidates.length) { cleanup(); resolve(idx); return }
      } else return
      renderCursor()
    }
    const cleanup = () => process.stdin.removeListener('keypress', handler)
    process.stdin.on('keypress', handler)
    renderCursor()
  })

  if (typeof (process.stdin ).setRawMode === 'function') (process.stdin ).setRawMode(!!wasRaw)
  process.stdin.pause()
  for (let i = 0; i < candidates.length + 2; i++) process.stdout.write('\x1b[1A\x1b[2K')
  return choice === null ? null : (_nullishCoalesce(candidates[choice], () => ( null)))
}
