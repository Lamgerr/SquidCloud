import React, { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ColumnHeaderProps {
  col: number
  width: number
  height: number
  isSelected: boolean
  onSelect?: (col: number) => void
  onResize?: (col: number, width: number) => void
}

const ColumnHeader: React.FC<ColumnHeaderProps> = memo(({ col, width, height, isSelected, onSelect, onResize }) => {
  const label = getColumnLetter(col)

  const handleClick = useCallback(() => {
    onSelect?.(col)
  }, [col, onSelect])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startW = width

    const handleMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX
      const newW = Math.max(30, startW + diff)
      onResize?.(col, newW)
    }

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [col, width, onResize])

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center text-[11px] font-medium select-none cursor-pointer border-r border-b border-border/50 relative',
        isSelected ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground hover:bg-accent/50',
      )}
      style={{ width, height }}
      onClick={handleClick}
    >
      {label}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 z-10"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
})

ColumnHeader.displayName = 'ColumnHeader'

function getColumnLetter(index: number): string {
  let result = ''
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result
    index = Math.floor(index / 26) - 1
  }
  return result
}

export default ColumnHeader
