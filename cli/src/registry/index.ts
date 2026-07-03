export type CommandCategory =
  | 'auth'
  | 'storage'
  | 'deploy'
  | 'sites'
  | 'scripts'
  | 'automations'
  | 'forms'
  | 'sign'
  | 'time'
  | 'monitor'
  | 'logs'
  | 'collab'
  | 'tunnel'
  | 'id'
  | 'project'
  | 'secrets'
  | 'utility'

export interface CommandDescriptor {
  name: string
  aliases: string[]
  description: string
  requiresAuth: boolean
  requiresProject: boolean
  ciSafe: boolean
  jsonSupport: boolean
  dangerLevel: 'safe' | 'caution' | 'destructive'
  category: CommandCategory
  handler: () => Promise<{ default: (...args: unknown[]) => void | Promise<void> }>
}

const REGISTRY: CommandDescriptor[] = [
  // AUTH
  { name: 'login', aliases: [], description: 'Authenticate with SquidCloud', requiresAuth: false, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/login.js') },
  { name: 'logout', aliases: [], description: 'End current CLI session and clear credentials', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/logout.js') },
  { name: 'whoami', aliases: ['auth whoami'], description: 'Show current authenticated account info', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/whoami.js') },
  { name: 'auth status', aliases: [], description: 'Detailed session health check', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/auth-status.js') },
  { name: 'auth sessions', aliases: [], description: 'List all active CLI sessions', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/auth-sessions.js') },
  { name: 'auth revoke', aliases: [], description: 'Revoke a session or all sessions', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'destructive', category: 'auth', handler: () => import('../commands/auth/auth-revoke.js') },

  // STORAGE
  { name: 'storage ls', aliases: ['storage list'], description: 'List files and folders in storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-ls.js') },
  { name: 'storage upload', aliases: ['storage up'], description: 'Upload files or folders to storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-upload.js') },
  { name: 'storage download', aliases: ['storage dl'], description: 'Download files or folders from storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-download.js') },
  { name: 'storage cp', aliases: [], description: 'Copy files within storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-cp.js') },
  { name: 'storage mv', aliases: [], description: 'Move/rename files within storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'storage', handler: () => import('../commands/storage/storage-mv.js') },
  { name: 'storage rm', aliases: [], description: 'Delete files from storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'storage', handler: () => import('../commands/storage/storage-rm.js') },
  { name: 'storage mkdir', aliases: [], description: 'Create a folder in storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-mkdir.js') },
  { name: 'storage cat', aliases: [], description: 'Print file contents to terminal', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-cat.js') },
  { name: 'storage info', aliases: [], description: 'Show file metadata', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-info.js') },
  { name: 'storage share', aliases: [], description: 'Generate a share link for a file', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-share.js') },
  { name: 'storage unshare', aliases: [], description: 'Revoke all share links for a file', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'storage', handler: () => import('../commands/storage/storage-unshare.js') },
  { name: 'storage tag', aliases: [], description: 'Add or remove file tags', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-tag.js') },
  { name: 'storage search', aliases: [], description: 'Search storage by filename', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-search.js') },
  { name: 'storage diff', aliases: [], description: 'Compare local and remote storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-diff.js') },
  { name: 'storage clean', aliases: [], description: 'Clean orphaned files from storage', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'storage', handler: () => import('../commands/storage/storage-clean.js') },

  // DEPLOY
  { name: 'deploy', aliases: ['squidsite deploy'], description: 'Deploy a static website to SquidCloud Sites', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'deploy', handler: () => import('../commands/deploy/index.js') },

  // SITES
  { name: 'sites list', aliases: ['sites ls'], description: 'List all published sites', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-list.js') },
  { name: 'sites info', aliases: [], description: 'Show site details', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-info.js') },
  { name: 'sites open', aliases: [], description: 'Open site in browser', requiresAuth: true, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-open.js') },
  { name: 'sites unpublish', aliases: [], description: 'Take a site offline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'sites', handler: () => import('../commands/sites/sites-unpublish.js') },
  { name: 'sites delete', aliases: [], description: 'Permanently delete a site', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'sites', handler: () => import('../commands/sites/sites-delete.js') },
  { name: 'sites visibility', aliases: [], description: 'Change site visibility (public/private)', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'sites', handler: () => import('../commands/sites/sites-visibility.js') },
  { name: 'sites rename', aliases: [], description: 'Rename a site slug', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'sites', handler: () => import('../commands/sites/sites-rename.js') },
  { name: 'sites rollback', aliases: [], description: 'Rollback to a previous deployment', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'sites', handler: () => import('../commands/sites/sites-rollback.js') },
  { name: 'sites deploys', aliases: [], description: 'Show deployment history', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-deploys.js') },
  { name: 'sites logs', aliases: [], description: 'Stream live site access logs', requiresAuth: true, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-logs.js') },
  { name: 'sites analytics', aliases: [], description: 'Show site traffic analytics', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/sites-analytics.js') },
  { name: 'sites purge', aliases: [], description: 'Purge CDN cache for a site', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'sites', handler: () => import('../commands/sites/sites-purge.js') },

  // SCRIPTS (Pipelines)
  { name: 'scripts list', aliases: [], description: 'List registered SquidScripts', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-list.js') },
  { name: 'scripts run', aliases: [], description: 'Run a SquidScript pipeline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-run.js') },
  { name: 'scripts logs', aliases: [], description: 'View pipeline run logs', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-logs.js') },
  { name: 'scripts validate', aliases: [], description: 'Validate a .squid.yml file', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-validate.js') },
  { name: 'scripts init', aliases: [], description: 'Create a new pipeline interactively', requiresAuth: true, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-init.js') },
  { name: 'scripts enable', aliases: [], description: 'Enable a disabled pipeline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-enable.js') },
  { name: 'scripts disable', aliases: [], description: 'Disable a pipeline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'scripts', handler: () => import('../commands/scripts/scripts-disable.js') },
  { name: 'scripts delete', aliases: [], description: 'Delete a pipeline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'scripts', handler: () => import('../commands/scripts/scripts-delete.js') },
  { name: 'scripts status', aliases: [], description: 'Show pipeline status', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-status.js') },
  { name: 'scripts cancel', aliases: [], description: 'Cancel a running pipeline', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'scripts', handler: () => import('../commands/scripts/scripts-cancel.js') },
  { name: 'scripts watch', aliases: [], description: 'Watch .squid.yml for changes', requiresAuth: false, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'scripts', handler: () => import('../commands/scripts/scripts-watch.js') },

  // FORMS (File Requests)
  { name: 'filereq list', aliases: ['forms list', 'filereq ls'], description: 'List file requests', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-list.js') },
  { name: 'filereq create', aliases: ['forms create'], description: 'Create a file request', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-create.js') },
  { name: 'filereq info', aliases: ['forms info'], description: 'View file request details', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-info.js') },
  { name: 'filereq submissions', aliases: ['forms submissions'], description: 'View file request submissions', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-submissions.js') },
  { name: 'filereq export', aliases: ['forms export'], description: 'Export submissions as CSV', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-export.js') },
  { name: 'filereq clear', aliases: ['forms clear'], description: 'Clear all submissions', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'forms', handler: () => import('../commands/forms/forms-clear.js') },
  { name: 'filereq delete', aliases: ['forms delete'], description: 'Delete a file request', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'forms', handler: () => import('../commands/forms/forms-delete.js') },
  { name: 'filereq embed', aliases: ['forms embed'], description: 'Get HTML embed snippet', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/forms/forms-embed.js') },

  // SQUIDTIME
  { name: 'time lock', aliases: [], description: 'Time-lock a file or folder', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'time', handler: () => import('../commands/time/time-lock.js') },
  { name: 'time unlock', aliases: [], description: 'Unlock a time-locked file', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'time', handler: () => import('../commands/time/time-unlock.js') },
  { name: 'time status', aliases: [], description: 'Check time-lock status', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'time', handler: () => import('../commands/time/time-status.js') },
  { name: 'time list', aliases: [], description: 'List all time-locked files', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'time', handler: () => import('../commands/time/time-list.js') },
  { name: 'time proof', aliases: [], description: 'Export cryptographic existence proof', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'time', handler: () => import('../commands/time/time-proof.js') },

  // COLLAB
  { name: 'collab invite', aliases: [], description: 'Invite a collaborator to a folder', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'collab', handler: () => import('../commands/collab/collab-invite.js') },
  { name: 'collab list', aliases: [], description: 'List folder collaborators', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'collab', handler: () => import('../commands/collab/collab-list.js') },
  { name: 'collab remove', aliases: [], description: 'Remove a collaborator', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'collab', handler: () => import('../commands/collab/collab-remove.js') },
  { name: 'collab activity', aliases: [], description: 'View collaborator activity feed', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'collab', handler: () => import('../commands/collab/collab-activity.js') },
  { name: 'collab leave', aliases: [], description: 'Leave a shared folder', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'collab', handler: () => import('../commands/collab/collab-leave.js') },
  { name: 'collab transfer', aliases: [], description: 'Transfer folder ownership', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'collab', handler: () => import('../commands/collab/collab-transfer.js') },

  // SQUIDSIGN
  { name: 'sign request', aliases: [], description: 'Request a digital signature', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sign', handler: () => import('../commands/sign/sign-request.js') },
  { name: 'sign status', aliases: [], description: 'Check signing request status', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sign', handler: () => import('../commands/sign/sign-status.js') },
  { name: 'sign list', aliases: [], description: 'List signing requests', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sign', handler: () => import('../commands/sign/sign-list.js') },
  { name: 'sign cancel', aliases: [], description: 'Cancel a signing request', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'sign', handler: () => import('../commands/sign/sign-cancel.js') },
  { name: 'sign verify', aliases: [], description: 'Verify a signed document', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sign', handler: () => import('../commands/sign/sign-verify.js') },
  { name: 'sign download', aliases: [], description: 'Download signed document', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sign', handler: () => import('../commands/sign/sign-download.js') },

  // SQUIDVEIL SECRETS
  { name: 'secrets list', aliases: ['secrets ls'], description: 'List all SquidVeil secrets', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-list.js') },
  { name: 'secrets create', aliases: [], description: 'Create a new secret', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'secrets', handler: () => import('../commands/secrets/secrets-create.js') },
  { name: 'secrets rename', aliases: [], description: 'Rename a secret', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'secrets', handler: () => import('../commands/secrets/secrets-rename.js') },
  { name: 'secrets delete', aliases: [], description: 'Delete a secret', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'secrets', handler: () => import('../commands/secrets/secrets-delete.js') },
  { name: 'secrets verify', aliases: [], description: 'Verify a value against a stored secret', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-verify.js') },
  { name: 'secrets export', aliases: [], description: 'Export secrets config as .squidproxy', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-export.js') },
  { name: 'secrets audit', aliases: [], description: 'View SquidVeil audit log', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-audit.js') },
  { name: 'secrets init', aliases: [], description: 'Initialize .squidveil and .squidproxy in project', requiresAuth: false, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-init.js') },

  // MONITOR
  { name: 'monitor', aliases: [], description: 'At-a-glance SquidCloud health dashboard', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'monitor', handler: () => import('../commands/monitor/monitor.js') },
  { name: 'monitor sites', aliases: [], description: 'Site health overview', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'monitor', handler: () => import('../commands/monitor/monitor-sites.js') },
  { name: 'monitor pipelines', aliases: [], description: 'Pipeline health overview', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'monitor', handler: () => import('../commands/monitor/monitor-pipelines.js') },
  { name: 'monitor storage', aliases: [], description: 'Storage health report', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'monitor', handler: () => import('../commands/monitor/monitor-storage.js') },
  { name: 'monitor automations', aliases: [], description: 'Automation health overview', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'monitor', handler: () => import('../commands/monitor/monitor-automations.js') },

  // LOGS
  { name: 'logs tail', aliases: [], description: 'Stream live logs', requiresAuth: true, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'logs', handler: () => import('../commands/logs/logs-tail.js') },
  { name: 'logs search', aliases: [], description: 'Search historical logs', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'logs', handler: () => import('../commands/logs/logs-search.js') },
  { name: 'logs export', aliases: [], description: 'Export logs as JSONL or CSV', requiresAuth: true, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'logs', handler: () => import('../commands/logs/logs-export.js') },

  // UTILITY
  { name: 'doctor', aliases: [], description: 'Run system diagnostics', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/doctor.js') },
  { name: 'version', aliases: ['--version', '-v'], description: 'Show CLI version', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/version.js') },
  { name: 'config list', aliases: ['config ls'], description: 'List CLI configuration', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/config.js') },
  { name: 'config set', aliases: [], description: 'Set a config value', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/config-set.js') },
  { name: 'config get', aliases: [], description: 'Get a config value', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/config-get.js') },
  { name: 'config delete', aliases: [], description: 'Delete a config value', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/config-delete.js') },
  { name: 'config reset', aliases: [], description: 'Reset all configuration', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'utility', handler: () => import('../commands/util/config-reset.js') },
  { name: 'completion', aliases: [], description: 'Generate shell completion scripts', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/completion.js') },
  { name: 'feedback', aliases: [], description: 'Submit feedback or report a bug', requiresAuth: false, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/feedback.js') },
  { name: 'update', aliases: [], description: 'Update the CLI to latest version', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/util/update.js') },
]

export function getCommand(name: string): CommandDescriptor | undefined {
  const parts = name.trim().toLowerCase().split(/\s+/)
  return REGISTRY.find(cmd => {
    const cmdParts = cmd.name.split(/\s+/)
    if (parts.join(' ') === cmd.name) return true
    for (const alias of cmd.aliases) {
      const aliasParts = alias.split(/\s+/)
      const expandedAlias = (aliasParts[0] === cmdParts[0] && aliasParts.length > 1) ? alias : null
      if (parts.join(' ') === alias) return true
    }
    return false
  })
}

export function getCategory(cat: CommandCategory): CommandDescriptor[] {
  return REGISTRY.filter(cmd => cmd.category === cat)
}

export function getAllCommands(): CommandDescriptor[] {
  return [...REGISTRY]
}

export function getCISafeCommands(): CommandDescriptor[] {
  return REGISTRY.filter(cmd => cmd.ciSafe)
}
