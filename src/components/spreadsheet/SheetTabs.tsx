import React, { useCallback, useRef, useEffect } from 'react'
import { Plus } from '@/lib/icon-map'
import { cn } from '@/lib/utils'
import type { Sheet } from '@/lib/spreadsheet-engine/types'

interface SheetTabsProps {
  sheets: Sheet[]
  activeIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRename: (index: number, name: string) => void
  onDelete: (index: number) => void
  onReorder: (from: number, to: number) => void
}

const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets, activeIndex, onSelect, onAdd, onRename, onDelete, onReorder,
}) => {
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center' })
    }
  }, [activeIndex])

  const handleDoubleClick = useCallback((index: number, currentName: string) => {
    const name = window.prompt('Rename sheet:', currentName)
    if (name && name.trim()) onRename(index, name.trim())
  }, [onRename])

  const handleContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    if (sheets.length > 1) {
      if (confirm(`Delete sheet "${sheets[index].name}"?`)) onDelete(index)
    }
  }, [sheets, onDelete])

  return (
    <div className="flex items-center border-t border-border bg-card overflow-hidden">
      <div
        ref={tabsRef}
        className="flex-1 flex overflow-x-auto scrollbar-none"
      >
        {sheets.map((sheet, index) => (
          <button
            key={sheet.id}
            data-active={index === activeIndex ? 'true' : 'false'}
            onClick={() => onSelect(index)}
            onDoubleClick={() => handleDoubleClick(index, sheet.name)}
            onContextMenu={(e) => handleContextMenu(e, index)}
            className={cn(
              'shrink-0 flex items-center gap-2 px-4 h-[34px] text-[12px] font-medium border-r border-border/50 transition-colors select-none',
              index === activeIndex
                ? 'bg-background text-foreground border-t-2 border-t-primary mt-[-1px]'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
          >
            <span className="truncate max-w-[120px]">{sheet.name}</span>
            {sheet.tabColor && (
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sheet.tabColor }} />
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="shrink-0 w-[34px] h-[34px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-l border-border/50"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default SheetTabs
