import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'

interface ListSecret {
  id: string
  name: string
  type: string
  created_at: string
}

export default async function secretsList(): Promise<void> {
  const secrets = await apiClient<ListSecret[]>('GET', '/secrets')

  if (!secrets || secrets.length === 0) {
    logger.info('No secrets found')
    return
  }

  const header = `${'Name'.padEnd(24)} ${'ID'.padEnd(10)} ${'Type'.padEnd(12)} Created`
  logger.log(header)
  logger.log('─'.repeat(header.length))

  for (const s of secrets) {
    const idShort = s.id.length > 8 ? s.id.slice(0, 8) : s.id
    const created = s.created_at ? new Date(s.created_at).toISOString().replace('T', ' ').slice(0, 19) : '-'
    logger.log(`${s.name.padEnd(24)} ${idShort.padEnd(10)} ${s.type.padEnd(12)} ${created}`)
  }
}
