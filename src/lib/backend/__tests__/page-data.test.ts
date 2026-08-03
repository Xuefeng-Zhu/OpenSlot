import { describe, expect, it } from 'vitest'
import {
  isMissingRowError,
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from '../page-data'

describe('page data result handling', () => {
  it('recognizes only the explicit zero-row error as missing data', () => {
    expect(isMissingRowError({ message: 'No rows', code: 'PGRST116' })).toBe(true)
    expect(
      isMissingRowError({ message: 'Endpoint missing', status: 404 })
    ).toBe(false)
    expect(isMissingRowError(null)).toBe(false)
  })

  it('returns null for an absent session or a 401 response', () => {
    expect(
      pageUserOrNull({ data: { user: null }, error: null })
    ).toBeNull()
    expect(
      pageUserOrNull({
        data: { user: null },
        error: { message: 'Unauthorized', status: 401 },
      })
    ).toBeNull()
  })

  it('throws a safe error for a real authentication failure', () => {
    expect(() =>
      pageUserOrNull({
        data: { user: null },
        error: { message: 'database credentials leaked here', status: 503 },
      })
    ).toThrow('Failed to verify the authenticated session')

    expect(() =>
      pageUserOrNull({
        data: { user: null },
        error: { message: 'database credentials leaked here', status: 503 },
      })
    ).not.toThrow('database credentials leaked here')
  })

  it('distinguishes an absent optional row from a failed lookup', () => {
    expect(
      optionalPageRow(
        { data: null, error: { message: 'No rows', code: 'PGRST116' } },
        'profile'
      )
    ).toBeNull()
    expect(optionalPageRow({ data: null, error: null }, 'profile')).toBeNull()
    expect(
      optionalPageRow({ data: { id: 'profile-1' }, error: null }, 'profile')
    ).toEqual({ id: 'profile-1' })

    expect(() =>
      optionalPageRow(
        {
          data: null,
          error: { message: 'raw database failure', status: 500 },
        },
        'profile'
      )
    ).toThrow('Failed to load profile')
  })

  it('keeps a successful empty collection distinct from a query failure', () => {
    expect(pageCollection({ data: [], error: null }, 'bookings')).toEqual([])
    expect(pageCollection({ data: null, error: null }, 'bookings')).toEqual([])
    expect(() =>
      pageCollection(
        { data: null, error: { message: 'raw database failure', status: 500 } },
        'bookings'
      )
    ).toThrow('Failed to load bookings')
  })
})
