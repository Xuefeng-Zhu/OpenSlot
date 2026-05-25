import { describe, expect, it } from 'vitest'
import { readAuthJsonObject } from '../_request'

describe('readAuthJsonObject', () => {
  it('returns object JSON bodies', async () => {
    const request = requestWithBody(JSON.stringify({ email: 'host@example.com' }))

    await expect(readAuthJsonObject(request as any)).resolves.toEqual({
      email: 'host@example.com',
    })
  })

  it('returns null for malformed and non-object bodies', async () => {
    await expect(readAuthJsonObject(requestWithBody('{') as any)).resolves.toBeNull()
    await expect(
      readAuthJsonObject(requestWithBody(JSON.stringify(['email'])) as any)
    ).resolves.toBeNull()
    await expect(
      readAuthJsonObject(requestWithBody(JSON.stringify('email')) as any)
    ).resolves.toBeNull()
  })
})

function requestWithBody(body: string) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
