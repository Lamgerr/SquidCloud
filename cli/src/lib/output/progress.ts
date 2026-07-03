import cliProgress from 'cli-progress'
import chalk from 'chalk'
import { formatBytes, formatDuration } from '../utils/format.js'
import { isCI, isJsonMode } from './index.js'
import { PROGRESS_MARK } from './brand.js'

interface SpeedTracker {
  startTime: number
  lastBytes: number
  lastTime: number
  speed: number
}

export function createSpeedTracker(): SpeedTracker {
  const now = Date.now()
  return { startTime: now, lastBytes: 0, lastTime: now, speed: 0 }
}

export function updateSpeed(t: SpeedTracker, bytes: number): void {
  const now = Date.now()
  const dt = (now - t.lastTime) / 1000
  if (dt >= 0.3) {
    t.speed = (bytes - t.lastBytes) / dt
    t.lastBytes = bytes
    t.lastTime = now
  }
}

export function speedInfo(t: SpeedTracker, total: number): string {
  const speed = t.speed
  const elapsed = (Date.now() - t.startTime) / 1000
  const eta = speed > 0 ? ((total - t.lastBytes) / speed) : 0
  return `${chalk.hex('#4FC3F7')(`${formatBytes(speed)}/s`)} ${chalk.dim(`· ETA ${formatDuration(eta * 1000)}`)}`
}

export function createProgressBar(filename: string, total: number): { bar: cliProgress.SingleBar; tracker: SpeedTracker } {
  const tracker = createSpeedTracker()

  const bar = new cliProgress.SingleBar({
    format: (options, params, payload) => {
      const percent = params.percentage ?? 0
      const val = params.value ?? 0
      const barSize = params.barsize ?? 20
      const completeLen = Math.round(barSize * percent / 100)
      const barStr = chalk.hex('#7C4DFF')(
        options.barCompleteChar!.repeat(completeLen) +
        options.barIncompleteChar!.repeat(barSize - completeLen)
      )
      const name = (payload as { filename?: string })?.filename ?? filename
      const speed = tracker.speed
      const eta = speed > 0 ? ((total - val) / speed) : 0
      return [
        `${PROGRESS_MARK} ${chalk.bold(name)}`,
        barStr,
        chalk.white(`${percent.toFixed(0)}%`),
        chalk.dim(`${formatBytes(val)} / ${formatBytes(total)}`),
        chalk.hex('#4FC3F7')(`${formatBytes(speed)}/s`),
        chalk.dim(`ETA ${formatDuration(eta * 1000)}`),
      ].join(' ')
    },
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true,
  })

  bar.start(total, 0, { filename })
  return { bar, tracker }
}

export function updateProgress(bar: cliProgress.SingleBar, tracker: SpeedTracker, bytes: number): void {
  updateSpeed(tracker, bytes)
  bar.update(bytes)
}
