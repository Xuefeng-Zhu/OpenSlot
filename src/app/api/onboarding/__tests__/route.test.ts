import { describe, expect, it, beforeEach, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileUpsertPayload: null as Record<string, unknown> | null,
  profileUpsertOptions: null as Record<string, unknown> | null,
  profileUpsertError: null as { code?: string; message: string } | null,
  savedProfileId: 'profile-1',
  eventTypePayload: null as Record<string, unknown> | null,
  eventTypeOptions: null as Record<string, unknown> | null,
  deletedAvailabilityForUser: '',
  insertedAvailability: [] as Array<Record<string, unknown>>,
}))

function createTableMock(table: string) {
  if (table === 'profiles') {
    return {
      upsert: (
        payload: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        mocks.profileUpsertPayload = payload
        mocks.profileUpsertOptions = options
        return {
          select: () => ({
            single: async () => ({
              data: { id: mocks.savedProfileId },
              error: mocks.profileUpsertError,
            }),
          }),
        }
      },
    }
  }

  if (table === 'event_types') {
    return {
      upsert: (
        payload: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        mocks.eventTypePayload = payload
        mocks.eventTypeOptions = options
        return {
          select: () => ({
            single: async () => ({
              data: { slug: payload.slug },
              error: null,
            }),
          }),
        }
      },
    }
  }

  if (table === 'availability_rules') {
    return {
      delete: () => ({
        eq: async (_column: string, userId: string) => {
          mocks.deletedAvailabilityForUser = userId
          return { error: null }
        },
      }),
      insert: async (payload: Array<Record<string, unknown>>) => {
        mocks.insertedAvailability = payload
        return { error: null }
      },
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
  createAdminClient: vi.fn(() => ({
    from: createTableMock,
  })),
}))

const validBody = {
  profile: {
    displayName: 'Sarah Chen',
    username: 'sarah-chen',
  },
  availability: {
    monday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
    tuesday: { enabled: false, intervals: [] },
    wednesday: { enabled: false, intervals: [] },
    thursday: { enabled: false, intervals: [] },
    friday: { enabled: false, intervals: [] },
    saturday: { enabled: false, intervals: [] },
    sunday: { enabled: false, intervals: [] },
  },
  eventType: {
    title: 'Intro Call',
    duration: '30',
    location: 'Zoom',
  },
  timezone: 'America/Los_Angeles',
}

function requestWithJson(body: unknown) {
  return {
    json: async () => body,
  } as Request
}

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.profileUpsertPayload = null
    mocks.profileUpsertOptions = null
    mocks.profileUpsertError = null
    mocks.savedProfileId = 'profile-1'
    mocks.eventTypePayload = null
    mocks.eventTypeOptions = null
    mocks.deletedAvailabilityForUser = ''
    mocks.insertedAvailability = []
  })

  it('persists profile, first event type, and weekly availability', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'sarah@example.com' } },
      error: null,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      bookingLink: '/sarah-chen/intro-call',
    })
    expect(mocks.profileUpsertPayload).toMatchObject({
      auth_user_id: 'auth-user-1',
      email: 'sarah@example.com',
      name: 'Sarah Chen',
      username: 'sarah-chen',
      default_timezone: 'America/Los_Angeles',
    })
    expect(mocks.profileUpsertOptions).toEqual({ onConflict: 'auth_user_id' })
    expect(mocks.eventTypePayload).toMatchObject({
      user_id: 'profile-1',
      title: 'Intro Call',
      slug: 'intro-call',
      duration_minutes: 30,
      location_type: 'custom',
      location_value: 'Zoom',
      is_active: true,
    })
    expect(mocks.eventTypeOptions).toEqual({ onConflict: 'user_id,slug' })
    expect(mocks.deletedAvailabilityForUser).toBe('profile-1')
    expect(mocks.insertedAvailability).toEqual([
      {
        user_id: 'profile-1',
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: true,
        timezone: 'America/Los_Angeles',
      },
    ])
  })

  it('rejects unauthenticated onboarding saves', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({
      success: false,
      error: 'Unauthorized',
    })
  })

  it('returns an actionable error when the profile cannot be saved', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'sarah@example.com' } },
      error: null,
    })
    mocks.profileUpsertError = {
      code: '42501',
      message: 'new row violates row-level security policy',
    }

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error:
        'Failed to save profile. Apply migration 011_allow_profile_insert.sql or configure SUPABASE_SERVICE_ROLE_KEY.',
    })
  })
})
