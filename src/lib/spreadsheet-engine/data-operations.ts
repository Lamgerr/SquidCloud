import type { Sheet, CellData, SelectionRange } from './types'
import { cellRef, parseCellRef } from './types'

export function sortRange(sheet: Sheet, range: SelectionRange, col: number, direction: 'asc' | 'desc'): void {
  const rows: { index: number; values: any[] }[] = []
  for (let r = range.startRow; r <= range.endRow; r++) {
    const values: any[] = []
    for (let c = range.startCol; c <= range.endCol; c++) {
      const cell = sheet.data.get(cellRef(r, c))
      values.push(cell?.value ?? null)
    }
    rows.push({ index: r, values })
  }

  const sortColIdx = col - range.startCol
  rows.sort((a, b) => {
    const va = a.values[sortColIdx]
    const vb = b.values[sortColIdx]
    if (va === null || va === '') return 1
    if (vb === null || vb === '') return -1
    if (typeof va === 'number' && typeof vb === 'number') {
      return direction === 'asc' ? va - vb : vb - va
    }
    const cmp = String(va).localeCompare(String(vb))
    return direction === 'asc' ? cmp : -cmp
  })

  const newData = new Map<string, CellData>()
  for (let r = 0; r < rows.length; r++) {
    const srcR = rows[r].index
    const dstR = range.startRow + r
    for (let c = range.startCol; c <= range.endCol; c++) {
      const srcRef = cellRef(srcR, c)
      const dstRef = cellRef(dstR, c)
      const cell = sheet.data.get(srcRef)
      if (cell) newData.set(dstRef, { ...cell })
      else newData.delete(dstRef)
    }
  }
  for (const [ref, cell] of newData) sheet.data.set(ref, cell)
}

export function removeDuplicates(sheet: Sheet, range: SelectionRange): void {
  const seen = new Set<string>()
  const toDelete: string[] = []
  for (let r = range.startRow; r <= range.endRow; r++) {
    let key = ''
    for (let c = range.startCol; c <= range.endCol; c++) {
      const cell = sheet.data.get(cellRef(r, c))
      key += `|${cell?.value ?? ''}`
    }
    if (seen.has(key)) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        toDelete.push(cellRef(r, c))
      }
    } else {
      seen.add(key)
    }
  }
  for (const ref of toDelete) sheet.data.delete(ref)
}

export function applyFilter(sheet: Sheet, col: number, criteria: (value: any) => boolean): Map<number, boolean> {
  const visibleRows = new Map<number, boolean>()
  let maxRow = 0
  for (const ref of sheet.data.keys()) {
    const [r] = parseCellRef(ref) || [0, 0]
    if (r > maxRow) maxRow = r
  }
  for (let r = 0; r <= maxRow; r++) {
    const cell = sheet.data.get(cellRef(r, col))
    visibleRows.set(r, criteria(cell?.value ?? null))
  }
  return visibleRows
}

export function textToColumns(sheet: Sheet, range: SelectionRange, delimiter: string = ','): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    const ref = cellRef(r, range.startCol)
    const cell = sheet.data.get(ref)
    if (cell && typeof cell.value === 'string') {
      const parts = cell.value.split(delimiter)
      for (let c = 0; c < parts.length; c++) {
        const col = range.startCol + c
        if (col <= range.endCol) {
          const val = parts[c].trim()
          sheet.data.set(cellRef(r, col), {
            value: val,
            type: isNaN(Number(val)) ? 'text' : 'number',
          })
        }
      }
    }
  }
}

export function transpose(data: (string | number | boolean | null)[][]): (string | number | boolean | null)[][] {
  if (data.length === 0) return []
  const rows = data.length
  const cols = data[0].length
  const result: (string | number | boolean | null)[][] = []
  for (let c = 0; c < cols; c++) {
    result[c] = []
    for (let r = 0; r < rows; r++) {
      result[c][r] = data[r]?.[c] ?? null
    }
  }
  return result
}

export function buildPivotTable(
  data: (string | number | boolean | null)[][],
  rows: number[],
  columns: number[],
  values: { col: number; aggregation: 'sum' | 'count' | 'average' | 'min' | 'max' }[],
): (string | number | boolean | null)[][] {
  if (data.length < 2) return []
  const headers = data[0]
  const records = data.slice(1)

  const pivot: Map<string, Map<string, number[]>> = new Map()
  const rowHeaders = new Set<string>()
  const colHeaders = new Set<string>()

  for (const record of records) {
    const rowKey = rows.map(r => String(record[r] ?? '')).join('||')
    const colKey = columns.map(c => String(record[c] ?? '')).join('||')
    rowHeaders.add(rowKey)
    colHeaders.add(colKey)

    if (!pivot.has(rowKey)) pivot.set(rowKey, new Map())
    const rowMap = pivot.get(rowKey)!
    if (!rowMap.has(colKey)) rowMap.set(colKey, [])
    values.forEach(v => {
      const val = Number(record[v.col] ?? 0)
      rowMap.get(colKey)!.push(val)
    })
  }

  const sortedRows = Array.from(rowHeaders).sort()
  const sortedCols = Array.from(colHeaders).sort()
  const result: (string | number | boolean | null)[][] = []

  // Header row
  const headerRow: string[] = [...rows.map(i => String(headers[i] ?? '')), ...sortedCols]
  result.push(headerRow)

  // Data rows
  for (const rowKey of sortedRows) {
    const row: (string | number | boolean | null)[] = []
    const parts = rowKey.split('||')
    rows.forEach((_, i) => row.push(parts[i] || ''))
    for (const colKey of sortedCols) {
      const vals = pivot.get(rowKey)?.get(colKey) || []
      const aggResult = values[0] ? aggregate(vals, values[0].aggregation) : vals.length
      row.push(aggResult)
    }
    result.push(row)
  }

  return result
}

function aggregate(vals: number[], type: string): number {
  if (vals.length === 0) return 0
  switch (type) {
    case 'sum': return vals.reduce((a, b) => a + b, 0)
    case 'count': return vals.length
    case 'average': return vals.reduce((a, b) => a + b, 0) / vals.length
    case 'min': return Math.min(...vals)
    case 'max': return Math.max(...vals)
    default: return vals.length
  }
}
