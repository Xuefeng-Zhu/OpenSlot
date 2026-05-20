import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '../client'

const fetchMock = vi.fn()

describe('browser backend client', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exchanges auth codes through the dedicated session endpoint', async () => {
    const session = {
      access_token: '',
      user: {
        id: 'user-1',
        email: 'host@example.com',
      },
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, session }),
    })

    const result = await createClient().auth.exchangeCodeForSession(
      'recovery-code'
    )

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/exchange-code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'recovery-code' }),
    })
    expect(result).toEqual({
      data: session,
      error: null,
    })
  })
})
