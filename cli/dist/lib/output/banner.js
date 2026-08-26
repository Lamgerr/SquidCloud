 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import chalk from 'chalk'
import gradient from 'gradient-string'

/* ANSI-shadow lettering, sized to the terminal. Wide screens get the full
   SQUIDCLOUD mark; narrow ones (phones, split panes) get stacked or inline
   variants so nothing ever wraps into garbage. */

const GLYPHS = {
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  Q: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
}

function wordRows(word) {
  return [0, 1, 2, 3, 4, 5].map((r) => word.split('').map((ch) => _nullishCoalesce(_optionalChain([GLYPHS, 'access', _ => _[ch], 'optionalAccess', _2 => _2[r]]), () => ( ''))).join(''))
}

const squidGradient = gradient(['#4FC3F7', '#7C4DFF'])
const fogGradient = gradient(['#e4e4e7', '#a1a1aa'])

export function terminalColumns() {
  return process.stdout.columns || process.stderr.columns || 80
}

/** Compact single-line wordmark for narrow terminals. */
export function renderWordmark() {
  return squidGradient('◆ SQUIDCLOUD CTL')
}

/**
 * Renders the biggest variant that fits the current terminal width:
 *   ≥ 86 cols  full SQUIDCLOUD
 *   ≥ 46 cols  SQUID / CLOUD stacked
 *   <  46 cols inline wordmark
 */
export function renderBanner(opts = {}) {
  const cols = _nullishCoalesce(opts.width, () => ( terminalColumns()))
  const out = []

  if (!process.stdout.isTTY && cols === 80) {
    // Non-TTY (piped/CI): keep it tiny and predictable.
    out.push(renderWordmark())
  } else if (cols >= 86) {
    out.push(...wordRows('SQUIDCLOUD').map((l) => fogGradient(l.replace(/\s+$/, ''))))
  } else if (cols >= 48) {
    out.push(...wordRows('SQUID').map((l) => fogGradient(l.replace(/\s+$/, ''))))
    out.push('')
    out.push(...wordRows('CLOUD').map((l) => squidGradient(l.replace(/\s+$/, ''))))
  } else {
    out.push(renderWordmark())
  }

  if (opts.tagline !== false) {
    out.push('')
    out.push(`   ${squidGradient('SQUIDCLOUD CTL')}  ${chalk.dim('encrypted storage · shares · secrets')}`)
  }
  out.push('')
  return out.join('\n')
}
