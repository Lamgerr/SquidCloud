import Papa from 'papaparse'
import type { Workbook, Sheet, CellData, CellStyle } from './types'
import { cellRef, parseCellRef, DEFAULT_COL_WIDTH } from './types'
import { evaluateFormula } from './formula-engine'

function uid(): string {
  return 's' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

function getSheetJS() {
  return import('xlsx')
}

export function createEmptyWorkbook(name: string = 'Workbook'): Workbook {
  return {
    name,
    sheets: [createEmptySheet('Sheet1')],
    activeSheet: 0,
    created: new Date(),
    modified: new Date(),
  }
}

export function createEmptySheet(name: string): Sheet {
  return {
    id: uid(),
    name,
    data: new Map(),
    colWidths: new Map(),
    rowHeights: new Map(),
    merges: [],
  }
}

function sheetJSTypeToCellType(t: string, v: any): CellData['type'] {
  if (t === 'n') return 'number'
  if (t === 'b') return 'boolean'
  if (t === 'd') return 'date'
  if (t === 'e') return 'error'
  return 'text'
}

function sheetJSStyleToStyle(s: any): CellStyle | undefined {
  if (!s) return undefined
  const style: CellStyle = {}
  if (s.font) {
    if (s.font.bold) style.bold = true
    if (s.font.italic) style.italic = true
    if (s.font.underline) style.underline = true
    if (s.font.strike) style.strikethrough = true
    if (s.font.sz) style.fontSize = s.font.sz
    if (s.font.name) style.fontFamily = s.font.name
    if (s.font.color?.rgb) style.fontColor = '#' + s.font.color.rgb
    if (s.font.color?.theme !== undefined) style.fontColor = `theme(${s.font.color.theme})`
  }
  if (s.fill?.fgColor?.rgb) style.fillColor = '#' + s.fill.fgColor.rgb
  if (s.alignment) {
    if (s.alignment.horizontal) style.align = s.alignment.horizontal
    if (s.alignment.vertical) style.verticalAlign = s.alignment.vertical
    if (s.alignment.wrapText) style.textWrap = true
  }
  if (s.border) {
    if (s.border.top?.style) style.borderTop = s.border.top.style
    if (s.border.bottom?.style) style.borderBottom = s.border.bottom.style
    if (s.border.left?.style) style.borderLeft = s.border.left.style
    if (s.border.right?.style) style.borderRight = s.border.right.style
  }
  if (s.numFmt) style.numberFormat = s.numFmt
  return Object.keys(style).length ? style : undefined
}

export async function loadWorkbookFromFile(file: File, onProgress?: (pct: number) => void): Promise<Workbook> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv' || ext === 'tsv') {
    onProgress?.(25)
    const text = await file.text()
    onProgress?.(50)
    const result = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: ext === 'tsv' ? '\t' : undefined,
    })
    onProgress?.(75)
    const sheet = createEmptySheet(file.name.replace(/\.[^.]+$/, ''))
    result.data.forEach((row: any[], ri: number) => {
      row.forEach((val: any, ci: number) => {
        const data: CellData = {
          value: val ?? '',
          type: typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'text',
        }
        if (typeof val === 'string' && val.startsWith('=')) {
          data.formula = val.substring(1)
          data.type = 'formula'
        }
        sheet.data.set(cellRef(ri, ci), data)
      })
    })
    onProgress?.(100)
    return {
      name: file.name,
      sheets: [sheet],
      activeSheet: 0,
      created: new Date(),
      modified: new Date(),
    }
  }

  onProgress?.(10)
  const XLSX = await getSheetJS()
  onProgress?.(20)
  const ab = await file.arrayBuffer()
  onProgress?.(40)
  const wb = XLSX.read(ab, { cellStyles: true, cellNF: true, sheetStubs: true })
  onProgress?.(60)

  const sheets: Sheet[] = wb.SheetNames.map((name: string, si: number) => {
    const ws = wb.Sheets[name]
    const sheet = createEmptySheet(name)
    const ref = ws['!ref']
    const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }
    const merges: MergeCell[] = (ws['!merges'] || []).map((m: any) => ({
      startRow: m.s.r, startCol: m.s.c, endRow: m.e.r, endCol: m.e.c,
    }))
    sheet.merges = merges

    if (ws['!rows']) {
      ws['!rows'].forEach((r: any, i: number) => {
        if (r?.hpx) sheet.rowHeights.set(i, r.hpx)
        else if (r?.hpt) sheet.rowHeights.set(i, r.hpt * 1.33)
      })
    }
    if (ws['!cols']) {
      ws['!cols'].forEach((c: any, i: number) => {
        if (c?.wpx) sheet.colWidths.set(i, c.wpx)
        else if (c?.wpt) sheet.colWidths.set(i, c.wpt * 1.33)
      })
    }
    if (ws['!freeze']) {
      sheet.freezePane = { row: ws['!freeze'].y || 0, col: ws['!freeze'].x || 0 }
    }
    if (ws['!autofilter']) {
      const af = ws['!autofilter']
      sheet.filter = { startRow: af.ref?.s?.r || 0, startCol: af.ref?.s?.c || 0, endRow: af.ref?.e?.r || 0, endCol: af.ref?.e?.c || 0 }
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) continue
        const data: CellData = {
          value: cell.w !== undefined ? cell.w : (cell.v !== undefined ? cell.v : ''),
          type: cell.t ? sheetJSTypeToCellType(cell.t, cell.v) : 'text',
          style: sheetJSStyleToStyle(cell.s),
        }
        if (cell.f && cell.f.startsWith('=')) {
          data.formula = cell.f.substring(1)
          data.type = 'formula'
        } else if (cell.f) {
          data.formula = cell.f
          data.type = 'formula'
        }
        if (cell.t === 'e') data.value = `#${cell.w || 'ERROR'}`
        sheet.data.set(addr, data)
      }
    }

    onProgress?.(60 + (si + 1) / wb.SheetNames.length * 35)
    return sheet
  })

  onProgress?.(100)
  return {
    name: file.name,
    sheets,
    activeSheet: 0,
    created: new Date(),
    modified: new Date(),
  }
}

export async function saveWorkbookToXLSX(workbook: Workbook): Promise<ArrayBuffer> {
  const XLSX = await getSheetJS()
  const wb = XLSX.utils.book_new()

  for (const sheet of workbook.sheets) {
    const ws: any = {}
    const refs: string[] = []

    for (const [ref, cell] of sheet.data) {
      if (cell.formula && cell.type === 'formula') {
        ws[ref] = { f: cell.formula }
      } else if (cell.value !== null && cell.value !== '') {
        ws[ref] = { v: cell.value, t: cellTypeToSheetJS(cell.type) }
      }
      refs.push(ref)
    }

    if (refs.length > 0) {
      const [r1, c1] = parseCellRef(refs[0]) || [0, 0]
      let maxR = r1, maxC = c1
      for (const r of refs) {
        const [rr, cc] = parseCellRef(r) || [0, 0]
        if (rr > maxR) maxR = rr
        if (cc > maxC) maxC = cc
      }
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
    }

    if (sheet.merges.length > 0) {
      ws['!merges'] = sheet.merges.map(m => ({
        s: { r: m.startRow, c: m.startCol },
        e: { r: m.endRow, c: m.endCol },
      }))
    }

    if (sheet.colWidths.size > 0) {
      ws['!cols'] = []
      const maxCol = Math.max(...Array.from(sheet.colWidths.keys()))
      for (let i = 0; i <= maxCol; i++) {
        const w = sheet.colWidths.get(i)
        ws['!cols'].push(w ? { wpx: w } : { wpx: DEFAULT_COL_WIDTH })
      }
    }

    if (sheet.freezePane) {
      ws['!freeze'] = { x: sheet.freezePane.col, y: sheet.freezePane.row }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function saveWorkbookToCSV(workbook: Workbook, sheetIndex: number = workbook.activeSheet): string {
  const sheet = workbook.sheets[sheetIndex]
  if (!sheet) return ''
  const rows = getSheetGridData(sheet)
  return Papa.unparse(rows)
}

export function getSheetGridData(sheet: Sheet): (string | number | boolean | null)[][] {
  let maxRow = 0
  let maxCol = 0
  for (const ref of sheet.data.keys()) {
    const [r, c] = parseCellRef(ref) || [0, 0]
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }
  const grid: (string | number | boolean | null)[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: (string | number | boolean | null)[] = []
    for (let c = 0; c <= maxCol; c++) {
      const ref = cellRef(r, c)
      const cell = sheet.data.get(ref)
      if (cell?.type === 'formula' && cell.formula) {
        row.push(evaluateFormula(cell.formula, sheet.data, ref))
      } else {
        row.push(cell?.value ?? null)
      }
    }
    grid.push(row)
  }
  return grid
}

function cellTypeToSheetJS(type: CellData['type']): string {
  if (type === 'number') return 'n'
  if (type === 'boolean') return 'b'
  if (type === 'date') return 'd'
  if (type === 'error') return 'e'
  return 's'
}


