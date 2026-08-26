export { renderMascot, renderBrandedMascot } from './mascot.js'
export { brand, brandDim, brandLine, success, error, warn, info, muted, copied, BRAND_MARKER, SUCCESS_MARK, ERROR_MARK, WARN_MARK, INFO_MARK, PROGRESS_MARK } from './brand.js'
export { setJsonMode, isJsonMode, log, logSuccess, logError, logWarn, logInfo, logBrand, logRaw, logJSON, logErrorJSON, writeAudit } from './logger.js'
export { createSpinner } from './spinner.js'
export { createTable, renderTable, renderCompactTable } from './table.js'

export function isCI() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  )
}
