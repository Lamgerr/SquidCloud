#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import chalk from 'chalk'
import { setJsonMode, logError, writeAudit } from '../lib/output/index.js'
import { isCI } from '../lib/utils/ci-detect.js'
import { getAllCommands, type CommandDescriptor } from '../registry/index.js'
import { loadOAuthSession, clearOAuthSession, authToken } from '../lib/auth/oauth-session.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')) as {
  version: string
  description: string
}

const BIN = 'squidcloudctl'
const program = new Command()

/** Auto-login: an authed command without a session launches OAuth inline.
    CI / pipes fall back to SQUIDCLOUD_API_KEY. */
async function ensureAuth(cmd: CommandDescriptor): Promise<void> {
  await loadOAuthSession()
  if (!cmd.requiresAuth) return

  if (!authToken) {
    if (process.stdin.isTTY && !isCI() && process.env.SQUIDCLOUD_NONINTERACTIVE !== '1') {
      console.log(chalk.dim(`\n  no session found — opening browser to authorize ${BIN}…\n`))
      const { default: loginOAuth } = await import('../commands/auth/login-oauth.js')
      await loginOAuth()
      await loadOAuthSession()
      if (!authToken) throw new Error('Authorization did not complete.')
    } else {
      throw new Error(
        `Not authenticated. Run \`${BIN} login\`, or set SQUIDCLOUD_API_KEY for non-interactive use.`,
      )
    }
  }

  const { tokenExpiresAt } = await import('../lib/auth/oauth-session.js')
  if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
    if (process.stdin.isTTY && !isCI() && process.env.SQUIDCLOUD_NONINTERACTIVE !== '1') {
      console.log(chalk.dim('\n  session expired — re-authorizing…\n'))
      const { default: loginOAuth } = await import('../commands/auth/login-oauth.js')
      try {
        await loginOAuth()
        await loadOAuthSession()
        if (!authToken) throw new Error('re-auth failed')
        return
      } catch { /* fall through */ }
    }
    await clearOAuthSession()
    throw new Error(`Session expired. Run \`${BIN} login\` again.`)
  }
}

/** Commands that touch highly sensitive state: each requires a fresh
    Supabase-TOTP verification (KZA-enforced) before anything runs. */
const PRIVILEGED = new Set(['host api', 'fs mount', 'fs webdav', 'keys add', 'keys rm', 'storage rm'])

async function dispatch(cmd: CommandDescriptor, fullName: string, args: unknown[]): Promise<void> {
  try {
    await ensureAuth(cmd)
    if (PRIVILEGED.has(fullName)) {
      const { stepUp } = await import('../lib/auth/totp.js')
      await stepUp(fullName)
    }
    const mod = await cmd.handler()
    if (typeof mod.default === 'function') {
      // Commander signature: (...positionals, optionsObject, commandObject)
      const opts = (args.length >= 2 && typeof args[args.length - 2] === 'object'
        ? args[args.length - 2]
        : {}) as Record<string, unknown>
      let positionals = args.slice(0, -2)
      if (positionals.length === 1 && Array.isArray(positionals[0])) positionals = positionals[0] as unknown[]
      await mod.default(...positionals, opts)
    }
    writeAudit(fullName, process.argv.slice(2).join(' '), 0)
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err)
    if (/credit/i.test(message)) {
      message += '\n  your plan\u2019s daily API allowance is exhausted \u2014 see squidcloud.vercel.app/pricing'
    }
    logError(message)
    writeAudit(fullName, process.argv.slice(2).join(' '), 1)
    process.exit(1)
  }
}

/** Per-command flags — parsed by commander, handed to handlers as the
    trailing options object. */
const OPTIONS: Record<string, Array<[string, string]>> = {
  'login': [['--code', 'Authenticate using device code flow']],
  'files ls': [['--refresh', 'Bypass the local listing cache']],
  'files up': [['--folder <ref>', 'Target folder id or name'], ['--quiet', 'Suppress progress output']],
  'files dl': [['-o, --out <path>', 'Output path']],
  'storage dl': [['-o, --out <path>', 'Output path']],
  'files list': [['--refresh', 'Bypass listing cache']],
  'storage ls': [['--folder <ref>', 'List inside a folder'], ['--search <q>', 'Filter by name']],
  'share create': [
    ['--expires <dur>', 'Expiry like 24h / 7d / 30d'],
    ['--max-downloads <n>', 'Download limit'],
    ['--view-only', 'Disable downloads'],
  ],
  'filereq create': [
    ['--max-files <n>', 'Maximum files per submission'],
    ['--expires <dur>', 'Expiry like 24h / 7d'],
    ['--description <text>', 'Shown to uploaders'],
  ],
  'sites visibility': [['--public', 'Make public'], ['--private', 'Make private']],
  'host api': [
    ['--port <n>', 'API port (default 8065)'],
    ['--redis-port <n>', 'MicroRedis port (default port+1)'],
    ['--profile <p>', 'standard | hardened | paranoid'],
    ['--mode <m>', 'open (loopback, no key) | keyed'],
    ['--key', 'Mint an extra local key at boot (repeatable)'],
    ['--hmac-secret <s>', 'Require HMAC request signing'],
    ['--rps <n>', 'Override per-key requests/second'],
    ['--max-body <size>', 'Body cap like 512mb / 64mb'],
    ['--allow-ips <ips>', 'Comma-separated allowlist'],
    ['--bind <host>', 'Bind address (default 0.0.0.0)'],
  ],
  'fs webdav': [
    ['--port <n>', 'WebDAV port (default 8099)'],
    ['--password <pw>', 'WebDAV password (generated + stored if omitted)'],
    ['--no-password', 'Disable WebDAV auth (loopback-only, explicit opt-out)'],
    ['--bind <host>', 'Bind address (default 0.0.0.0)'],
    ['--mdns', 'Advertise on the LAN via mDNS'],
  ],
  'fs mount': [
    ['--mount <path>', 'FUSE mount point'],
    ['--webdav', 'Force WebDAV mode'],
    ['--port <n>', 'WebDAV port (default 8099)'],
    ['--password <pw>', 'WebDAV password (generated + stored if omitted)'],
    ['--no-password', 'Disable WebDAV auth (loopback-only, explicit opt-out)'],
    ['--bind <host>', 'Bind address (default 0.0.0.0)'],
    ['--mdns', 'Advertise on the LAN via mDNS'],
  ],
}

function register(): void {
  const singles = new Map<string, CommandDescriptor>()
  const groups = new Map<string, Map<string, CommandDescriptor>>()

  for (const cmd of getAllCommands()) {
    const parts = cmd.name.split(' ')
    if (parts.length === 1) {
      if (!singles.has(cmd.name)) singles.set(cmd.name, cmd)
    } else if (parts.length === 2) {
      const [parent, child] = parts
      if (!groups.has(parent)) groups.set(parent, new Map())
      groups.get(parent)!.set(child, cmd)
    }
  }

  // Single-purpose top-level commands.
  for (const [name, cmd] of singles) {
    if (groups.has(name)) continue
    const c = program.command(name)
    c.description(cmd.description)
    c.arguments('[args...]')
    for (const alias of cmd.aliases) c.alias(alias.replace(`${name} `, ''))
    for (const [flag, desc] of OPTIONS[name] ?? []) c.option(flag, desc)
    c.action(async (...args) => dispatch(cmd, name, args))
  }

  // Two-part commands: `files ls` etc.
  for (const [parentName, children] of groups) {
    const parent = program.command(parentName)
    parent.description(`SquidCloud ${parentName} commands`)
    for (const [childName, cmd] of children) {
      const c = parent.command(childName)
      c.description(cmd.description)
      c.arguments('[args...]')
      for (const alias of cmd.aliases.map((a) => a.replace(`${parentName} `, ''))) {
        if (alias && alias !== childName && !alias.startsWith('-')) c.alias(alias)
      }
      for (const [flag, desc] of OPTIONS[`${parentName} ${childName}`] ?? []) c.option(flag, desc)
      c.action(async (...args) => dispatch(cmd, `${parentName} ${childName}`, args))
    }

    // Bare parent invocation (e.g. `squidcloudctl login`) → default child.
    const bare = singles.get(parentName)
    if (bare) {
      parent.action(async (...args) => {
        const opts = (args[args.length - 1] ?? {}) as Record<string, unknown>
        const target = parentName === 'login' && opts.code ? children.get('device')! : bare
        await dispatch(target, target.name, args)
      })
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--version') || args.includes('-v')) {
    const { showVersion } = await import('../commands/util/version.js')
    await showVersion()
    return
  }

  if (args.length === 0) {
    const { showVersion } = await import('../commands/util/version.js')
    await showVersion()
    register()
    program.outputHelp()
    return
  }

  register()
  await program.parseAsync(process.argv)
}

main().catch((err) => {
  logError(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
