import React, { useState } from 'react'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  ChevronDown,
} from '@/lib/icon-map'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CellStyle } from '@/lib/spreadsheet-engine/types'

interface FormatPanelProps {
  style: CellStyle | undefined
  onStyleChange: (style: Partial<CellStyle>) => void
}

const FormatPanel: React.FC<FormatPanelProps> = ({ style, onStyleChange }) => {
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const fonts = ['Calibri', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Helvetica', 'Segoe UI']
  const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
  const colors = ['#E6EDF3', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#8E8E93', '#000000']

  return (
    <div className="p-3 space-y-3 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <button
            onClick={() => setShowFontPicker(!showFontPicker)}
            className="w-full h-8 flex items-center justify-between px-2 rounded bg-muted border border-border text-[12px] text-foreground hover:bg-accent"
          >
            <span>{style?.fontFamily || 'Calibri'}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showFontPicker && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
              {fonts.map(font => (
                <button
                  key={font}
                  onClick={() => { onStyleChange({ fontFamily: font }); setShowFontPicker(false) }}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent transition-colors',
                    style?.fontFamily === font ? 'text-foreground bg-accent' : 'text-muted-foreground',
                  )}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative w-16">
          <button
            onClick={() => setShowFontPicker(false)}
            className="w-full h-8 flex items-center justify-between px-2 rounded bg-muted border border-border text-[12px] text-foreground hover:bg-accent"
          >
            <span>{style?.fontSize || 11}</span>
          </button>
          {false && (
            <div className="absolute top-full left-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto w-16">
              {sizes.map(s => (
                <button
                  key={s}
                  onClick={() => onStyleChange({ fontSize: s })}
                  className={cn(
                    'w-full px-3 py-1 text-center text-[12px] hover:bg-accent',
                    style?.fontSize === s ? 'text-foreground bg-accent' : 'text-muted-foreground',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onStyleChange({ bold: !style?.bold })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.bold ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStyleChange({ italic: !style?.italic })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.italic ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStyleChange({ underline: !style?.underline })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.underline ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          onClick={() => onStyleChange({ align: 'left' })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.align === 'left' ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStyleChange({ align: 'center' })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.align === 'center' ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStyleChange({ align: 'right' })}
          className={cn('h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors', style?.align === 'right' ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: style?.fontColor || '#E6EDF3' }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg w-[168px]">
              <div className="grid grid-cols-6 gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => { onStyleChange({ fontColor: color }); setShowColorPicker(false) }}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FormatPanel
