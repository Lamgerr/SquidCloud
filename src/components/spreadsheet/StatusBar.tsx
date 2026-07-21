import React from 'react'
import type { CellData, SelectionRange } from '@/lib/spreadsheet-engine/types'

interface StatusBarProps {
  selection: SelectionRange | null
  sheetData: Map<string, CellData>
  sheetName: string
  zoom: number
  onZoomChange: (zoom: number) => void
}

const StatusBar: React.FC<StatusBarProps> = ({ selection, sheetData, sheetName, zoom, onZoomChange }) => {
  const stats = React.useMemo(() => {
    if (!selection) return null
    const cells: number[] = []
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        let col = c
        let row = r
        let ref = ''
        while (col >= 0) { ref = String.fromCharCode(65 + (col % 26)) + ref; col = Math.floor(col / 26) - 1 }
        ref += (row + 1)
        const cell = sheetData.get(ref)
        if (cell && typeof cell.value === 'number') cells.push(cell.value)
      }
    }
    if (cells.length === 0) return null
    const sum = cells.reduce((a, b) => a + b, 0)
    return {
      count: cells.length,
      sum,
      avg: sum / cells.length,
      min: Math.min(...cells),
      max: Math.max(...cells),
    }
  }, [selection, sheetData])

  return (
    <div className="flex items-center justify-between h-7 px-3 bg-card border-t border-border text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground/80">{sheetName}</span>
        {stats && (
          <div className="flex items-center gap-3">
            <span>Count: {stats.count}</span>
            <span>Sum: {stats.sum.toLocaleString()}</span>
            <span>Avg: {stats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span>Min: {stats.min.toLocaleString()}</span>
            <span>Max: {stats.max.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(Math.max(50, zoom - 10))}
          className="px-1 hover:text-foreground transition-colors"
        >
          -
        </button>
        <span className="w-10 text-center font-mono">{zoom}%</span>
        <button
          onClick={() => onZoomChange(Math.min(200, zoom + 10))}
          className="px-1 hover:text-foreground transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default StatusBar
