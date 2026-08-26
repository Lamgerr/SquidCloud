import chalk from 'chalk'
import gradient from 'gradient-string'

/* ANSI-shadow lettering, sized to the terminal. Wide screens get the full
   SQUIDCLOUD mark; narrow ones (phones, split panes) get stacked or inline
   variants so nothing ever wraps into garbage. */

const GLYPHS: Record<string, string[]> = {
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  Q: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
}

function wordRows(word: string): string[] {
  return [0, 1, 2, 3, 4, 5].map((r) => word.split('').map((ch) => GLYPHS[ch]?.[r] ?? '').join(''))
}

const squidGradient = gradient(['#4FC3F7', '#7C4DFF'])
const fogGradient = gradient(['#e4e4e7', '#a1a1aa'])

export function terminalColumns(): number {
  return process.stdout.columns || process.stderr.columns || 80
}

/** Compact single-line wordmark for narrow terminals. */
export function renderWordmark(): string {
  return squidGradient('◆ SQUIDCLOUD CTL')
}

/**
 * Renders the biggest variant that fits the current terminal width:
 *   ≥ 86 cols  full SQUIDCLOUD
 *   ≥ 46 cols  SQUID / CLOUD stacked
 *   <  46 cols inline wordmark
 */
export function renderBanner(opts: { tagline?: boolean; width?: number } = {}): string {
  const cols = opts.width ?? terminalColumns()
  const out: string[] = []

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
