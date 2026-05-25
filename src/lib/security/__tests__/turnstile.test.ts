import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from '@/lib/security/turnstile'

describe('Turnstile verification', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY

  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret
    vi.unstubAllGlobals()
  })

  it('skips enforcement when no secret key is configured', async () => {
    const result = await verifyTurnstileToken({
      request: requestWithHeaders() as any,
      token: undefined,
    })

    expect(result).toEqual({ ok: true, enforced: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires a token when a secret key is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret'

    const result = await verifyTurnstileToken({
      request: requestWithHeaders() as any,
      token: undefined,
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Verification challenge is required',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects failed challenge responses', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret'
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response)

    const result = await verifyTurnstileToken({
      request: requestWithHeaders() as any,
      token: 'bad-token',
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Verification challenge failed',
    })
  })

  it('treats malformed provider responses as verification outages', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret'
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token')
      },
    } as unknown as Response)

    const result = await verifyTurnstileToken({
      request: requestWithHeaders() as any,
      token: 'valid-token',
    })

    expect(result).toEqual({
      ok: false,
      status: 503,
      error: 'Could not verify challenge',
    })
  })

  it('accepts successful challenge responses', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret'
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const result = await verifyTurnstileToken({
      request: requestWithHeaders() as any,
      token: 'valid-token',
    })

    expect(result).toEqual({ ok: true, enforced: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    )

    const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('secret')).toBe('turnstile-secret')
    expect(body.get('response')).toBe('valid-token')
    expect(body.get('remoteip')).toBe('203.0.113.10')
  })
})

function requestWithHeaders() {
  return new Request('http://localhost/api/bookings', {
    headers: {
      'x-forwarded-for': '203.0.113.10',
    },
  })
}
