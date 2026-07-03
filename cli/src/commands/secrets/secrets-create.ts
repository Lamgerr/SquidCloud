import { createInterface } from 'node:readline'
import { apiClient } from '../../lib/api/client.js'
import { logger } from '../../lib/output/logger.js'
import { spinner } from '../../lib/output/spinner.js'

interface CreateSecretResponse {
  id: string
  name: string
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { positional, flags }
}

async function readStdin(): Promise<string> {
  const rl = createInterface({ input: process.stdin })
  const lines: string[] = []
  for await (const line of rl) {
    lines.push(line)
  }
  return lines.join('\n')
}

export default async function secretsCreate(...args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args)

  if (positional.length < 1) {
    throw new Error('Usage: squidcloud secrets create <name> [value] [--stdin] [--storage res54]')
  }

  const name = positional[0]
  let value: string

  if (flags.stdin) {
    value = await readStdin()
  } else if (positional.length >= 2) {
    value = positional[1]
  } else {
    throw new Error('Missing value. Provide as argument or use --stdin')
  }

  const body: Record<string, unknown> = { name, value }

  if (flags.storage) {
    body.storage = flags.storage
  }

  const spin = spinner.start('Creating secret...')

  try {
    const result = await apiClient<CreateSecretResponse>('POST', '/secrets', body)
    spin.succeed(`Secret created: ${result.name} (${result.id.slice(0, 8)})`)
  } catch (err) {
    spin.fail('Failed to create secret')
    throw err
  }
}
