import React, { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface RowHeaderProps {
  row: number
  height: number
  isSelected: boolean
  onSelect?: (row: number) => void
  onResize?: (row: number, height: number) => void
}

const RowHeader: React.FC<RowHeaderProps> = memo(({ row, height, isSelected, onSelect, onResize }) => {
  const handleClick = useCallback(() => {
    onSelect?.(row)
  }, [row, onSelect])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const startY = e.clientY
    const startH = height

    const handleMove = (ev: MouseEvent) => {
      const diff = ev.clientY - startY
      const newH = Math.max(20, startH + diff)
      onResize?.(row, newH)
    }

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [row, height, onResize])

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center text-[11px] font-medium select-none cursor-pointer border-b border-border/50 relative',
        isSelected ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground hover:bg-accent/50',
      )}
      style={{ width: 40, height }}
      onClick={handleClick}
    >
      {row + 1}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/30 z-10"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
})

RowHeader.displayName = 'RowHeader'

export default RowHeader
