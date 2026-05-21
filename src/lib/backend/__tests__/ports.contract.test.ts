import { describe, expect, it } from 'vitest'
import { createFakeBackend } from '@/lib/backend/fake'
import type { BackendRow } from '@/lib/backend/types'

describe('backend ports contract', () => {
  it('keeps CRUD callers behind the provider-neutral data port', async () => {
    const backend = createFakeBackend()

    const inserted = await backend.data.insert('profiles', {
      auth_user_id: 'auth-user-1',
      email: 'host@example.com',
      name: 'Host',
      username: 'host',
      default_timezone: 'America/Los_Angeles',
    })

    expect(inserted.error).toBeNull()
    expect(inserted.data?.id).toEqual(expect.any(String))

    const listed = await backend.data.list('profiles', {
      filters: [
        {
          column: 'email',
          operator: 'eq',
          value: 'host@example.com',
        },
      ],
    })

    expect(listed.data).toHaveLength(1)

    const updated = await backend.data.update(
      'profiles',
      inserted.data!.id,
      { name: 'Updated Host' }
    )

    expect(updated.data?.name).toBe('Updated Host')

    const removed = await backend.data.remove('profiles', inserted.data!.id)
    expect(removed.data).toEqual({ success: true })

    const afterRemove = await backend.data.getById('profiles', inserted.data!.id)
    expect(afterRemove.error?.status).toBe(404)
  })

  it('applies declared fake data filter operators', async () => {
    const backend = createFakeBackend()
    backend.seed('profiles', [
      profileRow({
        id: 'profile-1',
        auth_user_id: 'auth-user-1',
        email: 'alpha@example.com',
        name: 'Alpha Host',
        username: 'alpha-host',
        created_at: '2026-05-01T00:00:00.000Z',
      }),
      profileRow({
        id: 'profile-2',
        auth_user_id: 'auth-user-2',
        email: 'beta@example.com',
        name: 'Beta Team',
        username: 'beta-host',
        created_at: '2026-05-02T00:00:00.000Z',
      }),
      profileRow({
        id: 'profile-3',
        auth_user_id: 'auth-user-3',
        email: 'gamma@example.com',
        name: 'Gamma Team',
        username: null,
        created_at: '2026-05-03T00:00:00.000Z',
      }),
    ])

    const afterFirst = await backend.data.list('profiles', {
      filters: [
        {
          column: 'created_at',
          operator: 'gt',
          value: '2026-05-01T00:00:00.000Z',
        },
      ],
    })
    expect(afterFirst.data?.map((row) => row.id)).toEqual([
      'profile-2',
      'profile-3',
    ])

    const upToSecond = await backend.data.list('profiles', {
      filters: [
        {
          column: 'created_at',
          operator: 'lte',
          value: '2026-05-02T00:00:00.000Z',
        },
      ],
    })
    expect(upToSecond.data?.map((row) => row.id)).toEqual([
      'profile-1',
      'profile-2',
    ])

    const inList = await backend.data.list('profiles', {
      filters: [
        {
          column: 'email',
          operator: 'in',
          value: ['alpha@example.com', 'gamma@example.com'],
        },
      ],
    })
    expect(inList.data?.map((row) => row.id)).toEqual([
      'profile-1',
      'profile-3',
    ])

    const like = await backend.data.list('profiles', {
      filters: [{ column: 'username', operator: 'like', value: '%-host' }],
    })
    expect(like.data?.map((row) => row.id)).toEqual(['profile-1', 'profile-2'])

    const ilike = await backend.data.list('profiles', {
      filters: [{ column: 'name', operator: 'ilike', value: '%team' }],
    })
    expect(ilike.data?.map((row) => row.id)).toEqual([
      'profile-2',
      'profile-3',
    ])

    const isNull = await backend.data.list('profiles', {
      filters: [{ column: 'username', operator: 'is', value: null }],
    })
    expect(isNull.data?.map((row) => row.id)).toEqual(['profile-3'])

    await expect(
      backend.data.list('profiles', {
        filters: [{ column: 'name', operator: 'fts', value: 'team' }],
      })
    ).rejects.toThrow('Unsupported fake backend filter operator: fts')
  })

  it('keeps auth flows behind the provider-neutral auth port', async () => {
    const backend = createFakeBackend()

    const signedUp = await backend.auth.signUp({
      email: 'host@example.com',
      password: 'Passw0rd!',
      displayName: 'Host',
    })

    expect(signedUp.data?.email).toBe('host@example.com')

    const session = await backend.auth.signInWithPassword({
      email: 'host@example.com',
      password: 'Passw0rd!',
    })

    expect(session.data?.accessToken).toBe('fake-access-token')

    const user = await backend.auth.getCurrentUser()
    expect(user.data?.email).toBe('host@example.com')

    const refreshed = await backend.auth.refreshSession('fake-refresh-token')
    expect(refreshed.data?.accessToken).toBe('fake-refreshed-access-token')

    await expect(
      backend.auth.requestPasswordReset({ email: 'host@example.com' })
    ).resolves.toMatchObject({ error: null })
    await expect(
      backend.auth.resetPassword({
        email: 'host@example.com',
        code: '123456',
        newPassword: 'Newpassw0rd!',
      })
    ).resolves.toMatchObject({ error: null })

    await backend.auth.signOut('fake-access-token')
    const afterSignOut = await backend.auth.getCurrentUser()
    expect(afterSignOut.error?.status).toBe(401)
  })

  it('routes atomic booking operations through named backend functions', async () => {
    const backend = createFakeBackend({
      functions: {
        createSlotHold: ({ body }) => ({
          success: true,
          holdId: 'hold-1',
          holdToken: 'hold-token-1',
          expiresAt: '2026-05-20T18:00:00.000Z',
          request: body,
        }),
        claimOutboxEvents: () => [],
      },
    })

    const hold = await backend.transactions.createSlotHold({
      eventTypeId: 'event-type-1',
      hostUserId: 'profile-1',
      startAt: '2026-05-20T17:00:00.000Z',
      endAt: '2026-05-20T17:30:00.000Z',
      guestEmail: 'guest@example.com',
    })

    expect(hold.data?.success).toBe(true)

    const outbox = await backend.transactions.claimOutboxEvents({ limit: 5 })
    expect(outbox.data).toEqual([])
    expect(backend.functionCalls.map((call) => call.name)).toEqual([
      'createSlotHold',
      'claimOutboxEvents',
    ])
  })
})

function profileRow(
  overrides: Partial<BackendRow<'profiles'>>
): BackendRow<'profiles'> {
  const base = baseProfileRow()

  return {
    ...base,
    ...overrides,
    updated_at: overrides.updated_at ?? overrides.created_at ?? base.updated_at,
  }
}

function baseProfileRow(): BackendRow<'profiles'> {
  return {
    id: 'profile-1',
    auth_user_id: 'auth-user-1',
    email: 'host@example.com',
    name: 'Host',
    username: 'host',
    avatar_url: null,
    default_timezone: 'America/Los_Angeles',
    public_headline: null,
    public_bio: null,
    response_time_label: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  }
}
