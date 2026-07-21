import { supabase } from '@/integrations/supabase/client'
import { SUPABASE_URL } from '@/lib/supabaseEnv'
import { uploadFileWithRes54 } from '@/lib/res54'
import JSZip from 'jszip'

export interface GitHubConnection {
  id: string
  github_user_id: string
  github_username: string
  scope: string
  created_at: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  html_url: string
  clone_url: string
  default_branch: string
  updated_at: string
  owner: string
}

export interface CloneResult {
  success: boolean
  repository: string
  filesCreated: number
  foldersCreated: number
  files: Array<{ id: string; name: string; size: number; type: string; created_at: string; parent_folder?: string }>
  folders: Array<{ path: string; id: string }>
  encryptionKey: string
  message: string
}

interface CloneProgress {
  current: number
  total: number
  currentFile: string
  stage: string
}

export type CloneProgressCallback = (progress: CloneProgress) => void

const SOURCE_REPO_TAG = 'sourceRepo'

async function callEdge<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) throw new Error(error.message || `Edge function error: ${functionName}`)
  const result = data as any
  if (result?.error) throw new Error(result.error)
  return result as T
}

async function authedEdge<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw new Error(error.message || `Edge function error: ${functionName}`)
  const result = data as any
  if (result?.error) throw new Error(result.error)
  return result as T
}

export async function getAuthUrl(redirectUri: string): Promise<string> {
  const result = await callEdge<{ authUrl: string }>('github-oauth', {
    action: 'auth-url',
    redirectUri,
  })
  return result.authUrl
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  github_username: string
  github_user_id: string
  scope: string
}> {
  return callEdge('github-oauth', { action: 'exchange', code })
}

export async function storeToken(params: {
  accessToken: string
  ghUserId: string
  ghUsername: string
  scope: string
}): Promise<void> {
  await authedEdge('github-oauth', {
    action: 'store-token',
    accessToken: params.accessToken,
    ghUserId: params.ghUserId,
    ghUsername: params.ghUsername,
    scope: params.scope,
  })
}

export async function getConnections(): Promise<GitHubConnection[]> {
  const result = await authedEdge<{ connections: GitHubConnection[] }>('github-oauth', { action: 'connections' })
  return result.connections
}

export async function getUserRepos(): Promise<{ repos: GitHubRepo[]; username: string }> {
  return authedEdge('github-oauth', { action: 'repos' })
}

export async function disconnectGitHub(connectionId: string): Promise<void> {
  await authedEdge('github-oauth', { action: 'disconnect', connectionId })
}

function getParentPath(filePath: string): string | null {
  const idx = filePath.lastIndexOf('/')
  if (idx <= 0) return null
  return filePath.substring(0, idx)
}

function sortedFolderPaths(fileNames: string[], rootName: string): string[] {
  const folderPaths = new Set<string>()
  for (const normalizedPath of fileNames) {
    const parent = getParentPath(normalizedPath)
    if (parent) {
      const prefixed = rootName + '/' + parent
      folderPaths.add(prefixed)
      let p = getParentPath(parent)
      while (p) {
        folderPaths.add(rootName + '/' + p)
        p = getParentPath(p)
      }
    }
  }
  return Array.from(folderPaths).sort((a, b) => a.split('/').length - b.split('/').length)
}

async function updateFileRecord(
  fileId: string,
  parentFolderId: string | null,
  sourceRepo: string,
): Promise<any> {
  const { data: existing } = await supabase
    .from('files')
    .select('tags')
    .eq('id', fileId)
    .single()

  let metadata: any = {}
  if (existing?.tags?.[0]) {
    try { metadata = JSON.parse(existing.tags[0]) } catch {}
  }
  metadata[SOURCE_REPO_TAG] = sourceRepo

  const { data, error } = await supabase
    .from('files')
    .update({
      parent_folder: parentFolderId,
      tags: [JSON.stringify(metadata)],
    })
    .eq('id', fileId)
    .select('id, name, size, type, created_at, parent_folder')
    .single()

  if (error) throw error
  return data
}

export async function cloneRepoToWorkspace(params: {
  repoUrl: string
  workspaceId?: string | null
  targetFolderId?: string
  encryptionKey?: string
  onProgress?: CloneProgressCallback
}): Promise<CloneResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  const userId = session.user.id
  const accessToken = session.access_token

  params.onProgress?.({ current: 0, total: 0, currentFile: '', stage: 'Downloading repository...' })

  const zipArrayBuffer = await (async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/clone-repo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: params.repoUrl }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Download failed' }))
      throw new Error(err.error || `Download failed (${res.status})`)
    }
    return res.arrayBuffer()
  })()

  const zip = await JSZip.loadAsync(zipArrayBuffer)
  const fileNames: string[] = []
  let folderPrefix = ''
  for (const filename of Object.keys(zip.files)) {
    if (folderPrefix === '') {
      const idx = filename.indexOf('/')
      folderPrefix = idx >= 0 ? filename.substring(0, idx + 1) : ''
    }
    if (zip.files[filename].dir) continue
    const n = folderPrefix ? filename.substring(folderPrefix.length) : filename
    if (!n) continue
    if (n.startsWith('.git/') || n === '.git' || n.startsWith('.github/')) continue
    fileNames.push(n)
  }
  if (fileNames.length === 0) throw new Error('No files found in repository')

  const repoName = params.repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo'
  const ownerMatch = params.repoUrl.match(/github\.com[\/:](\w[\w.-]*)/)
  const sourceRepo = params.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')
  const workspaceId = params.workspaceId || null

  params.onProgress?.({ current: 0, total: fileNames.length, currentFile: '', stage: 'Creating folder structure...' })

  const { data: repoFolder } = await supabase
    .from('folders')
    .insert({
      name: repoName, path: repoName, user_id: userId,
      parent_folder: params.targetFolderId || null, workspace_id: workspaceId,
    })
    .select('id')
    .single()
  if (!repoFolder) throw new Error('Failed to create root folder')

  const folderIdMap = new Map<string, string | null>()
  folderIdMap.set(repoName, repoFolder.id)

  for (const folderPath of sortedFolderPaths(fileNames, repoName)) {
    if (folderIdMap.has(folderPath)) continue
    const parts = folderPath.split('/')
    const parentPath = getParentPath(folderPath)
    const { data: f } = await supabase
      .from('folders')
      .insert({ name: parts[parts.length - 1], path: folderPath, user_id: userId, parent_folder: parentPath, workspace_id: workspaceId })
      .select('id')
      .single()
    if (f) folderIdMap.set(folderPath, f.id)
  }

  const createdFiles: CloneResult['files'] = []
  let lastError: string | null = null

  for (let i = 0; i < fileNames.length; i++) {
    const np = fileNames[i]
    const entry = zip.files[folderPrefix + np] || zip.files[np]
    if (!entry || entry.dir) continue

    params.onProgress?.({ current: i + 1, total: fileNames.length, currentFile: np, stage: `Uploading (${i + 1}/${fileNames.length})` })

    try {
      const content = await entry.async('uint8array')
      const fileName = np.split('/').pop() || 'file'
      const parentPath = (getParentPath(np) ? repoName + '/' + getParentPath(np) : repoName) || repoName

      const file = new File([content], fileName, { type: '' })
      const result = await uploadFileWithRes54(file)
      const record = await updateFileRecord(result.id, parentPath, sourceRepo)
      createdFiles.push(record)
    } catch (e: any) {
      lastError = `${np}: ${e.message}`
      console.error('File upload failed:', lastError)
    }
  }

  if (createdFiles.length === 0) throw new Error(lastError || 'Failed to upload any files')

  params.onProgress?.({ current: fileNames.length, total: fileNames.length, currentFile: '', stage: 'Complete' })

  return {
    success: true,
    repository: ownerMatch ? ownerMatch[0] : repoName,
    filesCreated: createdFiles.length,
    foldersCreated: folderIdMap.size,
    files: createdFiles,
    folders: Array.from(folderIdMap.entries()).map(([p, id]) => ({ path: p, id })),
    encryptionKey: '',
    message: `Cloned ${createdFiles.length} file${createdFiles.length !== 1 ? 's' : ''}`,
  }
}

export function buildGitHubOAuthRedirectUri(): string {
  return `${window.location.origin}/github/oauth/callback`
}

export async function openGitHubConnect(): Promise<void> {
  window.location.href = await getAuthUrl(buildGitHubOAuthRedirectUri())
}
