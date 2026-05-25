import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserBackendClient } from '../browser-client'

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

    const result = await createBrowserBackendClient().auth.exchangeCodeForSession(
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

  it('falls back to the auth response status when JSON parsing fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected token')
      },
    } as unknown as Response)

    const result = await createBrowserBackendClient().auth.exchangeCodeForSession(
      'recovery-code'
    )

    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({
      message: 'Request failed with status 502',
      status: 502,
    })
  })

  it('preserves nested backend query error metadata', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint',
          code: '23505',
          details: { constraint: 'profiles_username_key' },
        },
      }),
    })

    const result = await createBrowserBackendClient()
      .from('profiles')
      .update({ username: 'taken' })
      .eq('auth_user_id', 'auth-user-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/backend/query', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        table: 'profiles',
        operation: 'update',
        filters: [
          { column: 'auth_user_id', operator: 'eq', value: 'auth-user-1' },
        ],
        orders: [],
        selected: '*',
        selectOptions: {},
        responseMode: 'many',
        payload: { username: 'taken' },
      }),
    })
    expect(result).toEqual({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        status: 409,
        details: { constraint: 'profiles_username_key' },
      },
      count: null,
    })
  })

  it('falls back to the query response status when JSON parsing fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('Unexpected token')
      },
    } as unknown as Response)

    const result = await createBrowserBackendClient()
      .from('profiles')
      .select()
      .eq('auth_user_id', 'auth-user-1')

    expect(result.data).toBeNull()
    expect(result.count).toBeNull()
    expect(result.error).toMatchObject({
      message: 'Request failed with status 503',
      status: 503,
    })
  })
})
