import { describe, expect, it } from 'vitest'

import { applyAuthSessionPersistence } from '../auth-cookie-persistence'

describe('applyAuthSessionPersistence', () => {
  it('keeps persistent cookie options when keep signed in is enabled', () => {
    const expires = new Date('2030-01-01T00:00:00.000Z')
    const cookies = [
      {
        name: 'sb-auth-token',
        value: 'token',
        options: { path: '/', maxAge: 60, expires },
      },
    ]

    expect(applyAuthSessionPersistence(cookies, true)).toEqual(cookies)
  })

  it('turns positive lifetime writes into browser-session cookies', () => {
    const cookies = [
      {
        name: 'sb-auth-token',
        value: 'token',
        options: {
          path: '/',
          sameSite: 'lax' as const,
          maxAge: 400 * 24 * 60 * 60,
          expires: new Date('2030-01-01T00:00:00.000Z'),
        },
      },
    ]

    expect(applyAuthSessionPersistence(cookies, false)).toEqual([
      {
        name: 'sb-auth-token',
        value: 'token',
        options: {
          path: '/',
          sameSite: 'lax',
        },
      },
    ])
  })

  it('preserves deletion writes', () => {
    const cookies = [
      {
        name: 'sb-auth-token',
        value: '',
        options: { path: '/', maxAge: 0 },
      },
    ]

    expect(applyAuthSessionPersistence(cookies, false)).toEqual(cookies)
  })
})
