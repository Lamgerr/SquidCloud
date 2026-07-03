import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'
import { spinner } from '../../lib/output/spinner.js'

interface VerifyResponse {
  matched: boolean
}

export default async function secretsVerify(...args: string[]): Promise<void> {
  if (args.length < 2) {
    throw new Error('Usage: squidcloud secrets verify <name> <value>')
  }

  const [name, value] = args

  const spin = spinner.start('Verifying secret...')

  try {
    const result = await apiClient<VerifyResponse>('POST', `/secrets/${name}/verify`, { value })

    if (result.matched) {
      spin.succeed('MATCHED')
    } else {
      spin.fail('NOT_MATCHED')
      process.exit(1)
    }
  } catch (err) {
    spin.fail('Failed to verify secret')
    throw err
  }
}
