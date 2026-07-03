import Table from 'cli-table3'
import chalk from 'chalk'
import { isCI } from '../utils/ci-detect.js'
import { isJsonMode, logJSON } from './logger.js'

interface ColumnDef {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  format?: (value: unknown) => string
}

interface TableOptions {
  head?: string[]
  colAligns?: ('left' | 'center' | 'right')[]
  style?: Record<string, unknown>
  compact?: boolean
}

export function createTable(headers: string[], options: TableOptions = {}): Table.Table {
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

export function renderTable(data: Record<string, unknown>[], columns: ColumnDef[]): string {
  if (isJsonMode()) {
    logJSON(data)
    return ''
  }
  const table = createTable(
    columns.map(c => c.label),
    { colAligns: columns.map(c => c.align ?? 'left') }
  )
  for (const row of data) {
    table.push(
      columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : String(val ?? '')
      })
    )
  }
  return table.toString()
}

export function renderCompactTable(data: Record<string, unknown>[], columns: ColumnDef[]): string {
  if (isJsonMode()) {
    logJSON(data)
    return ''
  }
  const table = createTable(
    columns.map(c => c.label),
    { colAligns: columns.map(c => c.align ?? 'left'), compact: true }
  )
  for (const row of data) {
    table.push(
      columns.map(c => {
        const val = row[c.key]
        return c.format ? c.format(val) : String(val ?? '')
      })
    )
  }
  return table.toString()
}
