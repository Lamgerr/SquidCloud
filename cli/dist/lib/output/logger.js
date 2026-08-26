 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import chalk from 'chalk'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { isCI } from '../utils/ci-detect.js'
import { BRAND_MARKER, SUCCESS_MARK, ERROR_MARK, WARN_MARK, INFO_MARK, } from './brand.js'

let jsonMode = false

export function setJsonMode(mode) {
  jsonMode = mode
}

export function isJsonMode() {
  return jsonMode
}





function timestamp() {
  return chalk.dim(`[${new Date().toISOString()}]`)
}

export function log(message, options) {
  if (jsonMode) return
  const prefix = _optionalChain([options, 'optionalAccess', _ => _.prefix]) ? `${options.prefix} ` : ''
  if (isCI()) {
    console.log(`${timestamp()} ${prefix}${message}`)
  } else {
    console.log(`${prefix}${message}`)
  }
}

export function logSuccess(message) {
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

export function logError(message) {
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

export function logWarn(message) {
  if (jsonMode) return
  if (isCI()) {
    console.warn(`${timestamp()} ${WARN_MARK} ${chalk.hex('#FF9800')(message)}`)
  } else {
    console.warn(`${WARN_MARK} ${chalk.hex('#FF9800')(message)}`)
  }
}

export function logInfo(message) {
  if (jsonMode) return
  if (isCI()) {
    console.log(`${timestamp()} ${INFO_MARK} ${chalk.hex('#4FC3F7')(message)}`)
  } else {
    console.log(`${INFO_MARK} ${chalk.hex('#4FC3F7')(message)}`)
  }
}

export function logBrand(message) {
  if (jsonMode) return
  console.log(`${BRAND_MARKER} ${message}`)
}

export function logRaw(message) {
  if (jsonMode) return
  console.log(message)
}

export function logJSON(data) {
  if (!jsonMode) return
  console.log(JSON.stringify(data))
}

export function logErrorJSON(data) {
  if (!jsonMode) {
    logError(data.message)
    return
  }
  console.error(JSON.stringify({ error: data }))
}

export const logger = { log, logSuccess, logError, logWarn, logInfo, logBrand, logRaw, logJSON, logErrorJSON, writeAudit, setJsonMode, isJsonMode }

export function writeAudit(command, args, exitCode) {
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
  } catch (e) {
    // Silently fail — audit should never crash the CLI
  }
}
