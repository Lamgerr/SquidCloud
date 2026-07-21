import React, { useState, useMemo } from 'react'
import { BarChart3, LineChart, PieChart, TrendingUp } from '@/lib/icon-map'

function ScatterChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="1.5"/><circle cx="17" cy="5" r="1.5"/><circle cx="12" cy="14" r="1.5"/><circle cx="5" cy="17" r="1.5"/><circle cx="18" cy="12" r="1.5"/>
    </svg>
  )
}
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ChartConfig, Sheet, SelectionRange } from '@/lib/spreadsheet-engine/types'

interface ChartPanelProps {
  sheet: Sheet
  range: SelectionRange | null
  onInsert: (config: ChartConfig) => void
}

const CHART_TYPES = [
  { key: 'bar' as const, label: 'Bar', icon: BarChart3 },
  { key: 'column' as const, label: 'Column', icon: BarChart3 },
  { key: 'line' as const, label: 'Line', icon: TrendingUp },
  { key: 'pie' as const, label: 'Pie', icon: PieChart },
  { key: 'scatter' as const, label: 'Scatter', icon: ScatterChart },
]

const ChartPanel: React.FC<ChartPanelProps> = ({ sheet, range, onInsert }) => {
  const [chartType, setChartType] = useState<ChartConfig['type']>('bar')
  const [title, setTitle] = useState('')

  return (
    <div className="p-3 bg-card border-t border-border">
      <h3 className="text-[13px] font-semibold text-foreground mb-3">Insert Chart</h3>

      <div className="flex gap-1 mb-3">
        {CHART_TYPES.map(ct => (
          <button
            key={ct.key}
            onClick={() => setChartType(ct.key)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors',
              chartType === ct.key ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <ct.icon className="w-4 h-4" />
            {ct.label}
          </button>
        ))}
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Chart title (optional)"
        className="h-8 text-[12px] bg-muted border-border text-foreground placeholder:text-muted-foreground/50 rounded-md mb-3"
      />

      <button
        onClick={() => onInsert({ type: chartType, title: title || undefined, sourceRange: range || undefined })}
        className="w-full h-9 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
        disabled={!range}
      >
        Insert Chart
      </button>
    </div>
  )
}

export default ChartPanel
