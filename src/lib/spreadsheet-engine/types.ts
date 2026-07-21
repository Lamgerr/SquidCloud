export type CellType = 'text' | 'number' | 'formula' | 'date' | 'boolean' | 'error'

export type HorizontalAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontFamily?: string
  fontSize?: number
  fontColor?: string
  fillColor?: string
  numberFormat?: string
  align?: HorizontalAlign
  verticalAlign?: VerticalAlign
  borderTop?: string
  borderBottom?: string
  borderLeft?: string
  borderRight?: string
  textWrap?: boolean
}

export interface CellData {
  value: string | number | boolean | null
  formula?: string
  type: CellType
  style?: CellStyle
  validation?: DataValidation
}

export type CellMap = Map<string, CellData>

export interface MergeCell {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface FreezePane {
  row: number
  col: number
}

export interface AutoFilter {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface Sheet {
  id: string
  name: string
  data: CellMap
  colWidths: Map<number, number>
  rowHeights: Map<number, number>
  merges: MergeCell[]
  freezePane?: FreezePane
  filter?: AutoFilter
  tabColor?: string
  hidden?: boolean
}

export interface Workbook {
  name: string
  sheets: Sheet[]
  activeSheet: number
  creator?: string
  created?: Date
  modified?: Date
}

export const DEFAULT_COL_WIDTH = 100
export const DEFAULT_ROW_HEIGHT = 28
export const MAX_ROWS = 1_048_576
export const MAX_COLS = 16_384
export const MAX_COL_LETTER = 'XFD'

export type SelectionType = 'cell' | 'range' | 'row' | 'col'

export interface SelectionRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface Selection {
  type: SelectionType
  activeCell: string
  ranges: SelectionRange[]
  editing?: boolean
  editValue?: string
}

export interface DataValidation {
  type: 'list' | 'number' | 'date' | 'textLength' | 'custom'
  operator?: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  formula1?: string
  formula2?: string
  listValues?: string[]
  allowBlank?: boolean
  showInputMessage?: boolean
  inputTitle?: string
  inputMessage?: string
  showErrorMessage?: boolean
  errorTitle?: string
  errorMessage?: string
  errorStyle?: 'stop' | 'warning' | 'information'
}

export interface ConditionalFormatRule {
  type: 'cellValue' | 'colorScale' | 'dataBar' | 'iconSet' | 'formula'
  priority: number
  range?: SelectionRange
  // cellValue
  operator?: 'greaterThan' | 'lessThan' | 'between' | 'equal' | 'textContains' | 'textStartsWith' | 'textEndsWith'
  value1?: string | number
  value2?: string | number
  // colorScale
  colorScale?: ColorScale
  // dataBar
  dataBar?: DataBar
  // iconSet
  iconSet?: IconSet
  // formula
  formula?: string
  // style to apply
  style?: CellStyle
}

export interface ColorScale {
  minColor: string
  midColor?: string
  maxColor: string
  minValue?: number
  midValue?: number
  maxValue?: number
}

export interface DataBar {
  color: string
  minLength?: number
  maxLength?: number
  showValue?: boolean
}

export interface IconSet {
  icons: string[]
  values: number[]
  reverse?: boolean
}

export interface Macro {
  name: string
  shortcut?: string
  description?: string
  operations: MacroOperation[]
}

export type MacroOperation =
  | { type: 'setCell'; ref: string; value: string | number | boolean | null; formula?: string }
  | { type: 'setStyle'; ref: string; style: Partial<CellStyle> }
  | { type: 'insertRow'; row: number; count: number }
  | { type: 'insertCol'; col: number; count: number }
  | { type: 'deleteRow'; row: number; count: number }
  | { type: 'deleteCol'; col: number; count: number }
  | { type: 'sort'; range: SelectionRange; column: number; direction: 'asc' | 'desc' }
  | { type: 'merge'; range: SelectionRange }
  | { type: 'unmerge'; range: SelectionRange }

export interface HistoryEntry {
  timestamp: number
  description: string
  undo: () => void
  redo: () => void
}

export interface PivotTable {
  name: string
  sourceRange: SelectionRange
  rows: string[]
  columns: string[]
  values: { field: string; aggregation: 'sum' | 'count' | 'average' | 'min' | 'max' | 'distinctCount' }[]
  filters: { field: string; value: string }[]
}

export interface ChartConfig {
  type: 'bar' | 'column' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'area'
  title?: string
  sourceRange?: SelectionRange
  dataRows?: (string | number)[][]
  categories?: string[]
  showLegend?: boolean
  showLabels?: boolean
  color?: string
}

export function cellRef(row: number, col: number): string {
  let c = ''
  let n = col
  while (n >= 0) {
    c = String.fromCharCode(65 + (n % 26)) + c
    n = Math.floor(n / 26) - 1
  }
  return c + (row + 1)
}

export function parseCellRef(ref: string): [number, number] | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let col = 0
  for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64)
  return [parseInt(m[2]) - 1, col - 1]
}

export function rangeToString(r: SelectionRange): string {
  return `${cellRef(r.startRow, r.startCol)}:${cellRef(r.endRow, r.endCol)}`
}

export function isInRange(row: number, col: number, range: SelectionRange): boolean {
  return row >= range.startRow && row <= range.endRow && col >= range.startCol && col <= range.endCol
}

export function expandRangeToCell(range: SelectionRange, row: number, col: number): SelectionRange {
  return {
    startRow: Math.min(range.startRow, row),
    startCol: Math.min(range.startCol, col),
    endRow: Math.max(range.endRow, row),
    endCol: Math.max(range.endCol, col),
  }
}

export function getMergedCell(row: number, col: number, merges: MergeCell[]): MergeCell | null {
  return merges.find(m => row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) || null
}

export function cloneCellData(cell: CellData | undefined): CellData {
  if (!cell) return { value: null, type: 'text' }
  return {
    value: cell.value,
    formula: cell.formula,
    type: cell.type,
    style: cell.style ? { ...cell.style } : undefined,
    validation: cell.validation ? { ...cell.validation } : undefined,
  }
}
