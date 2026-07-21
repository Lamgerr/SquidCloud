import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Github, GitBranch, Search, Loader2, Check, X, ExternalLink, Folder, Globe, ArrowLeft, RefreshCw, User } from '@/lib/icon-map'
import {
  getConnections,
  getUserRepos,
  cloneRepoToWorkspace,
  disconnectGitHub,
  openGitHubConnect,
  type GitHubConnection,
  type GitHubRepo,
  type CloneResult,
  type CloneProgressCallback,
} from '@/services/github-clone'
import { useToast } from '@/hooks/use-toast'

interface GitHubRepoCloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFolder?: string
  workspaceId?: string | null
  onCloneComplete?: (result: CloneResult) => void
}

type Step = 'select-source' | 'enter-url' | 'select-repo' | 'cloning' | 'done'

const GitHubRepoCloneDialog: React.FC<GitHubRepoCloneDialogProps> = ({
  open,
  onOpenChange,
  currentFolder,
  workspaceId,
  onCloneComplete,
}) => {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('select-source')
  const [connections, setConnections] = useState<GitHubConnection[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [repoSearch, setRepoSearch] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [reposLoading, setReposLoading] = useState(false)
  const [cloneProgress, setCloneProgress] = useState(0)
  const [cloneCurrentFile, setCloneCurrentFile] = useState('')
  const [cloneStage, setCloneStage] = useState('')
  const [cloneFileCount, setCloneFileCount] = useState({ current: 0, total: 0 })
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null)
  const [cloneError, setCloneError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStep('select-source')
      setRepoUrl('')
      setRepoSearch('')
      setCloneResult(null)
      setCloneError(null)
      setCloneProgress(0)
      setCloneCurrentFile('')
      setCloneStage('')
      setCloneFileCount({ current: 0, total: 0 })
      loadConnections()
    }
  }, [open])

  const loadConnections = async () => {
    try {
      const conns = await getConnections()
      setConnections(conns)
    } catch (e) {
      console.error('Failed to load GitHub connections:', e)
    }
  }

  const handleConnectGitHub = async () => {
    try {
      await openGitHubConnect()
    } catch (e: any) {
      toast({ title: 'GitHub connection failed', description: e.message, variant: 'destructive' })
    }
  }

  const handleLoadRepos = async () => {
    setReposLoading(true)
    try {
      const result = await getUserRepos()
      setRepos(result.repos)
      setStep('select-repo')
    } catch (e: any) {
      toast({ title: 'Failed to load repos', description: e.message, variant: 'destructive' })
    } finally {
      setReposLoading(false)
    }
  }

  const handleURLPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (text.includes('github.com')) {
      setRepoUrl(text)
    }
  }

  const validateUrl = (url: string): boolean => {
    return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url.trim())
  }

  const onProgress: CloneProgressCallback = (progress) => {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 10
    setCloneProgress(Math.min(pct, 99))
    setCloneCurrentFile(progress.currentFile)
    setCloneStage(progress.stage)
    setCloneFileCount({ current: progress.current, total: progress.total })
  }

  const handleCloneByUrl = async () => {
    const url = repoUrl.trim()
    if (!validateUrl(url)) {
      toast({ title: 'Invalid URL', description: 'Enter a valid GitHub repo URL like https://github.com/owner/repo', variant: 'destructive' })
      return
    }

    setStep('cloning')
    setCloneProgress(0)
    setCloneError(null)
    setCloneCurrentFile('')
    setCloneStage('Starting...')

    try {
      const result = await cloneRepoToWorkspace({
        repoUrl: url,
        workspaceId,
        onProgress,
      })
      setCloneResult(result)
      setCloneProgress(100)
      setCloneStage('Complete')
      setStep('done')
      onCloneComplete?.(result)
    } catch (e: any) {
      setCloneError(e.message)
      setStep('done')
    }
  }

  const handleCloneByRepo = async (repo: GitHubRepo) => {
    setStep('cloning')
    setCloneProgress(0)
    setCloneError(null)
    setCloneCurrentFile('')
    setCloneStage('Starting...')

    try {
      const result = await cloneRepoToWorkspace({
        repoUrl: repo.html_url,
        workspaceId,
        onProgress,
      })
      setCloneResult(result)
      setCloneProgress(100)
      setCloneStage('Complete')
      setStep('done')
      onCloneComplete?.(result)
    } catch (e: any) {
      setCloneError(e.message)
      setStep('done')
    }
  }

  const handleDisconnect = async (conn: GitHubConnection) => {
    try {
      await disconnectGitHub(conn.id)
      setConnections(prev => prev.filter(c => c.id !== conn.id))
      toast({ title: 'Disconnected', description: `GitHub account ${conn.github_username} disconnected` })
    } catch (e: any) {
      toast({ title: 'Failed to disconnect', description: e.message, variant: 'destructive' })
    }
  }

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  )

  const handleClose = () => {
    if (step === 'cloning') return
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Clone from GitHub
          </DialogTitle>
          <DialogDescription>
            {step === 'select-source' && 'Enter a repo URL or select from your connected GitHub account'}
            {step === 'enter-url' && 'Paste a GitHub repository URL'}
            {step === 'select-repo' && 'Select a repository to clone'}
            {step === 'cloning' && 'Cloning repository...'}
            {step === 'done' && cloneResult ? 'Clone complete' : 'Clone failed'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select-source' && (
          <div className="space-y-4 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14 text-left"
              onClick={() => setStep('enter-url')}
            >
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Enter Repository URL</span>
                <span className="text-xs text-muted-foreground">Paste any public GitHub repo URL</span>
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {connections.length > 0 ? (
              <div className="space-y-3">
                {connections.map(conn => (
                  <div key={conn.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Github className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conn.github_username}</p>
                      <p className="text-xs text-muted-foreground truncate">Connected · {conn.scope || 'public repos'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleLoadRepos} disabled={reposLoading}>
                      {reposLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                      Select Repo
                    </Button>
                    <button onClick={() => handleDisconnect(conn)} className="text-muted-foreground hover:text-destructive p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Button
                className="w-full justify-center gap-2"
                onClick={handleConnectGitHub}
              >
                <Github className="w-5 h-5" />
                Connect GitHub Account
              </Button>
            )}
          </div>
        )}

        {step === 'enter-url' && (
          <div className="space-y-4 py-2">
            <Input
              placeholder="https://github.com/owner/repository"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onPaste={handleURLPaste}
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Supports any public GitHub repository. For private repos, connect your GitHub account first.
            </p>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('select-source')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleCloneByUrl} disabled={!validateUrl(repoUrl)}>
                Clone Repository
              </Button>
            </div>
          </div>
        )}

        {step === 'select-repo' && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredRepos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No repos found</p>
              ) : (
                filteredRepos.map(repo => (
                  <button
                    key={repo.id}
                    onClick={() => handleCloneByRepo(repo)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{repo.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {repo.private ? 'Private' : 'Public'} · {repo.default_branch}
                        {repo.description ? ` · ${repo.description}` : ''}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('select-source')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        )}

        {step === 'cloning' && (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {cloneStage || 'Downloading, encrypting, and uploading repository files...'}
            </p>
            {cloneCurrentFile && (
              <p className="text-xs text-muted-foreground truncate max-w-full px-4">
                {cloneCurrentFile}
              </p>
            )}
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${cloneProgress}%` }}
              />
            </div>
            {cloneFileCount.total > 0 && (
              <p className="text-xs text-muted-foreground">
                {cloneFileCount.current} / {cloneFileCount.total} files
              </p>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 py-2">
            {cloneResult ? (
              <div className="flex flex-col items-center gap-3 text-center py-2">
                <Check className="w-10 h-10 text-green-500" />
                <div>
                  <p className="font-medium">{cloneResult.repository}</p>
                  <p className="text-sm text-muted-foreground">
                    {cloneResult.filesCreated} file{cloneResult.filesCreated !== 1 ? 's' : ''} uploaded
                    {cloneResult.foldersCreated > 0 && ` in ${cloneResult.foldersCreated} folder${cloneResult.foldersCreated !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center py-2">
                <X className="w-10 h-10 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Clone failed</p>
                  <p className="text-sm text-muted-foreground">{cloneError}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GitHubRepoCloneDialog
