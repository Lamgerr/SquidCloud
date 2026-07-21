import type { CellData, Sheet, SelectionRange } from './types'
import { cellRef } from './types'

export interface ClipboardData {
  cells: { value: string | number | boolean | null; formula?: string; style?: any }[][]
  rows: number
  cols: number
}

export function copyRange(sheet: Sheet, range: SelectionRange): ClipboardData {
  const cells: any[][] = []
  for (let r = range.startRow; r <= range.endRow; r++) {
    const row: any[] = []
    for (let c = range.startCol; c <= range.endCol; c++) {
      const ref = cellRef(r, c)
      const cell = sheet.data.get(ref)
      row.push({
        value: cell?.value ?? null,
        formula: cell?.formula,
        style: cell?.style ? { ...cell.style } : undefined,
      })
    }
    cells.push(row)
  }
  return {
    cells,
    rows: range.endRow - range.startRow + 1,
    cols: range.endCol - range.startCol + 1,
  }
}

export function pasteRange(sheet: Sheet, data: ClipboardData, destRow: number, destCol: number, pasteType: 'all' | 'values' | 'formats' | 'formulas' = 'all'): void {
  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const ref = cellRef(destRow + r, destCol + c)
      const src = data.cells[r][c]
      const existing = sheet.data.get(ref)
      if (pasteType === 'all' || pasteType === 'values') {
        const newCell: CellData = {
          value: src.value,
          formula: pasteType === 'all' ? src.formula : undefined,
          type: src.formula ? 'formula' : typeof src.value === 'number' ? 'number' : typeof src.value === 'boolean' ? 'boolean' : 'text',
          style: existing?.style,
        }
        if (pasteType === 'formulas' && src.formula) {
          newCell.formula = src.formula
          newCell.type = 'formula'
        }
        sheet.data.set(ref, newCell)
      }
      if ((pasteType === 'all' || pasteType === 'formats') && src.style) {
        if (existing) {
          existing.style = { ...existing.style, ...src.style }
          sheet.data.set(ref, existing)
        } else {
          sheet.data.set(ref, {
            value: null,
            type: 'text',
            style: src.style,
          })
        }
      }
    }
  }
}
