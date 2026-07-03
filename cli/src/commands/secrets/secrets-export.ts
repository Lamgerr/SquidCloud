import { writeFileSync } from 'node:fs'
import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'

interface ExportSecret {
  id: string
  name: string
  type: string
}

function toToml(secrets: ExportSecret[]): string {
  const lines: string[] = [
    '[squidproxy]',
    'version = "1.0"',
    '',
  ]

  for (const s of secrets) {
    lines.push('[[secrets]]')
    lines.push(`name = "${s.name}"`)
    lines.push(`type = "${s.type}"`)
    lines.push('')
  }

  return lines.join('\n')
}

export default async function secretsExport(...args: string[]): Promise<void> {
  const outputIndex = args.indexOf('--output')
  const outputPath: string | undefined =
    outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : undefined

  const secrets = await apiClient<ExportSecret[]>('GET', '/secrets')

  if (!secrets || secrets.length === 0) {
    logger.info('No secrets to export')
    return
  }

  const toml = toToml(secrets)

  if (outputPath) {
    writeFileSync(outputPath, toml, 'utf-8')
    logger.success(`Exported ${secrets.length} secret(s) to ${outputPath}`)
  } else {
    logger.raw(toml)
  }
}
