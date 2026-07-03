import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'

interface AuditEntry {
  id: string
  action: string
  target: string
  actor: string
  timestamp: string
  details?: string
}

function displayEntry(e: AuditEntry): void {
  const time = e.timestamp
    ? new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19)
    : '-'
  logger.log(`${time}  ${e.action.padEnd(20)} ${e.target.padEnd(30)} ${e.actor}`)
}

function parseFlags(args: string[]): { tail: boolean; limit: number | undefined } {
  let tail = false
  let limit: number | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tail') {
      tail = true
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10)
      if (isNaN(limit)) limit = undefined
      i++
    }
  }

  return { tail, limit }
}

function buildPath(limit?: number, after?: string): string {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (after) params.set('after', after)
  const qs = params.toString()
  return qs ? `/squidshake/audit?${qs}` : '/squidshake/audit'
}

export default async function secretsAudit(...args: string[]): Promise<void> {
  const { tail, limit } = parseFlags(args)

  const entries = await apiClient<AuditEntry[]>('GET', buildPath(limit))

  if (!entries || entries.length === 0) {
    logger.info('No audit log entries found')
    if (!tail) return
  }

  const header = `${'Timestamp'.padEnd(22)} ${'Action'.padEnd(20)} ${'Target'.padEnd(30)} Actor`
  logger.log(header)
  logger.log('─'.repeat(header.length))

  for (const e of entries) {
    displayEntry(e)
  }

  if (tail) {
    logger.log('')
    logger.info('Watching for new entries... (Ctrl+C to stop)')

    let lastId = entries.length > 0 ? entries[entries.length - 1].id : undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise(r => setTimeout(r, 3000))

      try {
        const newEntries = await apiClient<AuditEntry[]>('GET', buildPath(limit, lastId))

        if (newEntries && newEntries.length > 0) {
          for (const e of newEntries) {
            displayEntry(e)
          }
          lastId = newEntries[newEntries.length - 1].id
        }
      } catch {
        // silently retry on next poll
      }
    }
  }
}
