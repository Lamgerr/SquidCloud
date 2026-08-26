import chalk from 'chalk'

const NAVY = '#0A0E1A'
const BLUE = '#4FC3F7'
const VIOLET = '#7C4DFF'
const WHITE = '#FFFFFF'

const SQUID_ART = [
  '  ╔═══╗  ',
  ' ╔╝█ █╚╗ ',
  ' ║  ◉  ║ ',
  ' ╚╗   ╔╝ ',
  '  ║ ╦ ║  ',
  ' ╔╝ ║ ╚╗ ',
  ' ║  ║  ║ ',
  ' ╚╗ ║ ╔╝ ',
  '  ╚═══╝  ',
]

export function renderMascot() {
  const lines = SQUID_ART.map((line, i) => {
    const colored = line.replace(/█/g, chalk.hex(VIOLET)('█'))
      .replace(/◉/g, chalk.hex(BLUE)('◉'))
      .replace(/[╔╗╚╝═║╦]/g, (m) => chalk.hex(WHITE)(m))
    return chalk.bgHex(NAVY)(colored)
  })
  return lines.join('\n')
}

export function renderBrandedMascot() {
  const mascot = renderMascot()
  const brand = chalk.hex(BLUE)('SQUID') + chalk.hex(VIOLET)('CLOUD')
  const tagline = chalk.hex(WHITE).dim('static sites · storage · pipelines')
  return `${mascot}\n\n  ${brand}  ${tagline}\n`
}
