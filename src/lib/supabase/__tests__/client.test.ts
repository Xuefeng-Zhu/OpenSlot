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

    const result = await createClient()
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
})
