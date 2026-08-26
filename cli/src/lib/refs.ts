import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apiGet } from './api/client.js'
import { pickInteractive } from './picker.js'
import type { FileEntry } from './refs-types.js'

/* Numbered file registry — every listing caches entries locally so any file
   can be referenced by its number (#3), a UUID, a unique id prefix, or an
   exact name. No more pasting 36-character ids. */

const CACHE_DIR = path.join(os.homedir(), '.squidcloud', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'files.json')
const CACHE_TTL_MS = 10 * 60 * 1000

interface CacheShape {
  cached_at: number
  entries: FileEntry[]
}

function readCache(): CacheShape | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as CacheShape
    if (Array.isArray(raw.entries)) return raw
    return null
  } catch {
    return null
  }
}

function writeCache(entries: FileEntry[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    const payload: CacheShape = { cached_at: Date.now(), entries }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload), { mode: 0o600 })
  } catch {
    /* cache is best-effort */
  }
}

export async function listFiles(opts: { search?: string; refresh?: boolean } = {}): Promise<FileEntry[]> {
  const cache = readCache()
  if (!opts.refresh && !opts.search && cache && Date.now() - cache.cached_at < CACHE_TTL_MS) {
    return cache.entries
  }
  const qs = new URLSearchParams({ per_page: '100' })
  if (opts.search) qs.set('search', opts.search)
  const res = await apiGet<{ files?: FileEntry[]; data?: FileEntry[] }>(`/files?${qs.toString()}`)
  const entries: FileEntry[] = res.files || res.data || []
  if (!opts.search && entries.length > 0) writeCache(entries)
  return entries
}

export interface ResolvedFile {
  entry: FileEntry
  how: 'number' | 'uuid' | 'prefix' | 'name' | 'picked'
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

export async function resolveFileRef(ref: string, opts: { refresh?: boolean } = {}): Promise<ResolvedFile> {
  const trimmed = ref.trim().replace(/^#/, '')

  if (/^\d+$/.test(trimmed)) {
    const entries = await listFiles({ refresh: opts.refresh })
    const idx = Number(trimmed) - 1
    if (idx < 0 || idx >= entries.length) {
      throw new Error(
        `#${trimmed} is out of range — the current listing has ${entries.length} files. Run \`squidcloudctl files ls\`.`,
      )
    }
    return { entry: entries[idx], how: 'number' }
  }

  if (isUuid(trimmed)) {
    return { entry: { id: trimmed, name: trimmed }, how: 'uuid' }
  }

  const entries = await listFiles({ refresh: opts.refresh })

  const prefixMatches = entries.filter((e) => e.id.toLowerCase().startsWith(trimmed.toLowerCase()))
  if (prefixMatches.length === 1) return { entry: prefixMatches[0], how: 'prefix' }

  const nameMatches = entries.filter((e) => e.name === ref.trim())
  if (nameMatches.length === 1) return { entry: nameMatches[0], how: 'name' }

  const partial = entries.filter((e) => e.name.toLowerCase().includes(trimmed.toLowerCase()))
  if (partial.length > 1) {
    const picked = await pickInteractive(partial, ref)
    if (picked) return { entry: picked, how: 'picked' }
    throw new Error(`"${ref}" matched ${partial.length} files. Be more specific or use a #number from \`files ls\`.`)
  }
  if (partial.length === 1) return { entry: partial[0], how: 'name' }

  const searched = await listFiles({ search: ref, refresh: true })
  if (searched.length === 1) return { entry: searched[0], how: 'name' }
  throw new Error(
    `No file matches "${ref}". Run \`squidcloudctl files ls\` and use a #number, an id prefix, or an exact name.`,
  )
}
