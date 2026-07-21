import React, { useEffect, useRef } from 'react'
import {
  Scissors, Copy, ClipboardPaste, Trash2,
  Plus, Minus, Merge, ArrowUp, ArrowDown,
  Filter, SortAsc, SortDesc, Download,
} from '@/lib/icon-map'

interface ContextMenuProps {
  x: number
  y: number
  cell: string
  onClose: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  onInsertRow: (dir: 'above' | 'below') => void
  onInsertCol: (dir: 'left' | 'right') => void
  onDeleteRow: () => void
  onDeleteCol: () => void
  onMerge: () => void
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x, y, cell, onClose,
  onCut, onCopy, onPaste, onDelete,
  onInsertRow, onInsertCol, onDeleteRow, onDeleteCol,
  onMerge, onSortAsc, onSortDesc, onFilter,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const adjustX = Math.min(x, window.innerWidth - 220)
  const adjustY = Math.min(y, window.innerHeight - 380)

  const items: { label: string; icon?: React.ReactNode; onClick: () => void; separator?: boolean }[] = [
    { label: 'Cut', icon: <Scissors className="w-3.5 h-3.5" />, onClick: onCut },
    { label: 'Copy', icon: <Copy className="w-3.5 h-3.5" />, onClick: onCopy },
    { label: 'Paste', icon: <ClipboardPaste className="w-3.5 h-3.5" />, onClick: onPaste, separator: true },
    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: onDelete, separator: true },
    { label: 'Insert Rows Above', icon: <ArrowUp className="w-3.5 h-3.5" />, onClick: () => onInsertRow('above') },
    { label: 'Insert Rows Below', icon: <ArrowDown className="w-3.5 h-3.5" />, onClick: () => onInsertRow('below') },
    { label: 'Insert Columns Left', icon: <Plus className="w-3.5 h-3.5" />, onClick: () => onInsertCol('left') },
    { label: 'Insert Columns Right', icon: <Plus className="w-3.5 h-3.5" />, onClick: () => onInsertCol('right') },
    { label: 'Delete Rows', icon: <Minus className="w-3.5 h-3.5" />, onClick: onDeleteRow },
    { label: 'Delete Columns', icon: <Minus className="w-3.5 h-3.5" />, onClick: onDeleteCol, separator: true },
    { label: 'Merge Cells', icon: <Merge className="w-3.5 h-3.5" />, onClick: onMerge, separator: true },
    { label: 'Sort A→Z', icon: <SortAsc className="w-3.5 h-3.5" />, onClick: onSortAsc },
    { label: 'Sort Z→A', icon: <SortDesc className="w-3.5 h-3.5" />, onClick: onSortDesc },
    { label: 'Filter', icon: <Filter className="w-3.5 h-3.5" />, onClick: onFilter },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-[100] w-[200px] py-1.5 rounded-lg bg-card border border-border shadow-lg"
      style={{ left: adjustX, top: adjustY }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <button
            onClick={() => { item.onClick(); onClose() }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
          >
            <span className="w-4 flex items-center justify-center text-muted-foreground">{item.icon}</span>
            <span>{item.label}</span>
          </button>
          {item.separator && i < items.length - 1 && (
            <div className="mx-3 my-1 border-t border-border/50" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default ContextMenu
