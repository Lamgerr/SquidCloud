 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import { apiGet, apiPost } from '../../lib/api/client.js'



export async function listFolders() {
  const res = await apiGet('/files?per_page=100')
  return res.folders || []
}

export async function createFolder(name, parentFolder) {
  return apiPost('/folders', { name, parent_folder: _nullishCoalesce(parentFolder, () => ( undefined)) })
}
