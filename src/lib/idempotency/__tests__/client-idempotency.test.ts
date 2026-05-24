import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClientIdempotencyKey } from '../client-idempotency'

describe('createClientIdempotencyKey', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(createClientIdempotencyKey()).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('falls back to the existing timestamp and random suffix format', () => {
    vi.stubGlobal('crypto', {})
    vi.spyOn(Date, 'now').mockReturnValue(123456)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(createClientIdempotencyKey()).toBe('123456-i')
  })
})
