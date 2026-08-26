 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import Table from 'cli-table3'
import chalk from 'chalk'

import { isJsonMode, logJSON } from './logger.js'















export function createTable(headers, options = {}) {
  return new Table({
    head: headers.map(h => chalk.bold(h)),
    colAligns: options.colAligns,
    style: {
      head: [],
      border: [],
      'padding-left': 1,
      'padding-right': 1,
      ...options.style,
    },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
    ...options.compact ? {
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: '',
      },
      style: { 'padding-left': 0, 'padding-right': 2 },
    } : {},
  })
}

export function renderTable(data, columns) {
  if (isJsonMode()) {
    logJSON(data)
    return ''
  }
  const table = createTable(
    columns.map(c => c.label),
    { colAligns: columns.map(c => _nullishCoalesce(c.align, () => ( 'left'))) }
  )
  for (const row of data) {
    table.push(
      columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : String(_nullishCoalesce(val, () => ( '')))
      })
    )
  }
  return table.toString()
}

export function renderCompactTable(data, columns) {
  if (isJsonMode()) {
    logJSON(data)
    return ''
  }
  const table = createTable(
    columns.map(c => c.label),
    { colAligns: columns.map(c => _nullishCoalesce(c.align, () => ( 'left'))), compact: true }
  )
  for (const row of data) {
    table.push(
      columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : String(_nullishCoalesce(val, () => ( '')))
      })
    )
  }
  return table.toString()
}
