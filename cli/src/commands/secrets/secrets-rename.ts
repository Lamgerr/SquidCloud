import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'
import { spinner } from '../../lib/output/spinner.js'

export default async function secretsRename(...args: string[]): Promise<void> {
  if (args.length < 2) {
    throw new Error('Usage: squidcloud secrets rename <id> <new-name>')
  }

  const [id, newName] = args

  const spin = spinner.start('Renaming secret...')

  try {
    await apiClient('PATCH', `/secrets/${id}/rename`, { name: newName })
    spin.succeed(`Secret renamed to "${newName}"`)
  } catch (err) {
    spin.fail('Failed to rename secret')
    throw err
  }
}
