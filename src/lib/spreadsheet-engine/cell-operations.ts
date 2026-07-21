import type {
  Sheet, CellData, CellStyle, CellMap, SelectionRange,
  MergeCell,
} from './types'
import { cellRef, parseCellRef, cloneCellData, getMergedCell, DEFAULT_ROW_HEIGHT, DEFAULT_COL_WIDTH } from './types'

export function setCellValue(sheet: Sheet, ref: string, value: string | number | boolean | null, formula?: string): boolean {
  const cell = sheet.data.get(ref) || { value: null, type: 'text' as const }
  cell.value = value
  cell.formula = formula
  cell.type = formula ? 'formula' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text'
  sheet.data.set(ref, cell)
  return true
}

export function setCellStyle(sheet: Sheet, ref: string, style: Partial<CellStyle>): boolean {
  const cell = sheet.data.get(ref)
  if (cell) {
    cell.style = { ...(cell.style || {}), ...style }
    sheet.data.set(ref, cell)
  }
  return true
}

export function setRangeValue(sheet: Sheet, range: SelectionRange, value: string | number | boolean | null): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const ref = cellRef(r, c)
      const merged = getMergedCell(r, c, sheet.merges || [])
      if (merged && (r !== merged.startRow || c !== merged.startCol)) continue
      setCellValue(sheet, ref, value)
    }
  }
}

export function setRangeFormula(sheet: Sheet, range: SelectionRange, formula: string): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const ref = cellRef(r, c)
      setCellValue(sheet, ref, null, formula.replace(/\$ROW/g, String(r + 1)).replace(/\$COL/g, String(c + 1)))
    }
  }
}

export function setRangeStyle(sheet: Sheet, range: SelectionRange, style: Partial<CellStyle>): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      setCellStyle(sheet, cellRef(r, c), style)
    }
  }
}

export function clearRange(sheet: Sheet, range: SelectionRange): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const ref = cellRef(r, c)
      sheet.data.delete(ref)
    }
  }
}

export function clearFormats(sheet: Sheet, range: SelectionRange): void {
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const cell = sheet.data.get(cellRef(r, c))
      if (cell) {
        cell.style = undefined
        sheet.data.set(cellRef(r, c), cell)
      }
    }
  }
}

export function insertRow(sheet: Sheet, row: number, count: number = 1): void {
  const newData: CellMap = new Map()
  for (const [ref, cell] of sheet.data) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    const newRef = cellRef(r >= row ? r + count : r, c)
    newData.set(newRef, cloneCellData(cell))
  }
  sheet.data = newData

  // shift row heights
  const newHeights = new Map<number, number>()
  for (const [r, h] of sheet.rowHeights) newHeights.set(r >= row ? r + count : r, h)
  sheet.rowHeights = newHeights

  // shift merges
  if (sheet.merges) sheet.merges = sheet.merges.map(m => {
    if (m.startRow >= row) return { ...m, startRow: m.startRow + count, endRow: m.endRow + count }
    if (m.endRow >= row) return { ...m, endRow: m.endRow + count }
    return m
  })

  // shift filter
  if (sheet.filter && sheet.filter.startRow >= row) {
    sheet.filter = { ...sheet.filter, startRow: sheet.filter.startRow + count, endRow: sheet.filter.endRow + count }
  }
}

export function insertCol(sheet: Sheet, col: number, count: number = 1): void {
  const newData: CellMap = new Map()
  for (const [ref, cell] of sheet.data) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    const newRef = cellRef(r, c >= col ? c + count : c)
    newData.set(newRef, cloneCellData(cell))
  }
  sheet.data = newData

  const newWidths = new Map<number, number>()
  for (const [c, w] of sheet.colWidths) newWidths.set(c >= col ? c + count : c, w)
  sheet.colWidths = newWidths

  if (sheet.merges) sheet.merges = sheet.merges.map(m => {
    if (m.startCol >= col) return { ...m, startCol: m.startCol + count, endCol: m.endCol + count }
    if (m.endCol >= col) return { ...m, endCol: m.endCol + count }
    return m
  })

  if (sheet.filter && sheet.filter.startCol >= col) {
    sheet.filter = { ...sheet.filter, startCol: sheet.filter.startCol + count, endCol: sheet.filter.endCol + count }
  }
}

export function deleteRow(sheet: Sheet, row: number, count: number = 1): void {
  const newData: CellMap = new Map()
  for (const [ref, cell] of sheet.data) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    if (r >= row && r < row + count) continue
    const newRef = cellRef(r > row ? r - count : r, c)
    newData.set(newRef, cloneCellData(cell))
  }
  sheet.data = newData

  const newHeights = new Map<number, number>()
  for (const [r, h] of sheet.rowHeights) {
    if (r >= row && r < row + count) continue
    newHeights.set(r > row ? r - count : r, h)
  }
  sheet.rowHeights = newHeights

  if (sheet.merges) sheet.merges = sheet.merges
    .filter(m => !(m.startRow >= row && m.endRow < row + count))
    .map(m => {
      if (m.startRow >= row + count) return { ...m, startRow: m.startRow - count, endRow: m.endRow - count }
      if (m.endRow >= row) return { ...m, endRow: Math.max(row - 1, m.endRow - count) }
      return m
    })
    .filter(m => m.startRow <= m.endRow)

  if (sheet.filter) {
    sheet.filter = {
      ...sheet.filter,
      endRow: sheet.filter.endRow - count,
    }
  }
}

export function deleteCol(sheet: Sheet, col: number, count: number = 1): void {
  const newData: CellMap = new Map()
  for (const [ref, cell] of sheet.data) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    if (c >= col && c < col + count) continue
    const newRef = cellRef(r, c > col ? c - count : c)
    newData.set(newRef, cloneCellData(cell))
  }
  sheet.data = newData

  const newWidths = new Map<number, number>()
  for (const [c, w] of sheet.colWidths) {
    if (c >= col && c < col + count) continue
    newWidths.set(c > col ? c - count : c, w)
  }
  sheet.colWidths = newWidths

  if (sheet.merges) sheet.merges = sheet.merges
    .filter(m => !(m.startCol >= col && m.endCol < col + count))
    .map(m => {
      if (m.startCol >= col + count) return { ...m, startCol: m.startCol - count, endCol: m.endCol - count }
      if (m.endCol >= col) return { ...m, endCol: Math.max(col - 1, m.endCol - count) }
      return m
    })
    .filter(m => m.startCol <= m.endCol)
}

export function mergeCells(sheet: Sheet, range: SelectionRange): void {
  if (!sheet.merges) sheet.merges = []
  for (const existing of sheet.merges) {
    if (doOverlap(existing, range)) return
  }
  sheet.merges.push({
    startRow: range.startRow,
    startCol: range.startCol,
    endRow: range.endRow,
    endCol: range.endCol,
  })
}

export function unmergeCells(sheet: Sheet, range: SelectionRange): void {
  if (sheet.merges) sheet.merges = sheet.merges.filter(m => !doOverlap(m, range))
}

function doOverlap(a: MergeCell, b: SelectionRange): boolean {
  return !(a.endRow < b.startRow || a.startRow > b.endRow || a.endCol < b.startCol || a.startCol > b.endCol)
}

export function autoFill(sheet: Sheet, fromRange: SelectionRange, toRange: SelectionRange): void {
  const fromData: { ref: string; cell: CellData }[] = []
  for (let r = fromRange.startRow; r <= fromRange.endRow; r++) {
    for (let c = fromRange.startCol; c <= fromRange.endCol; c++) {
      const ref = cellRef(r, c)
      const cell = sheet.data.get(ref)
      if (cell) fromData.push({ ref, cell: cloneCellData(cell) })
    }
  }

  const fromRows = fromRange.endRow - fromRange.startRow + 1
  const fromCols = fromRange.endCol - fromRange.startCol + 1
  const toRows = toRange.endRow - toRange.startRow + 1
  const toCols = toRange.endCol - toRange.startCol + 1

  for (let r = 0; r < toRows; r++) {
    for (let c = 0; c < toCols; c++) {
      const srcR = fromRange.startRow + (r % fromRows)
      const srcC = fromRange.startCol + (c % fromCols)
      const srcRef = cellRef(srcR, srcC)
      const srcCell = sheet.data.get(srcRef)
      const dstRef = cellRef(toRange.startRow + r, toRange.startCol + c)
      if (srcCell) {
        const cloned = cloneCellData(srcCell)
        if (cloned.formula) {
          cloned.formula = adjustFormulaRefs(cloned.formula, fromRange.startRow, fromRange.startCol, toRange.startRow + r, toRange.startCol + c)
        }
        sheet.data.set(dstRef, cloned)
      } else {
        sheet.data.delete(dstRef)
      }
    }
  }
}

function adjustFormulaRefs(formula: string, fromR: number, fromC: number, toR: number, toC: number): string {
  const rowDiff = toR - fromR
  const colDiff = toC - fromC
  return formula.replace(/([A-Z]+)(\d+)/g, (match, cols, rows) => {
    let c = 0
    for (let i = 0; i < cols.length; i++) c = c * 26 + (cols.charCodeAt(i) - 64)
    c -= 1
    return cellRef(parseInt(rows) - 1 + rowDiff, c + colDiff)
  })
}

export function getCellDisplayValue(ref: string, sheet: Sheet): string {
  const cell = sheet.data.get(ref)
  if (!cell) return ''
  if (cell.type === 'formula' && cell.formula) {
    const { evaluateFormula } = require('./formula-engine')
    const v = evaluateFormula(cell.formula, sheet.data, ref)
    return v !== null && v !== undefined ? String(v) : ''
  }
  return cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
}

export function getColumnMaxValue(sheet: Sheet, col: number): number {
  let max = 0
  for (const [ref, cell] of sheet.data) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    if (c === col && typeof cell.value === 'number') max = Math.max(max, cell.value)
  }
  return max
}

export function renameSheet(sheet: Sheet, newName: string): void {
  sheet.name = newName
}
