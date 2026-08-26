import chalk from 'chalk'

/** Dependency-free spinner — no ora, no native deps, CI-safe. */
const FRAMES = ['▸   ', '▸▸  ', '▸▸▸ ', '▸▸▸▸', ' ▸▸▸▸', '  ▸▸▸', '   ▸▸', '    ▸']








export function createSpinner(text) {
  const enabled = process.stdout.isTTY && !isCI()
  let frame = 0
  let current = text
  let timer = null

  const draw = () => {
    if (!enabled) return
    process.stdout.write(`\r\x1b[2K${chalk.cyan(FRAMES[frame % FRAMES.length])} ${current}`)
    frame++
  }

  if (enabled) {
    timer = setInterval(draw, 110)
    draw()
  } else {
    console.log(`• ${current}`)
  }

  return {
    text(t) {
      current = t
      draw()
    },
    succeed(suffix) {
      this.stop()
      console.log(`${enabled ? '\r\x1b[2K' : ''}✓ ${suffix ? `${current} — ${chalk.green(suffix)}` : chalk.green(current)}`)
    },
    fail(suffix) {
      this.stop()
      console.log(`${enabled ? '\r\x1b[2K' : ''}✗ ${suffix ? `${current} — ${chalk.red(suffix)}` : chalk.red(current)}`)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

function isCI() {
  return !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI)
}
