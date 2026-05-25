import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestJson } from '../request-json'

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON for successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
    )

    await expect(
      requestJson<{ success: boolean }>('/api/example', {}, 'Request failed')
    ).resolves.toEqual({ success: true })
  })

  it('uses server error messages for failed JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })
      )
    )

    await expect(
      requestJson('/api/example', {}, 'Request failed')
    ).rejects.toThrow('Invalid request')
  })

  it('uses the fallback error for failed non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response('not json', { status: 500 }))
    )

    await expect(
      requestJson('/api/example', {}, 'Request failed')
    ).rejects.toThrow('Request failed')
  })

  it('rejects successful non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response('not json', { status: 200 }))
    )

    await expect(
      requestJson('/api/example', {}, 'Request failed')
    ).rejects.toThrow('Request failed')
  })
})
