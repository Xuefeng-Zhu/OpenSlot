import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  rpcResult: {
    data: 2,
    error: null,
  } as { data: number | null; error: { message: string } | null },
}))

function createServerTableMock(table: string) {
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mocks.profile,
            error: mocks.profile ? null : { message: 'not found' },
          }),
        }),
      }),
    }
  }

  throw new Error(`Unexpected server table: ${table}`)
}

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: createServerTableMock,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
  })),
}))

describe('DELETE /api/contacts/[id]', () => {
  const contactId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1' }
    mocks.rpcResult = { data: 2, error: null }
    rpcMock.mockReset()
    rpcMock.mockImplementation(async () => mocks.rpcResult)
  })

  it('anonymizes a contact through the scoped RPC', async () => {
    const response = await DELETE(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: contactId }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, anonymizedBookings: 2 })
    expect(rpcMock).toHaveBeenCalledWith('anonymize_contact_bookings', {
      p_contact_id: contactId,
      p_host_user_id: 'profile-1',
    })
  })

  it('returns not found when the scoped RPC rejects the contact id', async () => {
    mocks.rpcResult = {
      data: null,
      error: { message: 'contact_not_found' },
    }

    const response = await DELETE(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: contactId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ success: false, error: 'Contact not found' })
  })

  it('requires an authenticated profile', async () => {
    mocks.profile = null

    const response = await DELETE(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: contactId }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ success: false, error: 'Profile not found' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects malformed contact ids before calling the RPC', async () => {
    const response = await DELETE(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ success: false, error: 'Invalid contact id' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
