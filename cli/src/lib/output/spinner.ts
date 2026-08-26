import chalk from 'chalk'

/** Dependency-free spinner — no ora, no native deps, CI-safe. */
const FRAMES = ['▸   ', '▸▸  ', '▸▸▸ ', '▸▸▸▸', ' ▸▸▸▸', '  ▸▸▸', '   ▸▸', '    ▸']

export interface Spinner {
  text(t: string): void
  succeed(suffix?: string): void
  fail(suffix?: string): void
  stop(): void
}

export function createSpinner(text: string): Spinner {
  const enabled = process.stdout.isTTY && !isCI()
  let frame = 0
  let current = text
  let timer: ReturnType<typeof setInterval> | null = null

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
    text(t: string) {
      current = t
      draw()
    },
    succeed(suffix?: string) {
      this.stop()
      console.log(`${enabled ? '\r\x1b[2K' : ''}✓ ${suffix ? `${current} — ${chalk.green(suffix)}` : chalk.green(current)}`)
    },
    fail(suffix?: string) {
      this.stop()
      console.log(`${enabled ? '\r\x1b[2K' : ''}✗ ${suffix ? `${current} — ${chalk.red(suffix)}` : chalk.red(current)}`)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

function isCI(): boolean {
  return !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI)
}
