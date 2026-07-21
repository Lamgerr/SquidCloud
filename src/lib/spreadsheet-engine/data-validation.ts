import type { CellData, DataValidation, Sheet } from './types'
import { cellRef } from './types'

export function validateCell(cell: CellData | undefined, validation: DataValidation): { valid: boolean; message?: string } {
  if (!cell || cell.value === null || cell.value === '') {
    if (validation.allowBlank) return { valid: true }
    return { valid: false, message: validation.errorMessage || 'This field is required' }
  }

  const value = cell.value
  const numValue = typeof value === 'number' ? value : parseFloat(String(value))

  switch (validation.type) {
    case 'list': {
      const values = validation.listValues || []
      if (!values.includes(String(value))) {
        return { valid: false, message: validation.errorMessage || 'Value must be from the list' }
      }
      break
    }
    case 'number': {
      if (isNaN(numValue)) return { valid: false, message: 'Value must be a number' }
      const v1 = parseFloat(String(validation.formula1 || '0'))
      const v2 = parseFloat(String(validation.formula2 || '0'))
      if (validation.operator === 'between' && (numValue < v1 || numValue > v2)) return { valid: false, message: validation.errorMessage || `Value must be between ${v1} and ${v2}` }
      if (validation.operator === 'greaterThan' && numValue <= v1) return { valid: false, message: validation.errorMessage || `Value must be greater than ${v1}` }
      if (validation.operator === 'lessThan' && numValue >= v1) return { valid: false, message: validation.errorMessage || `Value must be less than ${v1}` }
      break
    }
    case 'textLength': {
      const len = String(value).length
      const v1 = parseFloat(String(validation.formula1 || '0'))
      const v2 = parseFloat(String(validation.formula2 || '0'))
      if (validation.operator === 'between' && (len < v1 || len > v2)) return { valid: false, message: validation.errorMessage || `Text length must be between ${v1} and ${v2}` }
      if (validation.operator === 'greaterThan' && len < v1) return { valid: false, message: validation.errorMessage || `Text length must be greater than ${v1}` }
      break
    }
    case 'custom': {
      if (validation.formula1) {
        try {
          const result = new Function('value', validation.formula1)(value)
          if (!result) return { valid: false, message: validation.errorMessage || 'Invalid value' }
        } catch { return { valid: false, message: 'Validation formula error' } }
      }
      break
    }
  }

  return { valid: true }
}
