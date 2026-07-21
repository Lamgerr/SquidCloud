import React from 'react'
import type { SelectionRange } from '@/lib/spreadsheet-engine/types'
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '@/lib/spreadsheet-engine/types'

interface SelectionOverlayProps {
  ranges: SelectionRange[]
  freezePane: { row: number; col: number }
  totalRows: number
  totalCols: number
  columnWidths: Map<number, number>
  rowHeights: Map<number, number>
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  ranges, freezePane, totalRows, totalCols, columnWidths, rowHeights,
}) => {
  const getColOffset = (col: number): number => {
    let offset = 0
    for (let i = 0; i < col; i++) offset += columnWidths.get(i) || DEFAULT_COL_WIDTH
    return offset
  }

  const getRowOffset = (row: number): number => {
    let offset = 0
    for (let i = 0; i < row; i++) offset += rowHeights.get(i) || DEFAULT_ROW_HEIGHT
    return offset
  }

  return (
    <>
      {(ranges || []).map((range, idx) => {
        const x = getColOffset(range.startCol)
        const y = getRowOffset(range.startRow)
        const w = getColOffset(range.endCol + 1) - x
        const h = getRowOffset(range.endRow + 1) - y

        return (
          <div
            key={idx}
            className="absolute pointer-events-none border-2 border-primary/60 z-5"
            style={{
              left: x,
              top: y + DEFAULT_ROW_HEIGHT,
              width: w,
              height: h,
            }}
          >
            {/* Fill handle */}
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-sm cursor-crosshair z-10 pointer-events-auto" />
          </div>
        )
      })}
    </>
  )
}

export default SelectionOverlay
