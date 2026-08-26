import chalk from 'chalk'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { isCI } from '../utils/ci-detect.js'
import { BRAND_MARKER, SUCCESS_MARK, ERROR_MARK, WARN_MARK, INFO_MARK, muted } from './brand.js'

let jsonMode = false

export function setJsonMode(mode: boolean): void {
  jsonMode = mode
}

export function isJsonMode(): boolean {
  return jsonMode
}

interface LogOptions {
  prefix?: string
}

function timestamp(): string {
  return chalk.dim(`[${new Date().toISOString()}]`)
}

export function log(message: string, options?: LogOptions): void {
  if (jsonMode) return
  const prefix = options?.prefix ? `${options.prefix} ` : ''
  if (isCI()) {
    console.log(`${timestamp()} ${prefix}${message}`)
  } else {
    console.log(`${prefix}${message}`)
  }
}

export function logSuccess(message: string): void {
  if (jsonMode) {
    console.log(JSON.stringify({ level: 'success', message }))
    return
  }
  if (isCI()) {
    console.log(`${timestamp()} ${SUCCESS_MARK} ${message}`)
  } else {
    console.log(`${SUCCESS_MARK} ${chalk.green(message)}`)
  }
}

export function logError(message: string): void {
  if (jsonMode) {
    console.error(JSON.stringify({ error: { message } }))
    return
  }
  if (isCI()) {
    console.error(`${timestamp()} ${ERROR_MARK} ${chalk.red(message)}`)
  } else {
    console.error(`${ERROR_MARK} ${chalk.red(message)}`)
  }
}

export function logWarn(message: string): void {
  if (jsonMode) return
  if (isCI()) {
    console.warn(`${timestamp()} ${WARN_MARK} ${chalk.hex('#FF9800')(message)}`)
  } else {
    console.warn(`${WARN_MARK} ${chalk.hex('#FF9800')(message)}`)
  }
}

export function logInfo(message: string): void {
  if (jsonMode) return
  if (isCI()) {
    console.log(`${timestamp()} ${INFO_MARK} ${chalk.hex('#4FC3F7')(message)}`)
  } else {
    console.log(`${INFO_MARK} ${chalk.hex('#4FC3F7')(message)}`)
  }
}

export function logBrand(message: string): void {
  if (jsonMode) return
  console.log(`${BRAND_MARKER} ${message}`)
}

export function logRaw(message: string): void {
  if (jsonMode) return
  console.log(message)
}

export function logJSON(data: unknown): void {
  if (!jsonMode) return
  console.log(JSON.stringify(data))
}

export function logErrorJSON(data: { message: string; code?: string }): void {
  if (!jsonMode) {
    logError(data.message)
    return
  }
  console.error(JSON.stringify({ error: data }))
}

export const logger = { log, logSuccess, logError, logWarn, logInfo, logBrand, logRaw, logJSON, logErrorJSON, writeAudit, setJsonMode, isJsonMode }

export function writeAudit(command: string, args: string, exitCode: number): void {
  const auditDir = path.join(os.homedir(), '.squidcloud')
  const auditFile = path.join(auditDir, 'audit.log')
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    command,
    args,
    exitCode,
    pid: process.pid,
  }) + '\n'
  try {
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true, mode: 0o700 })
    }
    fs.appendFileSync(auditFile, entry, { encoding: 'utf-8' })
  } catch {
    // Silently fail — audit should never crash the CLI
  }
}
