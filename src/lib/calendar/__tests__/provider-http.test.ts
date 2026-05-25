import { describe, expect, it } from 'vitest'
import {
  calendarErrorMessage,
  parseProviderJson,
  providerHeaders,
} from '../provider-http'

describe('calendar provider HTTP helpers', () => {
  it('builds JSON bearer-token headers', () => {
    expect(providerHeaders('access-token')).toEqual({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
    })
  })

  it('returns parsed provider JSON for successful responses', async () => {
    const response = new Response(JSON.stringify({ id: 'event-1' }), {
      status: 200,
    })

    await expect(parseProviderJson<{ id: string }>(response)).resolves.toEqual({
      id: 'event-1',
    })
  })

  it('rejects successful responses when the provider body cannot be parsed', async () => {
    const response = new Response('not json', { status: 200 })

    await expect(parseProviderJson(response)).rejects.toThrow(
      'Provider returned malformed JSON'
    )
  })

  it('uses provider error messages before generic HTTP fallback text', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'Calendar API rejected the request' } }),
      { status: 403 }
    )

    await expect(parseProviderJson(response)).rejects.toThrow(
      'Calendar API rejected the request'
    )
  })

  it('falls back to the HTTP status when the provider body cannot be parsed', async () => {
    const response = new Response('not json', { status: 500 })

    await expect(parseProviderJson(response)).rejects.toThrow(
      'Provider request failed with HTTP 500'
    )
  })

  it('stringifies unknown calendar errors consistently', () => {
    expect(calendarErrorMessage(new Error('Token expired'))).toBe('Token expired')
    expect(calendarErrorMessage('provider unavailable')).toBe(
      'provider unavailable'
    )
  })
})
