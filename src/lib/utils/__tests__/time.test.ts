import { describe, expect, it } from 'vitest'
import { toDateInputValue, toTimeInputValue } from '../time'

describe('time utilities', () => {
  describe('toTimeInputValue', () => {
    it('normalizes database time values to HH:mm', () => {
      expect(toTimeInputValue('09:30:00')).toBe('09:30')
      expect(toTimeInputValue('17:45')).toBe('17:45')
    })

    it('preserves nullish empty time values', () => {
      expect(toTimeInputValue(null)).toBeNull()
      expect(toTimeInputValue(undefined)).toBeNull()
    })
  })

  describe('toDateInputValue', () => {
    it('normalizes database date values to YYYY-MM-DD', () => {
      expect(toDateInputValue('2026-06-18')).toBe('2026-06-18')
      expect(toDateInputValue('2026-06-18T00:00:00.000Z')).toBe('2026-06-18')
    })

    it('preserves nullish empty date values', () => {
      expect(toDateInputValue(null)).toBeNull()
      expect(toDateInputValue(undefined)).toBeNull()
    })
  })
})
