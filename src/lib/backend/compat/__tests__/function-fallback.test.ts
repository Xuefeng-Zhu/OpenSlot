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

  it('detects unstructured gateway failures from function routing', () => {
    expect(
      shouldUseFunctionFallback({
        message: 'Butterbase request failed with 502',
        status: 502,
        details: null,
      })
    ).toBe(true)
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
