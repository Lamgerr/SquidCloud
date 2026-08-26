 
































const requiresAuth = true
const noAuth = false

const REGISTRY = [
  // ─── AUTH ───
  { name: 'login', aliases: [], description: 'Authenticate with SquidCloud OAuth (browser flow)', requiresAuth: noAuth, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/login-oauth.js') },
  { name: 'login device', aliases: [], description: 'Authenticate using device code flow (headless)', requiresAuth: noAuth, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/login-device.js') },
  { name: 'logout', aliases: [], description: 'Sign out and clear local credentials', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/logout.js') },
  { name: 'whoami', aliases: ['auth whoami'], description: 'Show the authenticated account', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/whoami.js') },
  { name: 'auth status', aliases: [], description: 'Session health check', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'auth', handler: () => import('../commands/auth/auth-status.js') },

  // ─── FILES ───
  { name: 'files ls', aliases: ['files list'], description: 'List files — every row gets a [#number] for later commands', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'files', handler: () => import('../commands/files/list.js') },
  { name: 'files up', aliases: ['files upload'], description: 'Upload files or folders (client-chunked, cluster-distributed)', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'files', handler: () => import('../commands/files/upload.js') },
  { name: 'files dl', aliases: ['files download'], description: 'Download a file by #number, id prefix, or name', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'files', handler: () => import('../commands/files/download.js') },

  // ─── FOLDERS ───
  { name: 'folders ls', aliases: ['folders list'], description: 'List folders', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'folders', handler: () => import('../commands/storage/folders-list.js') },
  { name: 'folders mkdir', aliases: ['folders create'], description: 'Create a folder', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'folders', handler: () => import('../commands/storage/folders-create.js') },

  // ─── STORAGE ───
  { name: 'storage ls', aliases: ['storage list'], description: 'List folders + files together', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-ls.js') },
  { name: 'storage upload', aliases: ['storage up'], description: 'Upload files or folders', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-upload.js') },
  { name: 'storage download', aliases: ['storage dl'], description: 'Download a file', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-download.js') },
  { name: 'storage info', aliases: [], description: 'Show full metadata for a file', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-info.js') },
  { name: 'storage rm', aliases: [], description: 'Delete files (recoverable from trash)', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'storage', handler: () => import('../commands/storage/storage-rm.js') },
  { name: 'storage mv', aliases: [], description: 'Rename a file', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'storage', handler: () => import('../commands/storage/storage-mv.js') },
  { name: 'storage cp', aliases: [], description: 'Duplicate a file under a new name', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-cp.js') },
  { name: 'storage search', aliases: [], description: 'Search storage by filename', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-search.js') },
  { name: 'storage mkdir', aliases: [], description: 'Create a folder', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'storage', handler: () => import('../commands/storage/storage-mkdir.js') },

  // ─── SHARE ───
  { name: 'share create', aliases: [], description: 'Create a share link (--expires --max-downloads --view-only)', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'share', handler: () => import('../commands/share/create.js') },

  // ─── SECRETS ───
  { name: 'secrets list', aliases: [], description: 'List stored secrets', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-list.js') },
  { name: 'secrets create', aliases: [], description: 'Store a secret (value can arrive on stdin)', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-create.js') },
  { name: 'secrets delete', aliases: [], description: 'Delete a secret by id', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'secrets', handler: () => import('../commands/secrets/secrets-delete.js') },
  { name: 'secrets rename', aliases: [], description: 'Rename a secret', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'secrets', handler: () => import('../commands/secrets/secrets-rename.js') },
  { name: 'secrets verify', aliases: [], description: 'Check a value against a stored secret', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'secrets', handler: () => import('../commands/secrets/secrets-verify.js') },

  // ─── HEALTH ───
  { name: 'health', aliases: [], description: 'API health probe', requiresAuth: noAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'health', handler: () => import('../commands/health.js') },

  // ─── SITES (production) ───
  { name: 'sites ls', aliases: ['sites list'], description: 'List published sites', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/list.js') },
  { name: 'sites open', aliases: [], description: 'Open a site in the browser', requiresAuth, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'safe', category: 'sites', handler: () => import('../commands/sites/open.js') },
  { name: 'sites unpublish', aliases: ['sites delete'], description: 'Take a site offline / remove it', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'sites', handler: () => import('../commands/sites/unpublish.js') },
  { name: 'sites visibility', aliases: [], description: 'Toggle a site public/private', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'caution', category: 'sites', handler: () => import('../commands/sites/visibility.js') },

  // ─── FILE REQUESTS (production) ───
  { name: 'filereq ls', aliases: ['filereq list'], description: 'List file request links', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/filereq/list.js') },
  { name: 'filereq create', aliases: [], description: 'Create a file request link', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/filereq/create.js') },
  { name: 'filereq submissions', aliases: ['filereq subs'], description: 'List submissions for a request', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'safe', category: 'forms', handler: () => import('../commands/filereq/submissions.js') },
  { name: 'filereq delete', aliases: ['filereq rm'], description: 'Delete a file request', requiresAuth, requiresProject: false, ciSafe: true, jsonSupport: true, dangerLevel: 'destructive', category: 'forms', handler: () => import('../commands/filereq/delete.js') },

  // ─── LOCAL API HOST ───
  { name: 'host api', aliases: [], description: 'Host a hardened local API server on :8065 backed by your account', requiresAuth: true, requiresProject: false, ciSafe: false, jsonSupport: true, dangerLevel: 'caution', category: 'utility', handler: () => import('../commands/host/api.js') },
  { name: 'host status', aliases: [], description: 'Show running local host', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/host/status.js') },
  { name: 'host stop', aliases: [], description: 'Stop the running local host', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/host/stop.js') },
  { name: 'host keys add', aliases: [], description: 'Mint another localhost API key', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'caution', category: 'utility', handler: () => import('../commands/host/keys.js').then((m) => ({ default: m.hostKeysAdd })) },
  { name: 'host keys list', aliases: [], description: 'List active local API keys', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/host/keys.js').then((m) => ({ default: m.hostKeysList })) },
  { name: 'host keys revoke', aliases: [], description: 'Revoke a local key by prefix', requiresAuth: false, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'caution', category: 'utility', handler: () => import('../commands/host/keys.js').then((m) => ({ default: m.hostKeysRevoke })) },

  // ─── SquidFS ───
  { name: 'fs mount', aliases: [], description: 'Mount storage as a local disk (FUSE where available)', requiresAuth, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'caution', category: 'utility', handler: () => import('../commands/fs/mount.js') },
  { name: 'fs webdav', aliases: [], description: 'Serve storage over WebDAV on localhost', requiresAuth, requiresProject: false, ciSafe: false, jsonSupport: false, dangerLevel: 'caution', category: 'utility', handler: () => import('../commands/fs/webdav.js') },
  { name: 'fs status', aliases: [], description: 'Show running SquidFS sessions', requiresAuth: noAuth, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/fs/status.js') },
  { name: 'fs stop', aliases: [], description: 'Stop a running SquidFS session', requiresAuth: noAuth, requiresProject: false, ciSafe: true, jsonSupport: false, dangerLevel: 'safe', category: 'utility', handler: () => import('../commands/fs/stop.js') },
]

const seen = new Set()
export const getAllCommands = () =>
  REGISTRY.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)))
