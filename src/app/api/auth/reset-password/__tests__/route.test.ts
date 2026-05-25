import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PASSWORD_COMPLEXITY_ERROR } from '@/lib/validations/password'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}))

vi.mock('@/lib/backend/runtime', () => ({
  createBackendRuntime: vi.fn(() => ({
    auth: {
      resetPassword: mocks.resetPassword,
    },
  })),
}))

function resetPasswordRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset()
  })

  it('rejects weak reset passwords before calling the backend', async () => {
    const response = await POST(
      resetPasswordRequest({
        email: 'sarah@example.com',
        code: '123456',
        password: 'correct-horse',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: PASSWORD_COMPLEXITY_ERROR,
    })
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('passes strong reset passwords to the backend runtime', async () => {
    mocks.resetPassword.mockResolvedValue({ error: null })

    const response = await POST(
      resetPasswordRequest({
        email: ' sarah@example.com ',
        code: ' 123456 ',
        password: 'CorrectHorse1!',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      code: '123456',
      newPassword: 'CorrectHorse1!',
    })
  })
})
