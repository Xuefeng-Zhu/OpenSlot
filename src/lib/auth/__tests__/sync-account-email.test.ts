import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAccountEmail } from '../sync-account-email'

const mocks = {
  getUser: vi.fn(),
  updateUser: vi.fn(),
  updateProfile: vi.fn(),
  eqProfile: vi.fn(),
}

type SyncClient = NonNullable<
  Parameters<typeof syncAccountEmail>[0]['client']
>

function createClient(): SyncClient {
  mocks.updateProfile.mockImplementation(() => ({ eq: mocks.eqProfile }))

  return {
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
    from: vi.fn(() => ({
      update: mocks.updateProfile,
    })),
  } as unknown as SyncClient
}

describe('syncAccountEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: null })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'new@example.com' } },
      error: null,
    })
    mocks.eqProfile.mockResolvedValue({ error: null })
  })

  it('updates auth before mirroring the canonical email to the profile', async () => {
    const client = createClient()

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'old@example.com',
      nextEmail: ' New@Example.com ',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual({ ok: true, email: 'new@example.com' })
    expect(mocks.updateUser).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'new@example.com',
    })
    expect(mocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' })
    )
    expect(mocks.eqProfile).toHaveBeenCalledWith('id', 'profile-1')
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateProfile.mock.invocationCallOrder[0]
    )
  })

  it('maps duplicate auth emails to a safe conflict code', async () => {
    const client = createClient()
    mocks.updateUser.mockResolvedValue({
      data: null,
      error: { status: 409, message: 'duplicate key user@example.com' },
    })

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'old@example.com',
      nextEmail: 'taken@example.com',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'EMAIL_CONFLICT',
      error: 'That email address is already in use.',
    })
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it('restores the previous auth email when the profile write fails', async () => {
    const client = createClient()
    mocks.eqProfile.mockResolvedValue({ error: { message: 'database down' } })

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'old@example.com',
      nextEmail: 'new@example.com',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: 'EMAIL_PROFILE_SYNC_COMPENSATED',
      error: 'Email was not changed. Your previous sign-in email is still active.',
    })
    expect(mocks.updateUser).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      email: 'old@example.com',
    })
  })

  it('requires reconciliation when both profile sync and compensation fail', async () => {
    const client = createClient()
    mocks.eqProfile.mockResolvedValue({ error: { message: 'database down' } })
    mocks.updateUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'rollback unavailable' },
      })

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'old@example.com',
      nextEmail: 'new@example.com',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'EMAIL_RECONCILIATION_REQUIRED',
      })
    )
  })

  it('repairs a stale profile without rewriting an unchanged auth email', async () => {
    const client = createClient()

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'same@example.com',
      nextEmail: 'SAME@example.com',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual({ ok: true, email: 'same@example.com' })
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'same@example.com' })
    )
  })

  it('does not overwrite a newer concurrent auth email during compensation', async () => {
    const client = createClient()
    mocks.eqProfile.mockResolvedValue({ error: { message: 'database down' } })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'newer@example.com' } },
      error: null,
    })

    const result = await syncAccountEmail({
      userId: 'user-1',
      profileId: 'profile-1',
      currentEmail: 'old@example.com',
      nextEmail: 'new@example.com',
      client,
      authReader: client.auth,
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'EMAIL_RECONCILIATION_REQUIRED',
      })
    )
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })
})
