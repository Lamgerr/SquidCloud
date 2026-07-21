import React, { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FormulaBarProps {
  activeCell: string
  formula: string
  isEditing: boolean
  onFormulaChange: (value: string) => void
  onFormulaSubmit: () => void
  onFormulaCancel: () => void
}

const FormulaBar: React.FC<FormulaBarProps> = ({
  activeCell, formula, isEditing,
  onFormulaChange, onFormulaSubmit, onFormulaCancel,
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFormulaSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onFormulaCancel()
    }
  }, [onFormulaSubmit, onFormulaCancel])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card">
      <div className="w-[72px] shrink-0 h-8 rounded-md bg-muted border border-border flex items-center justify-center text-[12px] font-mono font-semibold text-foreground select-none">
        {activeCell}
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/50 shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <path d="M4 22V2" /><path d="M4 2h12l4 4v16H4" /><path d="M8 12h8" /><path d="M8 16h6" /><path d="M8 8h2" />
        </svg>
      </div>
      <Input
        value={isEditing ? formula : formula}
        onChange={(e) => onFormulaChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter value or formula..."
        className="h-8 flex-1 bg-muted border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 font-mono rounded-md"
      />
    </div>
  )
}

export default FormulaBar
