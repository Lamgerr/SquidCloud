import React, { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import CellRenderer from './CellRenderer'
import ColumnHeader from './ColumnHeader'
import RowHeader from './RowHeader'
import SelectionOverlay from './SelectionOverlay'
import type { Sheet, Selection, MergeCell } from '@/lib/spreadsheet-engine/types'
import { getMergedCell, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, cellRef } from '@/lib/spreadsheet-engine/types'
import { evaluateFormula } from '@/lib/spreadsheet-engine/formula-engine'
import { cn } from '@/lib/utils'

interface SpreadsheetGridProps {
  sheet: Sheet
  selection: Selection
  showGridLines: boolean
  freezePane: { row: number; col: number }
  onSelectionChange: (selection: Selection) => void
  onCellValueChange: (ref: string, value: string | number | boolean | null, formula?: string) => void
  onCellStyleChange: (ref: string, style: any) => void
  onStartEdit: (ref: string, value: string) => void
  onEndEdit: () => void
  onEditValueChange: (value: string) => void
}

const TOTAL_ROWS = 1_000
const TOTAL_COLS = 26

function colLetter(col: number): string {
  let s = ''
  let n = col
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  sheet, selection, showGridLines, freezePane,
  onSelectionChange, onCellValueChange, onCellStyleChange,
  onStartEdit, onEndEdit, onEditValueChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: TOTAL_ROWS,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => sheet.rowHeights.get(i) || DEFAULT_ROW_HEIGHT,
    overscan: 10,
  })

  const colVirtualizer = useVirtualizer({
    count: TOTAL_COLS,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => sheet.colWidths.get(i) || DEFAULT_COL_WIDTH,
    overscan: 5,
    horizontal: true,
  })

  const handleCellClick = useCallback((row: number, col: number) => {
    onSelectionChange({
      type: 'cell',
      activeCell: cellRef(row, col),
      ranges: [{ startRow: row, startCol: col, endRow: row, endCol: col }],
    })
  }, [onSelectionChange])

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    const ref = cellRef(row, col)
    const cell = sheet.data.get(ref)
    onStartEdit(ref, cell?.formula ? cell.formula : (cell?.value != null ? String(cell.value) : ''))
  }, [sheet.data, onStartEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const activeR = selection.ranges[0]?.startRow ?? 0
    const activeC = selection.ranges[0]?.startCol ?? 0
    let newR = activeR, newC = activeC

    if (e.key === 'ArrowUp') { newR = Math.max(0, activeR - 1); e.preventDefault() }
    else if (e.key === 'ArrowDown') { newR = Math.min(TOTAL_ROWS - 1, activeR + 1); e.preventDefault() }
    else if (e.key === 'ArrowLeft') { newC = Math.max(0, activeC - 1); e.preventDefault() }
    else if (e.key === 'ArrowRight') { newC = Math.min(TOTAL_COLS - 1, activeC + 1); e.preventDefault() }
    else if (e.key === 'Tab') {
      newC = e.shiftKey ? Math.max(0, activeC - 1) : Math.min(TOTAL_COLS - 1, activeC + 1)
      if (e.shiftKey && newC === 0 && activeC === 0) { newR = Math.max(0, activeR - 1); newC = TOTAL_COLS - 1 }
      else if (!e.shiftKey && newC === 0 && activeC >= TOTAL_COLS - 1) { newR = Math.min(TOTAL_ROWS - 1, activeR + 1) }
      e.preventDefault()
    }
    else if (e.key === 'Enter') { newR = Math.min(TOTAL_ROWS - 1, activeR + 1); e.preventDefault() }
    else if (e.key === 'Home' && e.ctrlKey) { newR = 0; newC = 0; e.preventDefault() }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      onCellValueChange(cellRef(activeR, activeC), null)
      e.preventDefault()
    }
    else if (e.key === 'F2') {
      const ref = cellRef(activeR, activeC)
      const cell = sheet.data.get(ref)
      onStartEdit(ref, cell?.formula ? cell.formula : (cell?.value != null ? String(cell.value) : ''))
      e.preventDefault()
    }

    if (newR !== activeR || newC !== activeC) {
      onSelectionChange({
        type: 'cell',
        activeCell: cellRef(newR, newC),
        ranges: [{ startRow: newR, startCol: newC, endRow: newR, endCol: newC }],
      })
      rowVirtualizer.scrollToIndex(newR, { align: 'auto' })
      colVirtualizer.scrollToIndex(newC, { align: 'auto' })
    }
  }, [selection, sheet.data, onSelectionChange, onCellValueChange, onStartEdit, rowVirtualizer, colVirtualizer])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    const cellEl = target.closest('[data-row]') as HTMLElement
    if (!cellEl) return
    const row = parseInt(cellEl.dataset.row || '0')
    const col = parseInt(cellEl.dataset.col || '0')
    handleCellClick(row, col)

    const handleMouseMove = (ev: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = ev.clientX - rect.left + container.scrollLeft
      const y = ev.clientY - rect.top + container.scrollTop
      let c = 0, w = 0
      while (w < x && c < TOTAL_COLS) { w += (sheet.colWidths.get(c) || DEFAULT_COL_WIDTH); c++ }
      let r = 0, h = 0
      while (h < y && r < TOTAL_ROWS) { h += (sheet.rowHeights.get(r) || DEFAULT_ROW_HEIGHT); r++ }
      c = Math.max(0, Math.min(TOTAL_COLS - 1, c - 1))
      r = Math.max(0, Math.min(TOTAL_ROWS - 1, r - 1))
      onSelectionChange({
        type: 'range',
        activeCell: cellRef(Math.min(row, r), Math.min(col, c)),
        ranges: [{ startRow: Math.min(row, r), startCol: Math.min(col, c), endRow: Math.max(row, r), endCol: Math.max(col, c) }],
      })
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [handleCellClick, sheet.colWidths, sheet.rowHeights, onSelectionChange])

  const rowItems = rowVirtualizer.getVirtualItems()
  const totalRowsHeight = rowVirtualizer.getTotalSize()
  const colItems = colVirtualizer.getVirtualItems()
  const totalColsWidth = colVirtualizer.getTotalSize()

  const HEADER_H = 28

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#09090b] relative"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      style={{ outline: 'none' }}
    >
      <div style={{ width: totalColsWidth, height: totalRowsHeight + HEADER_H, position: 'relative' }}>
        <div className="sticky top-0 z-20 flex" style={{ height: HEADER_H }}>
          <div className="sticky left-0 z-30 bg-[#111113] border-r border-b border-white/[0.06] flex items-center justify-center text-[11px] text-zinc-600 select-none"
               style={{ width: 40, height: HEADER_H }}>
          </div>
          {colItems.map(colItem => (
            <ColumnHeader
              key={colItem.key}
              col={colItem.index}
              width={colItem.size}
              height={HEADER_H}
              isSelected={selection.ranges.some(r => r.startCol <= colItem.index && r.endCol >= colItem.index)}
            />
          ))}
        </div>

        {rowItems.map(rowItem => (
          <div
            key={rowItem.key}
            className="flex"
            style={{ position: 'absolute', top: rowItem.start + HEADER_H, left: 0, height: rowItem.size }}
          >
            <RowHeader
              row={rowItem.index}
              height={rowItem.size}
              isSelected={selection.ranges.some(r => r.startRow <= rowItem.index && r.endRow >= rowItem.index)}
            />
            <div className="flex">
              {colItems.map(colItem => {
                const ref = cellRef(rowItem.index, colItem.index)
                const cell = sheet.data.get(ref)
                const merge = getMergedCell(rowItem.index, colItem.index, sheet.merges || [])
                const isInRange = selection.ranges.some(r =>
                  rowItem.index >= r.startRow && rowItem.index <= r.endRow &&
                  colItem.index >= r.startCol && colItem.index <= r.endCol
                )
                const isSelected = selection.ranges.length > 0 && isInRange &&
                  rowItem.index === selection.ranges[0].startRow &&
                  colItem.index === selection.ranges[0].startCol
                const isEditing = selection.editing && selection.activeCell === ref

                if (merge && (rowItem.index !== merge.startRow || colItem.index !== merge.startCol)) {
                  return null
                }

                return (
                  <div
                    key={colItem.key}
                    data-row={rowItem.index}
                    data-col={colItem.index}
                    className="relative shrink-0"
                    style={{
                      width: colItem.size,
                      height: merge
                        ? (merge.endRow - merge.startRow + 1) * (sheet.rowHeights.get(rowItem.index) || DEFAULT_ROW_HEIGHT)
                        : rowItem.size,
                    }}
                  >
                    <CellRenderer
                      row={rowItem.index}
                      col={colItem.index}
                      cell={cell}
                      isSelected={isSelected}
                      isInRange={isInRange}
                      isEditing={isEditing}
                      editValue={selection.editValue || ''}
                      style={cell?.style}
                      columnWidth={colItem.size}
                      rowHeight={rowItem.size}
                      mergeCell={merge}
                      showGridLines={showGridLines}
                      onCellClick={handleCellClick}
                      onCellDoubleClick={handleCellDoubleClick}
                      onCellDragStart={() => {}}
                      onEditValueChange={onEditValueChange}
                      onEditKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') onEndEdit()
                      }}
                      onEditBlur={onEndEdit}
                      data={sheet.data}
                      formulaEngine={evaluateFormula}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <SelectionOverlay
          ranges={selection.ranges}
          freezePane={freezePane}
          totalRows={TOTAL_ROWS}
          totalCols={TOTAL_COLS}
          columnWidths={sheet.colWidths}
          rowHeights={sheet.rowHeights}
        />
      </div>
    </div>
  )
}

export default SpreadsheetGrid
