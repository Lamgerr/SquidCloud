import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Maximize2, Minimize2, Loader2 } from '@/lib/icon-map'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import SpreadsheetToolbar from './SpreadsheetToolbar'
import FormulaBar from './FormulaBar'
import SpreadsheetGrid from './SpreadsheetGrid'
import SheetTabs from './SheetTabs'
import StatusBar from './StatusBar'
import ContextMenu from './ContextMenu'
import {
  createEmptyWorkbook, createEmptySheet, loadWorkbookFromFile, saveWorkbookToXLSX, saveWorkbookToCSV,
} from '@/lib/spreadsheet-engine/workbook'
import { setCellValue, setCellStyle, clearRange, insertRow, insertCol, deleteRow, deleteCol, mergeCells, unmergeCells, setRangeValue } from '@/lib/spreadsheet-engine/cell-operations'
import { evaluateFormula } from '@/lib/spreadsheet-engine/formula-engine'
import type { Workbook, Sheet, Selection, CellData } from '@/lib/spreadsheet-engine/types'
import { cellRef, parseCellRef, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '@/lib/spreadsheet-engine/types'
import { cn } from '@/lib/utils'

interface SpreadsheetViewerProps {
  src?: string
  file?: File
  fileName?: string
  onDownload?: () => void
  onSave?: (data: any) => void
  onClose?: () => void
}

const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  src, file, fileName: propFileName, onDownload, onSave, onClose,
}) => {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [isFullscreen, setIsFullscreen] = useState(true)

  // Workbook state
  const [workbook, setWorkbook] = useState<Workbook>(() => createEmptyWorkbook())
  const [loading, setLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  // Selection state
  const [selection, setSelection] = useState<Selection>({
    type: 'cell',
    activeCell: 'A1',
    ranges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }],
  })

  // Edit state
  const [formulaBarValue, setFormulaBarValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // UI state
  const [showGridLines, setShowGridLines] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [freezePane, setFreezePane] = useState({ row: 0, col: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cell: string } | null>(null)
  const [clipboard, setClipboard] = useState<{ cells: { ref: string; value: string | number | boolean | null; formula?: string }[] } | null>(null)

  // History
  const [history, setHistory] = useState<{ snapshot: string }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Fullscreen ref
  const containerRef = useRef<HTMLDivElement>(null)

  // Load file
  useEffect(() => {
    if (!file && !src) return
    const load = async () => {
      setLoading(true)
      setLoadProgress(0)
      try {
        let wb: Workbook
        if (file) {
          wb = await loadWorkbookFromFile(file, setLoadProgress)
        } else if (src) {
          const response = await fetch(src)
          const blob = await response.blob()
          const loadFile = new File([blob], propFileName || 'spreadsheet.xlsx')
          wb = await loadWorkbookFromFile(loadFile, setLoadProgress)
        } else {
          wb = createEmptyWorkbook()
        }
        setWorkbook(wb)
        pushHistory(wb)
      } catch (err: any) {
        toast({ title: 'Failed to load spreadsheet', description: err.message, variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [src])

  const pushHistory = useCallback((wb: Workbook) => {
    const idx = Math.max(0, Math.min(wb.activeSheet, wb.sheets.length - 1))
    const sheet = wb.sheets[idx]
    if (!sheet) return
    const snapshot = JSON.stringify(Array.from(sheet.data.entries()))
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { snapshot }])
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const activeSheet = workbook.sheets[workbook.activeSheet] ?? workbook.sheets[0] ?? createEmptySheet('Sheet1')

  const updateActiveSheet = useCallback((updater: (sheet: Sheet) => void) => {
    setWorkbook(prev => {
      const idx = Math.max(0, Math.min(prev.activeSheet, prev.sheets.length - 1))
      const sheets = [...prev.sheets]
      const sheet = { ...sheets[idx] }
      updater(sheet)
      sheets[idx] = sheet
      const newWb = { ...prev, sheets, activeSheet: idx }
      return newWb
    })
  }, [])

  // Cell operations
  const handleCellValueChange = useCallback((ref: string, value: string | number | boolean | null, formula?: string) => {
    updateActiveSheet(sheet => {
      setCellValue(sheet, ref, value, formula)
    })
    setWorkbook(prev => {
      pushHistory(prev)
      return prev
    })
  }, [updateActiveSheet, pushHistory])

  const handleCellStyleChange = useCallback((ref: string, style: any) => {
    updateActiveSheet(sheet => {
      setCellStyle(sheet, ref, style)
    })
  }, [updateActiveSheet])

  const handleStartEdit = useCallback((ref: string, value: string) => {
    setSelection(prev => ({ ...prev, activeCell: ref, editing: true, editValue: value }))
    setFormulaBarValue(value)
    setIsEditing(true)
  }, [])

  const handleEndEdit = useCallback(() => {
    if (!selection.editing || !selection.editValue) {
      setSelection(prev => ({ ...prev, editing: false, editValue: undefined }))
      setIsEditing(false)
      return
    }
    const ref = selection.activeCell
    const val = selection.editValue
    if (val.startsWith('=')) {
      handleCellValueChange(ref, null, val.substring(1))
    } else {
      const num = Number(val)
      handleCellValueChange(ref, isNaN(num) ? val : num)
    }
    setSelection(prev => ({ ...prev, editing: false, editValue: undefined }))
    setFormulaBarValue('')
    setIsEditing(false)
  }, [selection, handleCellValueChange])

  const handleFormulaBarChange = useCallback((value: string) => {
    setFormulaBarValue(value)
    setSelection(prev => ({ ...prev, editValue: value }))
  }, [])

  const handleFormulaBarSubmit = useCallback(() => {
    if (!formulaBarValue) return
    const ref = selection.activeCell
    const val = formulaBarValue
    if (val.startsWith('=')) {
      handleCellValueChange(ref, null, val.substring(1))
    } else {
      const num = Number(val)
      handleCellValueChange(ref, isNaN(num) ? val : num)
    }
    setFormulaBarValue('')
    setSelection(prev => ({ ...prev, editing: false, editValue: undefined }))
    setIsEditing(false)
  }, [formulaBarValue, selection.activeCell, handleCellValueChange])

  // Selection
  const handleSelectionChange = useCallback((newSel: Selection) => {
    setSelection(newSel)
    const cell = activeSheet?.data.get(newSel.activeCell)
    if (cell?.formula) {
      setFormulaBarValue(cell.formula)
    } else if (cell?.value !== null && cell?.value !== undefined) {
      setFormulaBarValue(String(cell.value))
    } else {
      setFormulaBarValue('')
    }
  }, [activeSheet])

  // Toolbar actions
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return
    const newIdx = historyIndex - 1
    const snapshot = history[newIdx]
    if (snapshot) {
      updateActiveSheet(sheet => {
        sheet.data = new Map(JSON.parse(snapshot.snapshot))
      })
    }
    setHistoryIndex(newIdx)
  }, [historyIndex, history, updateActiveSheet])

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const newIdx = historyIndex + 1
    const snapshot = history[newIdx]
    if (snapshot) {
      updateActiveSheet(sheet => {
        sheet.data = new Map(JSON.parse(snapshot.snapshot))
      })
    }
    setHistoryIndex(newIdx)
  }, [historyIndex, history, updateActiveSheet])

  const handleCut = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    const cells: { ref: string; value: string | number | boolean | null; formula?: string }[] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const ref = cellRef(r, c)
        const cell = activeSheet?.data.get(ref)
        cells.push({ ref, value: cell?.value ?? null, formula: cell?.formula })
      }
    }
    setClipboard({ cells })
    clearRange(activeSheet, range)
    setWorkbook(prev => ({ ...prev }))
  }, [selection, activeSheet])

  const handleCopy = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    const cells: { ref: string; value: string | number | boolean | null; formula?: string }[] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const ref = cellRef(r, c)
        const cell = activeSheet?.data.get(ref)
        cells.push({ ref, value: cell?.value ?? null, formula: cell?.formula })
      }
    }
    setClipboard({ cells })
  }, [selection, activeSheet])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    const range = selection.ranges[0]
    if (!range) return
    const startR = range.startRow
    const startC = range.startCol
    clipboard.cells.forEach((cell, i) => {
      const ref = cellRef(startR + (i % 26), startC + Math.floor(i / 26))
      if (cell.formula) {
        setCellValue(activeSheet, ref, null, cell.formula)
      } else {
        setCellValue(activeSheet, ref, cell.value)
      }
    })
    setWorkbook(prev => ({ ...prev }))
  }, [clipboard, selection, activeSheet])

  const handleBold = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => {
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const ref = cellRef(r, c)
          const cell = sheet.data.get(ref)
          const isBold = cell?.style?.bold
          setCellStyle(sheet, ref, { bold: !isBold })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleItalic = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => {
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const ref = cellRef(r, c)
          const cell = sheet.data.get(ref)
          const isItalic = cell?.style?.italic
          setCellStyle(sheet, ref, { italic: !isItalic })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleUnderline = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => {
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const ref = cellRef(r, c)
          const cell = sheet.data.get(ref)
          const isUl = cell?.style?.underline
          setCellStyle(sheet, ref, { underline: !isUl })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleAlignLeft = useCallback(() => {
    updateActiveSheet(sheet => {
      const range = selection.ranges[0]
      if (!range) return
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          setCellStyle(sheet, cellRef(r, c), { align: 'left' })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleAlignCenter = useCallback(() => {
    updateActiveSheet(sheet => {
      const range = selection.ranges[0]
      if (!range) return
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          setCellStyle(sheet, cellRef(r, c), { align: 'center' })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleAlignRight = useCallback(() => {
    updateActiveSheet(sheet => {
      const range = selection.ranges[0]
      if (!range) return
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          setCellStyle(sheet, cellRef(r, c), { align: 'right' })
        }
      }
    })
  }, [selection, updateActiveSheet])

  const handleInsertRow = useCallback((dir: 'above' | 'below') => {
    const row = selection.ranges[0]?.startRow ?? 0
    updateActiveSheet(sheet => insertRow(sheet, dir === 'above' ? row : row + 1))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleInsertCol = useCallback((dir: 'left' | 'right') => {
    const col = selection.ranges[0]?.startCol ?? 0
    updateActiveSheet(sheet => insertCol(sheet, dir === 'left' ? col : col + 1))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleDeleteRow = useCallback(() => {
    const row = selection.ranges[0]?.startRow ?? 0
    updateActiveSheet(sheet => deleteRow(sheet, row))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleDeleteCol = useCallback(() => {
    const col = selection.ranges[0]?.startCol ?? 0
    updateActiveSheet(sheet => deleteCol(sheet, col))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleMerge = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => mergeCells(sheet, range))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleUnmerge = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => unmergeCells(sheet, range))
    pushHistory(workbook)
  }, [selection, updateActiveSheet, pushHistory, workbook])

  const handleSortAsc = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    const col = range.startCol
    const rows: { row: number; value: any }[] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      const ref = cellRef(r, col)
      const cell = activeSheet?.data.get(ref)
      rows.push({ row: r, value: cell?.value ?? '' })
    }
    rows.sort((a, b) => String(a.value).localeCompare(String(b.value)))
    const sortedData = new Map<string, CellData>()
    rows.forEach((row, i) => {
      const targetR = range.startRow + i
      for (let c = range.startCol; c <= range.endCol; c++) {
        const oldRef = cellRef(row.row, c)
        const cell = activeSheet?.data.get(oldRef)
        if (cell) sortedData.set(cellRef(targetR, c), { ...cell })
      }
    })
    updateActiveSheet(sheet => {
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const newRef = cellRef(r, c)
          const newCell = sortedData.get(newRef)
          if (newCell) sheet.data.set(newRef, newCell)
          else sheet.data.delete(newRef)
        }
      }
    })
    pushHistory(workbook)
  }, [selection, activeSheet, updateActiveSheet, pushHistory, workbook])

  const handleSortDesc = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    const col = range.startCol
    const rows: { row: number; value: any }[] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      const ref = cellRef(r, col)
      const cell = activeSheet?.data.get(ref)
      rows.push({ row: r, value: cell?.value ?? '' })
    }
    rows.sort((a, b) => String(b.value).localeCompare(String(a.value)))
    const sortedData = new Map<string, CellData>()
    rows.forEach((row, i) => {
      const targetR = range.startRow + i
      for (let c = range.startCol; c <= range.endCol; c++) {
        const oldRef = cellRef(row.row, c)
        const cell = activeSheet?.data.get(oldRef)
        if (cell) sortedData.set(cellRef(targetR, c), { ...cell })
      }
    })
    updateActiveSheet(sheet => {
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const newRef = cellRef(r, c)
          const newCell = sortedData.get(newRef)
          if (newCell) sheet.data.set(newRef, newCell)
          else sheet.data.delete(newRef)
        }
      }
    })
    pushHistory(workbook)
  }, [selection, activeSheet, updateActiveSheet, pushHistory, workbook])

  const handleFilter = useCallback(() => {
    const range = selection.ranges[0]
    if (!range) return
    updateActiveSheet(sheet => {
      sheet.filter = { ...range }
    })
  }, [selection, updateActiveSheet])

  const handleClearFilter = useCallback(() => {
    updateActiveSheet(sheet => {
      sheet.filter = undefined
    })
  }, [updateActiveSheet])

  const handleExport = useCallback(async (format: 'xlsx' | 'csv' | 'pdf' | 'html') => {
    try {
      if (format === 'xlsx') {
        const ab = await saveWorkbookToXLSX(workbook)
        const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = workbook.name.replace(/\.[^.]+$/, '') + '.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      } else if (format === 'csv') {
        const csv = saveWorkbookToCSV(workbook)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = workbook.name.replace(/\.[^.]+$/, '') + '.csv'
        a.click()
        URL.revokeObjectURL(url)
      } else if (format === 'html') {
        // Export as HTML table
        const { getSheetGridData } = await import('@/lib/spreadsheet-engine/workbook')
        const grid = getSheetGridData(activeSheet)
        let html = '<html><head><style>table { border-collapse: collapse; font-family: sans-serif; } td, th { border: 1px solid #ccc; padding: 4px 8px; }</style></head><body>'
        html += `<table>${grid.map(row => `<tr>${row.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = workbook.name.replace(/\.[^.]+$/, '') + '.html'
        a.click()
        URL.revokeObjectURL(url)
      }
      toast({ title: `Exported as ${format.toUpperCase()}` })
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' })
    }
  }, [workbook, activeSheet, toast])

  const handleSave = useCallback(async () => {
    if (onSave) {
      const csv = saveWorkbookToCSV(workbook)
      onSave(csv)
    } else {
      const ab = await saveWorkbookToXLSX(workbook)
      const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = workbook.name.replace(/\.[^.]+$/, '') + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    }
    toast({ title: 'Saved' })
  }, [workbook, onSave, toast])

  const handleFind = useCallback(() => {
    const search = prompt('Find:')
    if (!search) return
    for (const [ref, cell] of activeSheet.data) {
      if (String(cell.value).toLowerCase().includes(search.toLowerCase())) {
        const [r, c] = parseCellRef(ref) || [0, 0]
        setSelection({
          type: 'cell',
          activeCell: ref,
          ranges: [{ startRow: r, startCol: c, endRow: r, endCol: c }],
        })
        return
      }
    }
    toast({ title: `No results found for "${search}"` })
  }, [activeSheet, toast])

  const handleSheetSelect = useCallback((index: number) => {
    setWorkbook(prev => ({ ...prev, activeSheet: index }))
    setSelection({
      type: 'cell',
      activeCell: 'A1',
      ranges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }],
    })
    setFormulaBarValue('')
  }, [])

  const handleSheetAdd = useCallback(() => {
    setWorkbook(prev => {
      const { createEmptySheet } = require('@/lib/spreadsheet-engine/workbook')
      const newSheet = createEmptySheet(`Sheet${prev.sheets.length + 1}`)
      return { ...prev, sheets: [...prev.sheets, newSheet], activeSheet: prev.sheets.length }
    })
  }, [])

  const handleSheetRename = useCallback((index: number, name: string) => {
    setWorkbook(prev => {
      const sheets = [...prev.sheets]
      sheets[index] = { ...sheets[index], name }
      return { ...prev, sheets }
    })
  }, [])

  const handleSheetDelete = useCallback((index: number) => {
    setWorkbook(prev => {
      if (prev.sheets.length <= 1) return prev
      const sheets = prev.sheets.filter((_, i) => i !== index)
      const active = Math.max(0, Math.min(prev.activeSheet, sheets.length - 1))
      return { ...prev, sheets, activeSheet: active }
    })
  }, [])

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as HTMLElement
    if (target.closest('[data-row]')) {
      setContextMenu({ x: e.clientX, y: e.clientY, cell: selection.activeCell })
    }
  }, [selection.activeCell])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z': e.preventDefault(); handleUndo(); break
          case 'y': e.preventDefault(); handleRedo(); break
          case 'c': e.preventDefault(); handleCopy(); break
          case 'x': e.preventDefault(); handleCut(); break
          case 'v': e.preventDefault(); handlePaste(); break
          case 's': e.preventDefault(); handleSave(); break
          case 'b': e.preventDefault(); handleBold(); break
          case 'i': e.preventDefault(); handleItalic(); break
          case 'u': e.preventDefault(); handleUnderline(); break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSave, handleBold, handleItalic, handleUnderline])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">Loading spreadsheet...</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 bg-background flex flex-col',
        'text-foreground',
      )}
      onContextMenu={handleContextMenu}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            <FileSpreadsheetIcon className="w-4 h-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{workbook.name}</h2>
            <p className="text-xs text-muted-foreground">
              {workbook.sheets[workbook.activeSheet]?.name} · {workbook.sheets.length} sheet{workbook.sheets.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen()
              else containerRef.current?.requestFullscreen?.()
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {document.fullscreenElement ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar Ribbon */}
      <SpreadsheetToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onBold={handleBold}
        onItalic={handleItalic}
        onUnderline={handleUnderline}
        onAlignLeft={handleAlignLeft}
        onAlignCenter={handleAlignCenter}
        onAlignRight={handleAlignRight}
        onInsertRow={handleInsertRow}
        onInsertCol={handleInsertCol}
        onDeleteRow={handleDeleteRow}
        onDeleteCol={handleDeleteCol}
        onMerge={handleMerge}
        onUnmerge={handleUnmerge}
        onSortAsc={handleSortAsc}
        onSortDesc={handleSortDesc}
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        onExport={handleExport}
        onSave={handleSave}
        onFind={handleFind}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* Formula Bar */}
      <FormulaBar
        activeCell={selection.activeCell}
        formula={formulaBarValue}
        isEditing={false}
        onFormulaChange={handleFormulaBarChange}
        onFormulaSubmit={handleFormulaBarSubmit}
        onFormulaCancel={() => {
          setFormulaBarValue('')
          setSelection(prev => ({ ...prev, editing: false, editValue: undefined }))
          setIsEditing(false)
        }}
      />

      {/* Grid */}
      <SpreadsheetGrid
        sheet={activeSheet}
        selection={selection}
        showGridLines={showGridLines}
        freezePane={freezePane}
        onSelectionChange={handleSelectionChange}
        onCellValueChange={handleCellValueChange}
        onCellStyleChange={handleCellStyleChange}
        onStartEdit={handleStartEdit}
        onEndEdit={handleEndEdit}
        onEditValueChange={(value) => {
          setSelection(prev => ({ ...prev, editValue: value }))
          setFormulaBarValue(value)
        }}
      />

      {/* Sheet Tabs */}
      <SheetTabs
        sheets={workbook.sheets}
        activeIndex={workbook.activeSheet}
        onSelect={handleSheetSelect}
        onAdd={handleSheetAdd}
        onRename={handleSheetRename}
        onDelete={handleSheetDelete}
        onReorder={() => {}}
      />

      {/* Status Bar */}
      <StatusBar
        selection={selection.ranges[0] || null}
        sheetData={activeSheet.data}
        sheetName={activeSheet.name}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          cell={contextMenu.cell}
          onClose={() => setContextMenu(null)}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDelete={() => {
            const range = selection.ranges[0]
            if (range) clearRange(activeSheet, range)
            setWorkbook(prev => ({ ...prev }))
          }}
          onInsertRow={handleInsertRow}
          onInsertCol={handleInsertCol}
          onDeleteRow={handleDeleteRow}
          onDeleteCol={handleDeleteCol}
          onMerge={handleMerge}
          onSortAsc={handleSortAsc}
          onSortDesc={handleSortDesc}
          onFilter={handleFilter}
        />
      )}
    </div>
  )
}

function FileSpreadsheetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V2" /><path d="M4 2h12l4 4v16H4" /><path d="M8 12h8" /><path d="M8 16h6" /><path d="M8 8h2" />
    </svg>
  )
}

export default SpreadsheetViewer
