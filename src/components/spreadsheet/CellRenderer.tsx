import React, { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { CellData, CellStyle, MergeCell } from '@/lib/spreadsheet-engine/types'
import { getMergedCell, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '@/lib/spreadsheet-engine/types'
import { evaluateFormula } from '@/lib/spreadsheet-engine/formula-engine'

interface CellRendererProps {
  row: number
  col: number
  cell: CellData | undefined
  isSelected: boolean
  isInRange: boolean
  isEditing: boolean
  editValue: string
  style: CellStyle | undefined
  columnWidth: number
  rowHeight: number
  mergeCell: MergeCell | null
  showGridLines: boolean
  onCellClick: (row: number, col: number) => void
  onCellDoubleClick: (row: number, col: number) => void
  onCellDragStart: (row: number, col: number) => void
  onEditValueChange: (value: string) => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onEditBlur: () => void
  data: Map<string, CellData>
  formulaEngine: typeof evaluateFormula
}

const CellRenderer: React.FC<CellRendererProps> = memo(({
  row, col, cell, isSelected, isInRange, isEditing, editValue,
  style, columnWidth, rowHeight, mergeCell, showGridLines,
  onCellClick, onCellDoubleClick, onCellDragStart,
  onEditValueChange, onEditKeyDown, onEditBlur, data, formulaEngine,
}) => {
  const displayValue = useCallback(() => {
    if (!cell) return ''
    if (cell.type === 'formula' && cell.formula) {
      try {
        const v = formulaEngine(cell.formula, data, cellRef(row, col))
        return v !== null && v !== undefined ? String(v) : ''
      } catch { return '#ERROR' }
    }
    return cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
  }, [cell, data, row, col, formulaEngine])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCellClick(row, col)
  }, [row, col, onCellClick])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCellDoubleClick(row, col)
  }, [row, col, onCellDoubleClick])

  return (
    <div
      className={cn(
        'absolute top-0 left-0 flex items-center px-1.5 text-[13px] select-none cursor-cell overflow-hidden',
        isSelected && 'ring-2 ring-primary z-10 bg-card',
        isInRange && !isSelected && 'bg-primary/5',
        showGridLines && 'border-r border-b border-border/50',
        !showGridLines && 'border-r border-b border-transparent',
        cell?.type === 'number' && 'justify-end',
        cell?.type === 'text' && 'justify-start',
        cell?.style?.align === 'center' && 'justify-center',
        cell?.style?.align === 'right' && 'justify-end',
        cell?.type === 'boolean' && 'justify-center',
      )}
      style={{
        width: columnWidth || DEFAULT_COL_WIDTH,
        height: rowHeight || DEFAULT_ROW_HEIGHT,
        fontWeight: style?.bold || cell?.style?.bold ? '600' : '400',
        fontStyle: style?.italic || cell?.style?.italic ? 'italic' : 'normal',
        textDecoration: style?.underline || cell?.style?.underline ? 'underline' : 'none',
        color: style?.fontColor || cell?.style?.fontColor || undefined,
        background: style?.fillColor || cell?.style?.fillColor || undefined,
        fontSize: (style?.fontSize || cell?.style?.fontSize || 13) + 'px',
        fontFamily: style?.fontFamily || cell?.style?.fontFamily || undefined,
        zIndex: isSelected ? 10 : 1,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        if (e.button === 0) onCellDragStart(row, col)
      }}
      title={cell?.formula ? `=${cell.formula}` : undefined}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={onEditKeyDown}
          onBlur={onEditBlur}
          className="absolute inset-0 w-full h-full bg-transparent px-1.5 text-[13px] text-foreground outline-none border-2 border-primary"
          style={{ fontSize: (style?.fontSize || cell?.style?.fontSize || 13) + 'px' }}
        />
      ) : (
        <span className="truncate w-full">{displayValue()}</span>
      )}
    </div>
  )
})

CellRenderer.displayName = 'CellRenderer'

function cellRef(row: number, col: number): string {
  let c = ''
  let n = col
  while (n >= 0) {
    c = String.fromCharCode(65 + (n % 26)) + c
    n = Math.floor(n / 26) - 1
  }
  return c + (row + 1)
}

export default CellRenderer
