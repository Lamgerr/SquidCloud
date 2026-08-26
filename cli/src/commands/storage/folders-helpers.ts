import { apiGet, apiPost } from '../../lib/api/client.js'

export interface FolderRow { id: string; name: string; parent_folder?: string | null }

export async function listFolders(): Promise<FolderRow[]> {
  const res = await apiGet<{ folders?: FolderRow[] }>('/files?per_page=100')
  return res.folders || []
}

export async function createFolder(name: string, parentFolder?: string | null): Promise<FolderRow> {
  return apiPost<FolderRow>('/folders', { name, parent_folder: parentFolder ?? undefined })
}
