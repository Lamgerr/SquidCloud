import { exec } from 'node:child_process'

/** Open a URL in the platform default browser. Never throws. */
export function openBrowser(url) {
  const cmds = {
    darwin: `open "${url}"`,
    win32: `start "" "${url}"`,
    linux: `xdg-open "${url}"`,
  }
  const cmd = cmds[process.platform] || `xdg-open "${url}"`
  try {
    exec(cmd, () => {})
  } catch (e) {
    /* user gets the printed URL instead */
  }
}
