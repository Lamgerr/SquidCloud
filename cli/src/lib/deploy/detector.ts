import fs from 'node:fs'
import path from 'node:path'

export type DeployType = 'single-file' | 'codebase' | 'invalid'

export interface DetectedProject {
  type: DeployType
  rootPath: string
  hasIndexHtml: boolean
  htmlFiles: string[]
  totalFiles: number
}

export async function detectProject(targetPath: string): Promise<DetectedProject> {
  const resolved = path.resolve(targetPath)
  const stat = fs.statSync(resolved)

  if (stat.isFile()) {
    const ext = path.extname(resolved).toLowerCase()
    if (ext === '.html') {
      return {
        type: 'single-file',
        rootPath: resolved,
        hasIndexHtml: true,
        htmlFiles: [resolved],
        totalFiles: 1,
      }
    }
    return { type: 'invalid', rootPath: resolved, hasIndexHtml: false, htmlFiles: [], totalFiles: 0 }
  }

  if (stat.isDirectory()) {
    const htmlFiles: string[] = []
    let totalFiles = 0

    function walk(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath)
          }
        } else if (entry.isFile()) {
          totalFiles++
          if (entry.name.endsWith('.html')) {
            htmlFiles.push(fullPath)
          }
        }
      }
    }

    walk(resolved)

    if (htmlFiles.length === 0) {
      return { type: 'invalid', rootPath: resolved, hasIndexHtml: false, htmlFiles: [], totalFiles }
    }

    const hasIndexHtml = htmlFiles.some(f => path.basename(f).toLowerCase() === 'index.html')

    return {
      type: 'codebase',
      rootPath: resolved,
      hasIndexHtml,
      htmlFiles,
      totalFiles,
    }
  }

  return { type: 'invalid', rootPath: resolved, hasIndexHtml: false, htmlFiles: [], totalFiles: 0 }
}
