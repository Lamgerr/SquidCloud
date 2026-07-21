import React, { useState, useMemo } from 'react'
import { Plus, X, Settings2 } from '@/lib/icon-map'
import { cn } from '@/lib/utils'
import type { Sheet, SelectionRange, PivotTable } from '@/lib/spreadsheet-engine/types'

interface PivotTablePanelProps {
  sheet: Sheet
  range: SelectionRange | null
  onApply: (config: any) => void
}

const PivotTablePanel: React.FC<PivotTablePanelProps> = ({ sheet, range, onApply }) => {
  const [rows, setRows] = useState<string[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [values, setValues] = useState<{ field: string; agg: string }[]>([])

  const fields = useMemo(() => {
    if (!range) return []
    const fieldSet = new Set<string>()
    for (let c = range.startCol; c <= range.endCol; c++) {
      const headerCell = sheet.data.get(cellRef(range.startRow, c))
      const fieldName = headerCell?.value ? String(headerCell.value) : `Column ${c - range.startCol + 1}`
      fieldSet.add(fieldName)
    }
    return Array.from(fieldSet)
  }, [sheet, range])

  return (
    <div className="p-3 bg-card border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className="w-4 h-4 text-foreground" />
        <h3 className="text-[13px] font-semibold text-foreground">Pivot Table</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <DropZone label="Rows" fields={rows} allFields={fields} onAdd={(f) => setRows([...rows, f])} onRemove={(f) => setRows(rows.filter(r => r !== f))} />
        <DropZone label="Columns" fields={cols} allFields={fields} onAdd={(f) => setCols([...cols, f])} onRemove={(f) => setCols(cols.filter(c => c !== f))} />
        <DropZone label="Values" fields={values.map(v => v.field)} allFields={fields} onAdd={(f) => setValues([...values, { field: f, agg: 'sum' }])} onRemove={(f) => setValues(values.filter(v => v.field !== f))} />
      </div>

      <button
        onClick={() => onApply({ rows, columns: cols, values })}
        className="w-full h-9 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
        disabled={rows.length === 0 && cols.length === 0}
      >
        Generate Pivot Table
      </button>
    </div>
  )
}

function DropZone({ label, fields, allFields, onAdd, onRemove }: {
  label: string
  fields: string[]
  allFields: string[]
  onAdd: (f: string) => void
  onRemove: (f: string) => void
}) {
  const available = allFields.filter(f => !fields.includes(f))
  return (
    <div className="p-2 rounded-lg bg-muted border border-border min-h-[80px]">
      <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">{label}</div>
      {fields.map(f => (
        <div key={f} className="flex items-center gap-1 px-2 py-1 mb-1 rounded bg-accent text-[11px] text-foreground">
          <span className="flex-1 truncate">{f}</span>
          <button onClick={() => onRemove(f)} className="text-muted-foreground hover:text-foreground"><X className="w-2.5 h-2.5" /></button>
        </div>
      ))}
      {available.length > 0 && (
        <select
          onChange={(e) => { if (e.target.value) onAdd(e.target.value) }}
          className="w-full mt-1 text-[11px] bg-transparent text-muted-foreground border-none outline-none"
        >
          <option value="">+ Add field</option>
          {available.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      )}
    </div>
  )
}

function cellRef(row: number, col: number): string {
  let c = ''
  let n = col
  while (n >= 0) { c = String.fromCharCode(65 + (n % 26)) + c; n = Math.floor(n / 26) - 1 }
  return c + (row + 1)
}

export default PivotTablePanel
