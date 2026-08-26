import chalk from 'chalk'
import gradient from 'gradient-string'

const squidGradient = gradient(['#4FC3F7', '#7C4DFF'])
const dimGradient = gradient(['#1a5276', '#4a148c'])

export const BRAND_MARKER = squidGradient('◆')
export const SUCCESS_MARK = chalk.hex('#4CAF50')('✓')
export const ERROR_MARK = chalk.hex('#F44336')('✗')
export const WARN_MARK = chalk.hex('#FF9800')('⚠')
export const INFO_MARK = chalk.hex('#4FC3F7')('ℹ')
export const PROGRESS_MARK = chalk.hex('#7C4DFF')('▸')

export function brand(text) {
  return squidGradient(text)
}

export function brandDim(text) {
  return dimGradient(text)
}

export function brandLine(text) {
  return `${BRAND_MARKER} ${brand(text)}`
}

export function success(text) {
  return `${SUCCESS_MARK} ${chalk.green(text)}`
}

export function error(text) {
  return `${ERROR_MARK} ${chalk.red(text)}`
}

export function warn(text) {
  return `${WARN_MARK} ${chalk.hex('#FF9800')(text)}`
}

export function info(text) {
  return `${INFO_MARK} ${chalk.hex('#4FC3F7')(text)}`
}

export function muted(text) {
  return chalk.dim(text)
}

export function copied(text) {
  return muted(`(copied to clipboard)`)
}
