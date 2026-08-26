export function isCI() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_HOME
  )
}

export function isInteractive() {
  if (isCI()) return false
  return process.stdout.isTTY && process.stdin.isTTY
}

export function getCIProvider() {
  if (process.env.GITHUB_ACTIONS) return 'github-actions'
  if (process.env.GITLAB_CI) return 'gitlab-ci'
  if (process.env.CIRCLECI) return 'circleci'
  if (process.env.TRAVIS) return 'travis'
  if (process.env.JENKINS_HOME) return 'jenkins'
  if (process.env.CI) return 'unknown-ci'
  return null
}
