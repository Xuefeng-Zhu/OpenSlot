import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PASSWORD_COMPLEXITY_ERROR } from '@/lib/validations/password'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  createBackendRuntime: vi.fn(),
}))

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: mocks.createBackendRuntime,
}))

function signupRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mocks.createBackendRuntime.mockReset()
  })

  it('rejects weak passwords before calling the backend runtime', async () => {
    const response = await POST(
      signupRequest({
        email: 'sarah@example.com',
        password: 'correct-horse',
        displayName: 'Sarah Chen',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: PASSWORD_COMPLEXITY_ERROR,
    })
    expect(mocks.createBackendRuntime).not.toHaveBeenCalled()
  })
})
