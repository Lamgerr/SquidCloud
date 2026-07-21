import type { Sheet, Macro, MacroOperation, CellData } from './types'
import { cellRef } from './types'

export function recordOperation(op: MacroOperation): MacroOperation {
  return op
}

export function executeMacro(sheet: Sheet, macro: Macro): void {
  for (const op of macro.operations) {
    switch (op.type) {
      case 'setCell':
        sheet.data.set(op.ref, {
          value: op.value,
          formula: op.formula,
          type: op.formula ? 'formula' : typeof op.value === 'number' ? 'number' : 'text',
        })
        break
      case 'setStyle': {
        const cell = sheet.data.get(op.ref)
        if (cell) {
          cell.style = { ...(cell.style || {}), ...op.style }
          sheet.data.set(op.ref, cell)
        }
        break
      }
      case 'insertRow':
        insertRowInternal(sheet, op.row, op.count)
        break
      case 'insertCol':
        insertColInternal(sheet, op.col, op.count)
        break
      case 'deleteRow':
        deleteRowInternal(sheet, op.row, op.count)
        break
      case 'deleteCol':
        deleteColInternal(sheet, op.col, op.count)
        break
    }
  }
}

function insertRowInternal(sheet: Sheet, row: number, count: number): void {
  const newData = new Map<string, CellData>()
  for (const [ref, cell] of sheet.data) {
    const m = ref.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    const r = parseInt(m[2]) - 1
    const newR = r >= row ? r + count : r
    newData.set(cellRef(newR, getColFromRef(ref)), cell)
  }
  sheet.data = newData
}

function insertColInternal(sheet: Sheet, col: number, count: number): void {
  const newData = new Map<string, CellData>()
  for (const [ref, cell] of sheet.data) {
    const c = getColFromRef(ref)
    const r = parseInt(ref.match(/\d+/)?.[0] || '1') - 1
    const newC = c >= col ? c + count : c
    newData.set(cellRef(r, newC), cell)
  }
  sheet.data = newData
}

function deleteRowInternal(sheet: Sheet, row: number, count: number): void {
  const newData = new Map<string, CellData>()
  for (const [ref, cell] of sheet.data) {
    const m = ref.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    const r = parseInt(m[2]) - 1
    if (r >= row && r < row + count) continue
    const newR = r > row ? r - count : r
    newData.set(cellRef(newR, getColFromRef(ref)), cell)
  }
  sheet.data = newData
}

function deleteColInternal(sheet: Sheet, col: number, count: number): void {
  const newData = new Map<string, CellData>()
  for (const [ref, cell] of sheet.data) {
    const c = getColFromRef(ref)
    if (c >= col && c < col + count) continue
    const r = parseInt(ref.match(/\d+/)?.[0] || '1') - 1
    const newC = c > col ? c - count : c
    newData.set(cellRef(r, newC), cell)
  }
  sheet.data = newData
}

function getColFromRef(ref: string): number {
  const m = ref.match(/^([A-Z]+)/)
  if (!m) return 0
  let col = 0
  for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64)
  return col - 1
}

export function createMacro(name: string, operations: MacroOperation[], options?: { shortcut?: string; description?: string }): Macro {
  return { name, operations, ...options }
}

export function macroToJSON(macro: Macro): string {
  return JSON.stringify(macro, null, 2)
}

export function macroFromJSON(json: string): Macro {
  return JSON.parse(json)
}
