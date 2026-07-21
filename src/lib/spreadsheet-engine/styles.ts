import type { CellStyle } from './types'

export const DEFAULT_STYLE: CellStyle = {
  fontFamily: 'Calibri, sans-serif',
  fontSize: 11,
  fontColor: '#E6EDF3',
  align: 'left',
  verticalAlign: 'bottom',
  textWrap: false,
}

export const NUMBER_FORMATS: Record<string, string> = {
  'General': '',
  'Number': '#,##0.00',
  'Currency': '$#,##0.00',
  'Accounting': '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)',
  'Date': 'mm/dd/yyyy',
  'Time': 'h:mm:ss AM/PM',
  'Percentage': '0.00%',
  'Fraction': '# ?/?',
  'Scientific': '0.00E+00',
  'Text': '@',
}

export const COMMON_FONTS = [
  'Calibri', 'Arial', 'Times New Roman', 'Courier New',
  'Verdana', 'Georgia', 'Helvetica', 'Segoe UI',
  'Consolas', 'Tahoma',
]

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

export const THEME_COLORS = {
  white: '#ffffff',
  black: '#000000',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  pink: '#FF2D55',
  brown: '#A2845E',
  gray1: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  darkBg: '#0D1117',
  cardBg: '#161B22',
  mutedBg: '#1C2128',
  border: '#30363D',
  foreground: '#E6EDF3',
}

export function mergeStyles(base: CellStyle, override: Partial<CellStyle>): CellStyle {
  return { ...base, ...override }
}

export function styleToString(s: CellStyle): string {
  const parts: string[] = []
  if (s.bold) parts.push('bold')
  if (s.italic) parts.push('italic')
  if (s.underline) parts.push('underline')
  if (s.fontFamily) parts.push(s.fontFamily)
  if (s.fontSize) parts.push(`${s.fontSize}pt`)
  return parts.join(' ') || 'Normal'
}
