import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Scissors, Copy, ClipboardPaste,
  Plus, Minus, ArrowUp, ArrowDown, Merge, Split,
  Search, Filter, SortAsc, SortDesc,
  Download, Upload, Save, FileSpreadsheet, Calculator,
  ChevronDown, MoreHorizontal,
} from '@/lib/icon-map'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

interface SpreadsheetToolbarProps {
  onUndo: () => void
  onRedo: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onAlignLeft: () => void
  onAlignCenter: () => void
  onAlignRight: () => void
  onInsertRow: (dir: 'above' | 'below') => void
  onInsertCol: (dir: 'left' | 'right') => void
  onDeleteRow: () => void
  onDeleteCol: () => void
  onMerge: () => void
  onUnmerge: () => void
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onClearFilter: () => void
  onExport: (format: 'xlsx' | 'csv' | 'pdf' | 'html') => void
  onSave: () => void
  onFind: () => void
  canUndo: boolean
  canRedo: boolean
}

type ToolbarTab = 'home' | 'insert' | 'formulas' | 'data' | 'view'

const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = (props) => {
  const [activeTab, setActiveTab] = useState<ToolbarTab>('home')

  const TabButton: React.FC<{ tab: ToolbarTab; label: string }> = ({ tab, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        'px-3 py-1.5 text-[12px] font-medium rounded-t-md transition-colors',
        activeTab === tab
          ? 'bg-background text-foreground border border-border border-b-background'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )

  const ToolbarBtn: React.FC<{
    icon: React.ReactNode
    label?: string
    onClick?: () => void
    disabled?: boolean
    active?: boolean
  }> = ({ icon, label, onClick, disabled, active }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-7 px-1.5 flex items-center gap-1 rounded text-[11px] font-medium transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )

  const renderHomeTab = () => (
    <div className="flex items-center gap-1.5 h-9 px-2">
      <div className="flex items-center gap-0.5">
        <ToolbarBtn icon={<Undo className="w-4 h-4" />} onClick={props.onUndo} disabled={!props.canUndo} />
        <ToolbarBtn icon={<Redo className="w-4 h-4" />} onClick={props.onRedo} disabled={!props.canRedo} />
      </div>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <div className="flex items-center gap-0.5">
        <ToolbarBtn icon={<Scissors className="w-4 h-4" />} onClick={props.onCut} />
        <ToolbarBtn icon={<Copy className="w-4 h-4" />} onClick={props.onCopy} />
        <ToolbarBtn icon={<ClipboardPaste className="w-4 h-4" />} onClick={props.onPaste} />
      </div>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn icon={<Bold className="w-4 h-4" />} onClick={props.onBold} active />
      <ToolbarBtn icon={<Italic className="w-4 h-4" />} onClick={props.onItalic} />
      <ToolbarBtn icon={<Underline className="w-4 h-4" />} onClick={props.onUnderline} />
      <span className="mx-1 text-muted-foreground/30">|</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[180px]">
          <DropdownMenuItem onClick={() => {}}>Calibri</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>Arial</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>Times New Roman</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>Courier New</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {}}>11</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>12</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>14</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>16</DropdownMenuItem>
          <DropdownMenuItem onClick={() => {}}>18</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn icon={<AlignLeft className="w-4 h-4" />} onClick={props.onAlignLeft} />
      <ToolbarBtn icon={<AlignCenter className="w-4 h-4" />} onClick={props.onAlignCenter} />
      <ToolbarBtn icon={<AlignRight className="w-4 h-4" />} onClick={props.onAlignRight} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<Merge className="w-4 h-4" />} label="Merge" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={props.onMerge}>Merge & Center</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onMerge}>Merge Across</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onMerge}>Merge Cells</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onUnmerge}>Unmerge Cells</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<Plus className="w-4 h-4" />} label="Insert" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => props.onInsertRow('above')}>Insert Rows Above</DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onInsertRow('below')}>Insert Rows Below</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => props.onInsertCol('left')}>Insert Columns Left</DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onInsertCol('right')}>Insert Columns Right</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<Minus className="w-4 h-4" />} label="Delete" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={props.onDeleteRow}>Delete Rows</DropdownMenuItem>
          <DropdownMenuItem onClick={props.onDeleteCol}>Delete Columns</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const renderInsertTab = () => (
    <div className="flex items-center gap-1.5 h-9 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<FileSpreadsheet className="w-4 h-4" />} label="Chart" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Bar Chart</DropdownMenuItem>
          <DropdownMenuItem>Column Chart</DropdownMenuItem>
          <DropdownMenuItem>Line Chart</DropdownMenuItem>
          <DropdownMenuItem>Pie Chart</DropdownMenuItem>
          <DropdownMenuItem>Scatter Chart</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarBtn icon={<Calculator className="w-4 h-4" />} label="Function" onClick={() => {}} />
    </div>
  )

  const renderFormulasTab = () => (
    <div className="flex items-center gap-1.5 h-9 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<Calculator className="w-4 h-4" />} label="AutoSum" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>SUM</DropdownMenuItem>
          <DropdownMenuItem>AVERAGE</DropdownMenuItem>
          <DropdownMenuItem>COUNT</DropdownMenuItem>
          <DropdownMenuItem>MAX</DropdownMenuItem>
          <DropdownMenuItem>MIN</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarBtn icon={<Search className="w-4 h-4" />} label="Insert Function" onClick={() => {}} />
    </div>
  )

  const renderDataTab = () => (
    <div className="flex items-center gap-1.5 h-9 px-2">
      <ToolbarBtn icon={<SortAsc className="w-4 h-4" />} label="Sort A→Z" onClick={props.onSortAsc} />
      <ToolbarBtn icon={<SortDesc className="w-4 h-4" />} label="Sort Z→A" onClick={props.onSortDesc} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn icon={<Filter className="w-4 h-4" />} label="Filter" onClick={props.onFilter} />
      <ToolbarBtn label="Clear" onClick={props.onClearFilter} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn icon={<Download className="w-4 h-4" />} label="Export" onClick={() => props.onExport('xlsx')} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarBtn icon={<ChevronDown className="w-3 h-3" />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => props.onExport('xlsx')}>Export as XLSX</DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onExport('csv')}>Export as CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onExport('pdf')}>Export as PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onExport('html')}>Export as HTML</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const renderViewTab = () => (
    <div className="flex items-center gap-1.5 h-9 px-2">
      <ToolbarBtn icon={<Search className="w-4 h-4" />} label="Find" onClick={props.onFind} />
      <ToolbarBtn icon={<Save className="w-4 h-4" />} label="Save" onClick={props.onSave} />
    </div>
  )

  return (
    <div className="bg-card border-b border-border">
      {/* File Tab */}
      <div className="flex items-center gap-0 px-2 pt-1 bg-muted/50">
        <button className="px-3 py-1.5 text-[12px] font-semibold text-foreground bg-background rounded-t-md border border-border border-b-background">
          File
        </button>
        <TabButton tab="home" label="Home" />
        <TabButton tab="insert" label="Insert" />
        <TabButton tab="formulas" label="Formulas" />
        <TabButton tab="data" label="Data" />
        <TabButton tab="view" label="View" />
      </div>

      {/* Ribbon Content */}
      <div className="border-t border-border">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'insert' && renderInsertTab()}
        {activeTab === 'formulas' && renderFormulasTab()}
        {activeTab === 'data' && renderDataTab()}
        {activeTab === 'view' && renderViewTab()}
      </div>
    </div>
  )
}

export default SpreadsheetToolbar
