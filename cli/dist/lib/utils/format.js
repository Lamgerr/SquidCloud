 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import chalk from 'chalk'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatRelative(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = d.getTime() - now
  const abs = Math.abs(diff)
  const suffix = diff < 0 ? 'ago' : 'from now'

  if (abs < 60000) return `${Math.round(abs / 1000)}s ${suffix}`
  if (abs < 3600000) return `${Math.round(abs / 60000)}m ${suffix}`
  if (abs < 86400000) return `${Math.round(abs / 3600000)}h ${suffix}`
  if (abs < 2592000000) return `${Math.round(abs / 86400000)}d ${suffix}`
  return `${Math.round(abs / 2592000000)}mo ${suffix}`
}

export function formatCountdown(ms) {
  if (ms <= 0) return chalk.red('expired')
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function truncate(str, max) {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + '...'
}

export function pluralize(n, singular, plural) {
  return n === 1 ? `${n} ${singular}` : `${n} ${_nullishCoalesce(plural, () => ( singular + 's'))}`
}

export function maskEmail(email) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  const masked = name[0] + '***' + name[name.length - 1]
  return `${masked}@${domain}`
}
