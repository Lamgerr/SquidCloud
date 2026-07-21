import React, { useState, useMemo } from 'react'
import { Search, Calculator } from '@/lib/icon-map'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getFunctionList } from '@/lib/spreadsheet-engine/formula-engine'

interface FormulaPanelProps {
  onInsertFunction: (name: string) => void
}

const FormulaPanel: React.FC<FormulaPanelProps> = ({ onInsertFunction }) => {
  const [search, setSearch] = useState('')
  const functions = useMemo(() => getFunctionList(), [])

  const filtered = useMemo(() => {
    if (!search) return functions
    const q = search.toLowerCase()
    return functions.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
    )
  }, [search, functions])

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-3 border-b border-border">
        <h3 className="text-[13px] font-semibold text-foreground mb-2">Insert Function</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search functions..."
            className="h-8 pl-8 text-[12px] bg-muted border-border text-foreground placeholder:text-muted-foreground/50 rounded-md"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="text-[11px] font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">
          {filtered.length} function{filtered.length !== 1 ? 's' : ''}
        </div>
        {filtered.map(fn => (
          <button
            key={fn.name}
            onClick={() => onInsertFunction(fn.name)}
            className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-b border-border/30"
          >
            <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-mono font-semibold text-foreground">{fn.name}</div>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{fn.args}</div>
              <div className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{fn.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FormulaPanel
