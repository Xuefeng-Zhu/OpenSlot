import { describe, expect, it } from 'vitest'
import { shouldUseFunctionFallback } from '../function-fallback'

describe('shouldUseFunctionFallback', () => {
  it('detects missing Butterbase functions from a 404 response body', () => {
    expect(
      shouldUseFunctionFallback({
        message: 'Butterbase request failed with 404',
        status: 404,
        details: { error: 'Function not found' },
      })
    ).toBe(true)
  })

  it('detects structured gateway responses that explicitly identify missing functions', () => {
    expect(
      shouldUseFunctionFallback({
        message: 'Butterbase request failed with 503',
        status: 503,
        details: { error: 'Function route not found' },
      })
    ).toBe(true)
  })

  it('does not replay writes after ambiguous gateway failures', () => {
    expect(
      shouldUseFunctionFallback({
        message: 'Butterbase request failed with 502',
        status: 502,
        details: null,
      })
    ).toBe(false)
  })

  it('does not hide domain or validation failures from deployed functions', () => {
    expect(
      shouldUseFunctionFallback({
        message: 'This slot has been booked by someone else.',
        code: '23P01',
        status: 409,
      })
    ).toBe(false)
  })
})
