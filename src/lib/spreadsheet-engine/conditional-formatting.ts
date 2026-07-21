import type { Sheet, CellData, ConditionalFormatRule, SelectionRange } from './types'
import { cellRef, parseCellRef, isInRange } from './types'

export function evaluateConditionalFormat(sheet: Sheet, ref: string, rules: ConditionalFormatRule[]): ConditionalFormatRule | null {
  const cell = sheet.data.get(ref)
  if (!cell) return null
  const [row, col] = parseCellRef(ref) || [0, 0]

  for (const rule of rules) {
    if (rule.range && !isInRange(row, col, rule.range)) continue
    const match = evaluateRule(cell, rule)
    if (match) return rule
  }
  return null
}

function evaluateRule(cell: CellData, rule: ConditionalFormatRule): boolean {
  const value = cell.value
  if (rule.type === 'cellValue' && rule.operator) {
    const v = typeof value === 'number' ? value : parseFloat(String(value))
    const v1 = typeof rule.value1 === 'number' ? rule.value1 : parseFloat(String(rule.value1 || '0'))
    const v2 = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2 || '0'))
    switch (rule.operator) {
      case 'greaterThan': return v > v1
      case 'lessThan': return v < v1
      case 'between': return v >= v1 && v <= v2
      case 'equal': return value === rule.value1
      case 'textContains': return String(value).toLowerCase().includes(String(rule.value1).toLowerCase())
      case 'textStartsWith': return String(value).toLowerCase().startsWith(String(rule.value1).toLowerCase())
      case 'textEndsWith': return String(value).toLowerCase().endsWith(String(rule.value1).toLowerCase())
    }
  }
  if (rule.type === 'formula' && rule.formula) {
    try {
      return !!new Function('value', rule.formula)(value)
    } catch { return false }
  }
  return false
}

export function createColorScale(value: number, min: number, mid: number | undefined, max: number, colors: { min: string; mid?: string; max: string }): string {
  if (max === min) return colors.max
  const ratio = (value - min) / (max - min)
  if (colors.mid && ratio < 0.5) {
    return interpolateColor(colors.min, colors.mid, ratio * 2)
  } else if (colors.mid) {
    return interpolateColor(colors.mid, colors.max, (ratio - 0.5) * 2)
  }
  return interpolateColor(colors.min, colors.max, ratio)
}

function interpolateColor(from: string, to: string, ratio: number): string {
  const f = hexToRgb(from)
  const t = hexToRgb(to)
  const r = Math.round(f.r + (t.r - f.r) * ratio)
  const g = Math.round(f.g + (t.g - f.g) * ratio)
  const b = Math.round(f.b + (t.b - f.b) * ratio)
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 }
}
