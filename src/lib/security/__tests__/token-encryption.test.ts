import { afterEach, describe, expect, it } from 'vitest'
import { decryptToken, encryptToken } from '../token-encryption'

describe('calendar token encryption', () => {
  const originalSecret = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET

  afterEach(() => {
    process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = originalSecret
  })

  it('round-trips tokens without storing plaintext', async () => {
    process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET =
      'test-token-encryption-secret'

    const encrypted = await encryptToken('refresh-token-value')

    expect(encrypted).not.toContain('refresh-token-value')
    await expect(decryptToken(encrypted)).resolves.toBe('refresh-token-value')
  })
})
