import { parseCellRef, cellRef, isInRange, type CellMap, type SelectionRange } from './types'

type Value = string | number | boolean | null

function resolveRange(rangeStr: string, contextRef: string, data: CellMap): number[] {
  const parts = rangeStr.split(':')
  if (parts.length === 2) {
    const a = parseCellRef(parts[0])
    const b = parseCellRef(parts[1])
    if (a && b) {
      const out: number[] = []
      for (let r = Math.min(a[0], b[0]); r <= Math.max(a[0], b[0]); r++) {
        for (let c = Math.min(a[1], b[1]); c <= Math.max(a[1], b[1]); c++) {
          const v = getCellValue(cellRef(r, c), data)
          if (typeof v === 'number') out.push(v)
        }
      }
      return out
    }
  }
  const ref = parts[0]
  if (ref) {
    const v = getCellValue(ref, data)
    if (typeof v === 'number') return [v]
    if (ref.includes(':')) return []
    const [rf, cf] = parseCellRef(ref) || [0, 0]
    const [rr, cr] = parseCellRef(contextRef) || [0, 0]
    const resolved = cellRef(rr + rf, cr + cf)
    const val = getCellValue(resolved, data)
    if (typeof val === 'number') return [val]
  }
  return []
}

function resolveRangeOrValue(v: Value, rangeStr: string, ctx: string, data: CellMap): (number | string | boolean | null)[] {
  if (rangeStr.includes(':')) {
    const parts = rangeStr.split(':')
    const a = parseCellRef(parts[0])
    const b = parseCellRef(parts[1])
    if (a && b) {
      const out: (number | string | boolean | null)[] = []
      for (let r = Math.min(a[0], b[0]); r <= Math.max(a[0], b[0]); r++) {
        for (let c = Math.min(a[1], b[1]); c <= Math.max(a[1], b[1]); c++) {
          out.push(getCellValue(cellRef(r, c), data))
        }
      }
      return out
    }
  }
  const ref = rangeStr
  const [rf, cf] = parseCellRef(ref) || [0, 0]
  const [rr, cr] = parseCellRef(ctx) || [0, 0]
  const resolved = cellRef(rr + rf, cr + cf)
  return [getCellValue(resolved, data)]
}

function getCellValue(ref: string, data: CellMap): Value {
  const cell = data.get(ref)
  if (!cell) return null
  if (cell.type === 'formula' && cell.formula) {
    return evaluateFormula(cell.formula, data, ref)
  }
  return cell.value
}

type FuncFn = (...args: Value[]) => Value

const FUNCTIONS: Record<string, FuncFn> = {
  // Math
  SUM: (...args) => {
    let s = 0
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') s += v } else if (typeof a === 'number') s += a }
    return s
  },
  SUMIF: (range: any, criteria: any, sumRange?: any) => {
    const arr = Array.isArray(range) ? range : [range]
    const sums = Array.isArray(sumRange) ? sumRange : arr
    let s = 0
    for (let i = 0; i < arr.length; i++) {
      const match = typeof criteria === 'string' && criteria.startsWith('>') ? Number(arr[i]) > Number(criteria.substring(1)) :
        typeof criteria === 'string' && criteria.startsWith('<') ? Number(arr[i]) < Number(criteria.substring(1)) :
        arr[i] === criteria
      if (match) s += Number(sums[i] ?? 0)
    }
    return s
  },
  SUMIFS: (...args: any[]) => {
    const sumRange = Array.isArray(args[0]) ? args[0] : [args[0]]
    let s = 0
    for (let i = 0; i < sumRange.length; i++) {
      let match = true
      for (let j = 1; j < args.length; j += 2) {
        const r = Array.isArray(args[j]) ? args[j] : [args[j]]
        const c = args[j + 1]
        const v = r[i]
        const ok = typeof c === 'string' && c.startsWith('>') ? Number(v) > Number(c.substring(1)) :
          typeof c === 'string' && c.startsWith('<') ? Number(v) < Number(c.substring(1)) :
          v === c
        if (!ok) { match = false; break }
      }
      if (match) s += Number(sumRange[i] ?? 0)
    }
    return s
  },
  SUMPRODUCT: (...args: any[]) => {
    const arrays = args.map(a => Array.isArray(a) ? a : [a])
    let s = 0
    for (let i = 0; i < arrays[0].length; i++) {
      let p = 1
      for (const arr of arrays) p *= Number(arr[i] ?? 0)
      s += p
    }
    return s
  },
  AVERAGE: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  },
  AVERAGEIF: (range: any, criteria: any, avgRange?: any) => {
    const arr = Array.isArray(range) ? range : [range]
    const avgs = Array.isArray(avgRange) ? avgRange : arr
    let s = 0, c = 0
    for (let i = 0; i < arr.length; i++) {
      const match = typeof criteria === 'string' && criteria.startsWith('>') ? Number(arr[i]) > Number(criteria.substring(1)) :
        typeof criteria === 'string' && criteria.startsWith('<') ? Number(arr[i]) < Number(criteria.substring(1)) :
        arr[i] === criteria
      if (match) { s += Number(avgs[i] ?? 0); c++ }
    }
    return c ? s / c : 0
  },
  COUNT: (...args) => {
    let c = 0
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') c++ } else if (typeof a === 'number') c++ }
    return c
  },
  COUNTA: (...args) => {
    let c = 0
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (v !== null && v !== '') c++ } else if (a !== null && a !== '') c++ }
    return c
  },
  COUNTIF: (range: any, criteria: any) => {
    const arr = Array.isArray(range) ? range : [range]
    let c = 0
    for (const v of arr) {
      const match = typeof criteria === 'string' && criteria.startsWith('>') ? Number(v) > Number(criteria.substring(1)) :
        typeof criteria === 'string' && criteria.startsWith('<') ? Number(v) < Number(criteria.substring(1)) :
        v === criteria
      if (match) c++
    }
    return c
  },
  MAX: (...args) => {
    let m = -Infinity
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number' && v > m) m = v } else if (typeof a === 'number' && a > m) m = a }
    return m === -Infinity ? 0 : m
  },
  MIN: (...args) => {
    let m = Infinity
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number' && v < m) m = v } else if (typeof a === 'number' && a < m) m = a }
    return m === Infinity ? 0 : m
  },
  MEDIAN: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    vals.sort((a, b) => a - b)
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  },
  MODE: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    const freq = new Map<number, number>()
    let maxFreq = 0, mode = NaN
    for (const v of vals) {
      const f = (freq.get(v) || 0) + 1
      freq.set(v, f)
      if (f > maxFreq) { maxFreq = f; mode = v }
    }
    return maxFreq > 1 ? mode : NaN
  },
  ROUND: (val: any, digits: any) => {
    const d = Number(digits) || 0
    const m = Math.pow(10, d)
    return Math.round(Number(val) * m) / m
  },
  ROUNDUP: (val: any, digits: any) => {
    const d = Number(digits) || 0
    const m = Math.pow(10, d)
    return Math.ceil(Number(val) * m) / m
  },
  ROUNDDOWN: (val: any, digits: any) => {
    const d = Number(digits) || 0
    const m = Math.pow(10, d)
    return Math.floor(Number(val) * m) / m
  },
  ABS: (v: any) => Math.abs(Number(v)),
  CEILING: (v: any, significance: any) => Math.ceil(Number(v) / Number(significance || 1)) * Number(significance || 1),
  FLOOR: (v: any, significance: any) => Math.floor(Number(v) / Number(significance || 1)) * Number(significance || 1),
  INT: (v: any) => Math.floor(Number(v)),
  MOD: (v: any, divisor: any) => Number(v) % Number(divisor),
  POWER: (base: any, exp: any) => Math.pow(Number(base), Number(exp)),
  SQRT: (v: any) => Math.sqrt(Number(v)),
  PRODUCT: (...args) => {
    let p = 1
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') p *= v } else if (typeof a === 'number') p *= a }
    return p
  },
  FACT: (v: any) => {
    const n = Number(v)
    if (n <= 1) return 1
    let r = 1
    for (let i = 2; i <= n; i++) r *= i
    return r
  },
  SUMSQ: (...args) => {
    let s = 0
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') s += v * v } else if (typeof a === 'number') s += a * a }
    return s
  },
  RAND: () => Math.random(),
  RANDBETWEEN: (min: any, max: any) => Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min),
  PI: () => Math.PI,
  SIN: (v: any) => Math.sin(Number(v)),
  COS: (v: any) => Math.cos(Number(v)),
  TAN: (v: any) => Math.tan(Number(v)),
  RADIANS: (v: any) => Number(v) * Math.PI / 180,
  DEGREES: (v: any) => Number(v) * 180 / Math.PI,

  // Logic
  IF: (cond: any, tVal: any, fVal: any) => cond ? tVal : fVal,
  IFS: (...args: any[]) => {
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i]) return args[i + 1]
    }
    return null
  },
  IFERROR: (val: any, fallback: any) => {
    if (val === null || val === undefined || (typeof val === 'number' && isNaN(val)) || val === '#ERROR') return fallback
    if (typeof val === 'string' && val.startsWith('#')) return fallback
    return val
  },
  IFNA: (val: any, fallback: any) => (val === null || val === '#N/A') ? fallback : val,
  AND: (...args) => {
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (!v) return false } else if (!a) return false }
    return true
  },
  OR: (...args) => {
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (v) return true } else if (a) return true }
    return false
  },
  NOT: (v: any) => !v,
  XOR: (...args) => {
    let t = 0
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (v) t++ } else if (a) t++ }
    return t % 2 === 1
  },
  TRUE: () => true,
  FALSE: () => false,
  SWITCH: (expr: any, ...args: any[]) => {
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i] === expr) return args[i + 1]
    }
    return args.length % 2 ? args[args.length - 1] : null
  },
  CHOOSE: (index: any, ...args: any[]) => args[Number(index) - 1] || null,

  // Lookup
  VLOOKUP: (lookupVal: any, tableArray: any[], colIndex: any, rangeLookup?: any) => {
    if (!Array.isArray(tableArray)) return '#N/A'
    const ci = Number(colIndex) - 1
    if (rangeLookup === false || rangeLookup === 0) {
      for (const row of tableArray) {
        if (Array.isArray(row) && row[0] === lookupVal) return row[ci] ?? '#N/A'
      }
    } else {
      for (const row of tableArray) {
        if (Array.isArray(row) && String(row[0]).toLowerCase() === String(lookupVal).toLowerCase()) return row[ci] ?? '#N/A'
      }
    }
    return '#N/A'
  },
  HLOOKUP: (lookupVal: any, tableArray: any[], rowIndex: any, rangeLookup?: any) => {
    if (!Array.isArray(tableArray)) return '#N/A'
    for (const row of tableArray) {
      if (Array.isArray(row) && row[0] === lookupVal) {
        const ri = Number(rowIndex) - 1
        if (ri < tableArray.length) {
          const arr = Array.isArray(tableArray[ri]) ? tableArray[ri] : [tableArray[ri]]
          return arr[0] ?? '#N/A'
        }
      }
    }
    return '#N/A'
  },
  INDEX: (array: any, rowNum: any, colNum?: any) => {
    if (!Array.isArray(array)) return '#VALUE!'
    const r = Number(rowNum) - 1
    if (colNum !== undefined) {
      const c = Number(colNum) - 1
      const row = array[r]
      return Array.isArray(row) ? row[c] : row
    }
    return array[r]
  },
  MATCH: (lookupVal: any, lookupArray: any[], matchType?: any) => {
    if (!Array.isArray(lookupArray)) return '#N/A'
    const mt = matchType === undefined ? 1 : Number(matchType)
    if (mt === 0) {
      for (let i = 0; i < lookupArray.length; i++) {
        if (lookupArray[i] === lookupVal) return i + 1
      }
    } else {
      for (let i = 0; i < lookupArray.length; i++) {
        if (String(lookupArray[i]).toLowerCase() === String(lookupVal).toLowerCase()) return i + 1
      }
    }
    return '#N/A'
  },
  COLUMN: (ref?: any) => {
    if (typeof ref === 'string') { const p = parseCellRef(ref); return p ? p[1] + 1 : '#VALUE!' }
    return '#VALUE!'
  },
  COLUMNS: (array: any) => Array.isArray(array) ? (Array.isArray(array[0]) ? array[0].length : 1) : '#VALUE!',
  ROW: (ref?: any) => {
    if (typeof ref === 'string') { const p = parseCellRef(ref); return p ? p[0] + 1 : '#VALUE!' }
    return '#VALUE!'
  },
  ROWS: (array: any) => Array.isArray(array) ? array.length : '#VALUE!',

  // Text
  CONCATENATE: (...args) => args.map(a => String(a ?? '')).join(''),
  CONCAT: (...args) => args.map(a => String(a ?? '')).join(''),
  LEFT: (text: any, chars?: any) => String(text).substring(0, Number(chars || 1)),
  RIGHT: (text: any, chars?: any) => {
    const t = String(text)
    return t.substring(t.length - Number(chars || 1))
  },
  MID: (text: any, start: any, chars: any) => String(text).substring(Number(start) - 1, Number(start) - 1 + Number(chars)),
  LEN: (text: any) => String(text).length,
  FIND: (findText: any, withinText: any, startNum?: any) => {
    const s = Number(startNum || 1) - 1
    const idx = String(withinText).indexOf(String(findText), s)
    return idx >= 0 ? idx + 1 : '#VALUE!'
  },
  SEARCH: (findText: any, withinText: any, startNum?: any) => {
    const s = Number(startNum || 1) - 1
    const idx = String(withinText).toLowerCase().indexOf(String(findText).toLowerCase(), s)
    return idx >= 0 ? idx + 1 : '#VALUE!'
  },
  REPLACE: (oldText: any, start: any, chars: any, newText: any) => {
    const t = String(oldText)
    const s = Number(start) - 1
    return t.substring(0, s) + String(newText) + t.substring(s + Number(chars))
  },
  SUBSTITUTE: (text: any, oldText: any, newText: any, instance?: any) => {
    const t = String(text)
    const from = String(oldText)
    const to = String(newText)
    if (instance !== undefined) {
      const n = Number(instance)
      let i = 0
      return t.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), m => (++i === n ? to : m))
    }
    return t.split(from).join(to)
  },
  TEXTJOIN: (delimiter: any, skipEmpty: any, ...args: any[]) => {
    const d = String(delimiter || '')
    const se = !!skipEmpty
    const parts: string[] = []
    for (const a of args) {
      if (Array.isArray(a)) {
        for (const v of a) {
          if (se && (v === null || v === '')) continue
          parts.push(String(v ?? ''))
        }
      } else {
        if (se && (a === null || a === '')) continue
        parts.push(String(a ?? ''))
      }
    }
    return parts.join(d)
  },
  TRIM: (text: any) => String(text).trim().replace(/\s+/g, ' '),
  LOWER: (text: any) => String(text).toLowerCase(),
  UPPER: (text: any) => String(text).toUpperCase(),
  PROPER: (text: any) => String(text).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase()),
  VALUE: (text: any) => {
    const v = Number(String(text).replace(/[^0-9.\-]/g, ''))
    return isNaN(v) ? '#VALUE!' : v
  },
  TEXT: (val: any, format: any) => String(val),
  REPT: (text: any, times: any) => String(text).repeat(Number(times)),
  CLEAN: (text: any) => String(text).replace(/[\x00-\x1F\x7F]/g, ''),
  CHAR: (code: any) => String.fromCharCode(Number(code)),
  CODE: (text: any) => String(text).charCodeAt(0),
  EXACT: (a: any, b: any) => String(a) === String(b),
  T: (v: any) => typeof v === 'string' ? v : '',
  N: (v: any) => typeof v === 'number' ? v : 0,

  // Date
  TODAY: () => new Date(),
  NOW: () => new Date(),
  YEAR: (d: any) => new Date(d).getFullYear(),
  MONTH: (d: any) => new Date(d).getMonth() + 1,
  DAY: (d: any) => new Date(d).getDate(),
  HOUR: (d: any) => new Date(d).getHours(),
  MINUTE: (d: any) => new Date(d).getMinutes(),
  SECOND: (d: any) => new Date(d).getSeconds(),
  DATE: (y: any, m: any, d: any) => new Date(Number(y), Number(m) - 1, Number(d)),
  TIME: (h: any, m: any, s: any) => new Date(0, 0, 0, Number(h), Number(m), Number(s)),
  WEEKDAY: (d: any, retType?: any) => {
    const wd = new Date(d).getDay()
    return retType === 2 ? (wd === 0 ? 7 : wd) : wd + 1
  },
  WEEKNUM: (d: any) => {
    const date = new Date(d)
    const start = new Date(date.getFullYear(), 0, 1)
    return Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  },
  EOMONTH: (d: any, months: any) => {
    const date = new Date(d)
    date.setMonth(date.getMonth() + Number(months) + 1, 0)
    return date
  },
  EDATE: (d: any, months: any) => {
    const date = new Date(d)
    date.setMonth(date.getMonth() + Number(months))
    return date
  },
  DATEDIF: (start: any, end: any, unit: any) => {
    const s = new Date(start), e = new Date(end)
    const u = String(unit).toUpperCase()
    if (u === 'Y') return e.getFullYear() - s.getFullYear()
    if (u === 'M') return (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth()
    if (u === 'D') return Math.floor((e.getTime() - s.getTime()) / 86400000)
    if (u === 'MD') return e.getDate() - s.getDate()
    if (u === 'YM') return e.getMonth() - s.getMonth()
    if (u === 'YD') return Math.floor((e.getTime() - new Date(e.getFullYear(), s.getMonth(), s.getDate()).getTime()) / 86400000) % 365
    return 0
  },
  WORKDAY: (start: any, days: any) => {
    const d = new Date(start)
    let remaining = Number(days)
    while (remaining > 0) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
    }
    return d
  },
  NETWORKDAYS: (start: any, end: any) => {
    const s = new Date(start), e = new Date(end)
    let days = 0
    const d = new Date(s)
    while (d <= e) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days++
      d.setDate(d.getDate() + 1)
    }
    return days
  },
  DATEVALUE: (d: any) => new Date(d).getTime(),
  TIMEVALUE: (d: any) => new Date(d).getHours() * 3600 + new Date(d).getMinutes() * 60 + new Date(d).getSeconds(),

  // Statistical
  STDEV: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    if (vals.length < 2) return '#DIV/0!'
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    return Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / (vals.length - 1))
  },
  VAR: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    if (vals.length < 2) return '#DIV/0!'
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    return vals.reduce((s, v) => s + (v - avg) ** 2, 0) / (vals.length - 1)
  },
  STDEVP: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    if (vals.length === 0) return '#DIV/0!'
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    return Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)
  },
  VARP: (...args) => {
    const vals: number[] = []
    for (const a of args) { if (Array.isArray(a)) { for (const v of a) if (typeof v === 'number') vals.push(v) } else if (typeof a === 'number') vals.push(a) }
    if (vals.length === 0) return '#DIV/0!'
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    return vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length
  },
  FORECAST: (x: any, knownYs: any, knownXs: any) => {
    const ys = Array.isArray(knownYs) ? knownYs.map(Number) : [Number(knownYs)]
    const xs = Array.isArray(knownXs) ? knownXs.map(Number) : [Number(knownXs)]
    const n = Math.min(ys.length, xs.length)
    if (n < 2) return '#DIV/0!'
    const sx = xs.reduce((a, b) => a + b, 0)
    const sy = ys.reduce((a, b) => a + b, 0)
    const sxx = xs.reduce((a, b) => a + b * b, 0)
    const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0)
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    const a = (sy - b * sx) / n
    return a + b * Number(x)
  },

  // Info
  ISNUMBER: (v: any) => typeof v === 'number',
  ISTEXT: (v: any) => typeof v === 'string',
  ISBLANK: (v: any) => v === null || v === '' || v === undefined,
  ISERROR: (v: any) => v === null || (typeof v === 'number' && isNaN(v)) || (typeof v === 'string' && v.startsWith('#')),
  ISNA: (v: any) => v === '#N/A',
  TYPE: (v: any) => typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 4,
  NA: () => '#N/A',
  ERROR_TYPE: (v: any) => {
    const map: Record<string, number> = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7, '#ERROR': 8 }
    return map[String(v)] || '#N/A'
  },
}

type TokenType = 'num' | 'str' | 'bool' | 'ref' | 'range' | 'op' | 'func' | 'paren' | 'comma' | 'ws'

interface Token {
  type: TokenType
  value: string
}

const OPS = '+-*/^%&<>=!'
const OP2 = ['<=', '>=', '<>', '!=']

function tokenize(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < formula.length) {
    const ch = formula[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch === ',' || ch === ';') { tokens.push({ type: 'comma', value: ch }); i++; continue }
    if (ch === '(') { tokens.push({ type: 'paren', value: '(' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'paren', value: ')' }); i++; continue }
    if (ch === '"') {
      let s = ''
      i++
      while (i < formula.length && formula[i] !== '"') {
        if (formula[i] === '\\') { i++; if (i < formula.length) s += formula[i] }
        else s += formula[i]
        i++
      }
      i++ // closing quote
      tokens.push({ type: 'str', value: s })
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let s = ''
      while (i < formula.length && /[0-9.eE+\-]/.test(formula[i])) { s += formula[i]; i++ }
      tokens.push({ type: 'num', value: s })
      continue
    }
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_' || ch === '@') {
      let s = ''
      while (i < formula.length && /[A-Za-z0-9._]/.test(formula[i])) { s += formula[i]; i++ }
      const upper = s.toUpperCase()
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'bool', value: upper })
      } else if (s.match(/^[A-Z]+[0-9]+$/i)) {
        tokens.push({ type: 'ref', value: s.toUpperCase() })
      } else if (FUNCTIONS[upper] !== undefined) {
        tokens.push({ type: 'func', value: upper })
      } else {
        tokens.push({ type: 'ref', value: s.toUpperCase() })
      }
      continue
    }
    if (OPS.includes(ch)) {
      const two = ch + (formula[i + 1] || '')
      if (OP2.includes(two)) { tokens.push({ type: 'op', value: two }); i += 2; continue }
      tokens.push({ type: 'op', value: ch }); i++; continue
    }
    // skip unknown
    i++
  }
  return tokens
}

function shuntingYard(tokens: Token[]): Token[] {
  const out: Token[] = []
  const ops: Token[] = []
  const prec: Record<string, number> = { '&': 2, '<': 3, '>': 3, '<=': 3, '>=': 3, '<>': 3, '!=': 3, '=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '^': 6, '%': 7 }
  for (const tok of tokens) {
    if (tok.type === 'num' || tok.type === 'str' || tok.type === 'bool' || tok.type === 'ref' || tok.type === 'range') {
      out.push(tok)
    } else if (tok.type === 'func') {
      ops.push(tok)
    } else if (tok.type === 'comma') {
      while (ops.length && ops[ops.length - 1].type !== 'paren' && ops[ops.length - 1].value !== '(') out.push(ops.pop()!)
    } else if (tok.type === 'paren') {
      if (tok.value === '(') ops.push(tok)
      else {
        while (ops.length && (ops[ops.length - 1].type !== 'paren' || ops[ops.length - 1].value !== '(')) out.push(ops.pop()!)
        ops.pop() // remove (
        if (ops.length && ops[ops.length - 1].type === 'func') out.push(ops.pop()!)
      }
    } else if (tok.type === 'op') {
      while (ops.length && ops[ops.length - 1].type === 'op' && (prec[ops[ops.length - 1].value] || 0) >= (prec[tok.value] || 0)) out.push(ops.pop()!)
      ops.push(tok)
    }
  }
  while (ops.length) out.push(ops.pop()!)
  return out
}

function evaluateRPN(tokens: Token[], data: CellMap, contextRef: string): Value {
  const stack: (Value | Value[])[] = []
  for (const tok of tokens) {
    if (tok.type === 'num') {
      stack.push(parseFloat(tok.value))
    } else if (tok.type === 'str') {
      stack.push(tok.value)
    } else if (tok.type === 'bool') {
      stack.push(tok.value === 'TRUE')
    } else if (tok.type === 'ref') {
      const v = getCellValue(tok.value, data)
      stack.push(v !== null && v !== undefined ? v : 0)
    } else if (tok.type === 'range') {
      stack.push(resolveRangeOrValue(null, tok.value, contextRef, data))
    } else if (tok.type === 'func') {
      const args: Value[] = []
      const n = FUNCTIONS[tok.value]?.length || 0
      for (let i = 0; i < (n || stack.length); i++) {
        if (stack.length) {
          const a = stack.pop()
          args.unshift(a as Value)
        }
      }
      if (FUNCTIONS[tok.value]) {
        try {
          const result = FUNCTIONS[tok.value](...args)
          stack.push(result ?? null)
        } catch { stack.push('#ERROR') }
      } else {
        stack.push('#NAME?')
      }
    } else if (tok.type === 'op') {
      const b = stack.pop() as Value
      const a = stack.pop() as Value
      const na = Number(a), nb = Number(b)
      let result: Value = 0
      switch (tok.value) {
        case '+': result = na + nb; break
        case '-': result = na - nb; break
        case '*': result = na * nb; break
        case '/': result = nb === 0 ? '#DIV/0!' : na / nb; break
        case '^': result = Math.pow(na, nb); break
        case '%': result = na % nb; break
        case '&': result = String(a ?? '') + String(b ?? ''); break
        case '<': result = na < nb; break
        case '>': result = na > nb; break
        case '<=': result = na <= nb; break
        case '>=': result = na >= nb; break
        case '<>': result = a !== b; break
        case '!=': result = a !== b; break
        case '=': result = a === b; break
      }
      stack.push(result)
    }
  }
  const v = stack[stack.length - 1]
  return v instanceof Array ? v[0] ?? null : (v !== undefined ? v : null)
}

export function evaluateFormula(formula: string, data: CellMap, contextRef: string = 'A1'): Value {
  try {
    const tokens = tokenize(formula)
    const rpn = shuntingYard(tokens)
    return evaluateRPN(rpn, data, contextRef)
  } catch {
    return '#ERROR'
  }
}

export function getFunctionList(): { name: string; args: string; description: string }[] {
  return [
    { name: 'SUM', args: 'number1, [number2], ...', description: 'Adds all numbers in a range' },
    { name: 'SUMIF', args: 'range, criteria, [sum_range]', description: 'Sums cells based on a condition' },
    { name: 'SUMIFS', args: 'sum_range, criteria_range1, criteria1, ...', description: 'Sums cells based on multiple conditions' },
    { name: 'SUMPRODUCT', args: 'array1, [array2], ...', description: 'Multiplies arrays and sums the products' },
    { name: 'AVERAGE', args: 'number1, [number2], ...', description: 'Calculates the arithmetic mean' },
    { name: 'AVERAGEIF', args: 'range, criteria, [average_range]', description: 'Averages cells based on a condition' },
    { name: 'COUNT', args: 'value1, [value2], ...', description: 'Counts numeric values' },
    { name: 'COUNTA', args: 'value1, [value2], ...', description: 'Counts non-empty values' },
    { name: 'COUNTIF', args: 'range, criteria', description: 'Counts cells based on a condition' },
    { name: 'MAX', args: 'number1, [number2], ...', description: 'Returns the maximum value' },
    { name: 'MIN', args: 'number1, [number2], ...', description: 'Returns the minimum value' },
    { name: 'MEDIAN', args: 'number1, [number2], ...', description: 'Returns the median value' },
    { name: 'ROUND', args: 'number, num_digits', description: 'Rounds a number to specified digits' },
    { name: 'ABS', args: 'number', description: 'Returns the absolute value' },
    { name: 'IF', args: 'condition, value_if_true, value_if_false', description: 'Conditional evaluation' },
    { name: 'IFS', args: 'condition1, value1, ...', description: 'Multiple condition evaluation' },
    { name: 'IFERROR', args: 'value, fallback', description: 'Returns fallback if value is an error' },
    { name: 'AND', args: 'condition1, [condition2], ...', description: 'Returns TRUE if all conditions are true' },
    { name: 'OR', args: 'condition1, [condition2], ...', description: 'Returns TRUE if any condition is true' },
    { name: 'NOT', args: 'condition', description: 'Negates a condition' },
    { name: 'VLOOKUP', args: 'lookup_value, table, col_index, [range_lookup]', description: 'Vertical lookup' },
    { name: 'HLOOKUP', args: 'lookup_value, table, row_index, [range_lookup]', description: 'Horizontal lookup' },
    { name: 'INDEX', args: 'array, row_num, [col_num]', description: 'Returns a value from an array by index' },
    { name: 'MATCH', args: 'lookup_value, array, [match_type]', description: 'Returns the position of a value in an array' },
    { name: 'CONCATENATE', args: 'text1, [text2], ...', description: 'Joins text strings together' },
    { name: 'TEXTJOIN', args: 'delimiter, skip_empty, text1, ...', description: 'Joins text with a delimiter' },
    { name: 'TRIM', args: 'text', description: 'Removes extra spaces from text' },
    { name: 'LOWER', args: 'text', description: 'Converts text to lowercase' },
    { name: 'UPPER', args: 'text', description: 'Converts text to uppercase' },
    { name: 'PROPER', args: 'text', description: 'Capitalizes words' },
    { name: 'LEN', args: 'text', description: 'Returns the length of text' },
    { name: 'LEFT', args: 'text, [num_chars]', description: 'Returns leftmost characters' },
    { name: 'RIGHT', args: 'text, [num_chars]', description: 'Returns rightmost characters' },
    { name: 'MID', args: 'text, start, num_chars', description: 'Returns characters from the middle' },
    { name: 'TODAY', args: '', description: 'Returns the current date' },
    { name: 'NOW', args: '', description: 'Returns the current date and time' },
    { name: 'YEAR', args: 'date', description: 'Extracts the year from a date' },
    { name: 'MONTH', args: 'date', description: 'Extracts the month from a date' },
    { name: 'DAY', args: 'date', description: 'Extracts the day from a date' },
    { name: 'WEEKDAY', args: 'date, [return_type]', description: 'Returns the day of the week' },
    { name: 'DATEDIF', args: 'start, end, unit', description: 'Calculates the difference between dates' },
    { name: 'WORKDAY', args: 'start, days', description: 'Returns a date after working days' },
    { name: 'NETWORKDAYS', args: 'start, end', description: 'Counts working days between dates' },
    { name: 'VALUE', args: 'text', description: 'Converts text to a number' },
    { name: 'ISNUMBER', args: 'value', description: 'Checks if value is numeric' },
    { name: 'ISTEXT', args: 'value', description: 'Checks if value is text' },
    { name: 'ISBLANK', args: 'value', description: 'Checks if value is empty' },
    { name: 'ISERROR', args: 'value', description: 'Checks if value is an error' },
    { name: 'RAND', args: '', description: 'Returns a random number between 0 and 1' },
    { name: 'RANDBETWEEN', args: 'min, max', description: 'Returns a random number in a range' },
    { name: 'PI', args: '', description: 'Returns the value of PI' },
    { name: 'SWITCH', args: 'expression, value1, result1, ...', description: 'Evaluates expression against multiple values' },
    { name: 'CHOOSE', args: 'index, value1, [value2], ...', description: 'Returns a value from a list by index' },
    { name: 'STDEV', args: 'number1, [number2], ...', description: 'Estimates standard deviation based on a sample' },
    { name: 'VAR', args: 'number1, [number2], ...', description: 'Estimates variance based on a sample' },
    { name: 'FORECAST', args: 'x, known_ys, known_xs', description: 'Predicts a future value using linear regression' },
  ]
}
