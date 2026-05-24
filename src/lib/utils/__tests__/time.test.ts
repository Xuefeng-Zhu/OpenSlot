import { describe, expect, it } from 'vitest'
import { toTimeInputValue } from '../time'

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
})
