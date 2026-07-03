import { createInterface } from 'node:readline'
import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'
import { spinner } from '../../lib/output/spinner.js'

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`${prompt} (y/N) `, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export default async function secretsDelete(...args: string[]): Promise<void> {
  const forceIndex = args.indexOf('--force')
  const force = forceIndex !== -1
  const id = force ? args.filter((_, i) => i !== forceIndex)[0] : args[0]

  if (!id) {
    throw new Error('Usage: squidcloud secrets delete <id> [--force]')
  }

  if (!force) {
    const ok = await confirm(`Delete secret ${id}?`)
    if (!ok) {
      logger.info('Cancelled')
      return
    }
  }

  const spin = spinner.start('Deleting secret...')

  try {
    await apiClient('DELETE', `/secrets/${id}`)
    spin.succeed(`Secret deleted: ${id.slice(0, 8)}`)
  } catch (err) {
    spin.fail('Failed to delete secret')
    throw err
  }
}
