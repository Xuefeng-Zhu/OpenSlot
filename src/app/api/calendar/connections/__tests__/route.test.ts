import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'
import { listCalendarConnectionSummaries } from '@/lib/calendar/connections'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  adminClient: { id: 'admin-client' },
}))

function createTableMock(table: string) {
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

  throw new Error(`Unexpected table: ${table}`)
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: createTableMock,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/connections', () => ({
  listCalendarConnectionSummaries: vi.fn(),
}))

describe('GET /api/calendar/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.profile = { id: 'profile-1' }
    vi.mocked(listCalendarConnectionSummaries).mockResolvedValue([
      {
        id: 'connection-1',
        provider: 'google',
        accountEmail: 'sarah@example.com',
        status: 'active',
        connectedAt: '2026-05-08T00:00:00.000Z',
        lastSyncedAt: null,
        lastError: null,
        calendars: [],
      },
    ])
  })

  it('returns safe connection summaries for the authenticated profile', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      connections: [
        {
          id: 'connection-1',
          provider: 'google',
          accountEmail: 'sarah@example.com',
          status: 'active',
          connectedAt: '2026-05-08T00:00:00.000Z',
          lastSyncedAt: null,
          lastError: null,
          calendars: [],
        },
      ],
    })
    expect(listCalendarConnectionSummaries).toHaveBeenCalledWith(
      mocks.adminClient,
      'profile-1'
    )
  })

  it('rejects unauthenticated requests', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
  })
})
