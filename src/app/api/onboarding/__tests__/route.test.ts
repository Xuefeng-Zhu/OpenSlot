import { describe, expect, it, beforeEach, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileUpsertPayload: null as Record<string, unknown> | null,
  profileUpsertOptions: null as Record<string, unknown> | null,
  profileUpsertError: null as { code?: string; message: string } | null,
  savedProfileId: 'profile-1',
  existingScheduleId: null as string | null,
  scheduleInsertPayload: null as Record<string, unknown> | null,
  scheduleUpdatePayload: null as Record<string, unknown> | null,
  savedScheduleId: 'schedule-1',
  eventTypePayload: null as Record<string, unknown> | null,
  eventTypeOptions: null as Record<string, unknown> | null,
  deletedAvailabilityForUser: '',
  deletedAvailabilityForSchedule: '',
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

  if (table === 'schedules') {
    return {
      select: () => {
        const builder = {
          eq: () => builder,
          maybeSingle: async () => ({
            data: mocks.existingScheduleId
              ? { id: mocks.existingScheduleId }
              : null,
            error: null,
          }),
        }

        return builder
      },
      insert: (payload: Record<string, unknown>) => {
        mocks.scheduleInsertPayload = payload
        return {
          select: () => ({
            single: async () => ({
              data: { id: mocks.savedScheduleId },
              error: null,
            }),
          }),
        }
      },
      update: (payload: Record<string, unknown>) => {
        mocks.scheduleUpdatePayload = payload
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: mocks.existingScheduleId },
                  error: null,
                }),
              }),
            }),
          }),
        }
      },
    }
  }

  if (table === 'availability_rules') {
    return {
      delete: () => ({
        eq: (column: string, value: string) => {
          if (column === 'user_id') mocks.deletedAvailabilityForUser = value
          if (column === 'schedule_id') mocks.deletedAvailabilityForSchedule = value

          return {
            eq: async (nextColumn: string, nextValue: string) => {
              if (nextColumn === 'user_id') {
                mocks.deletedAvailabilityForUser = nextValue
              }
              if (nextColumn === 'schedule_id') {
                mocks.deletedAvailabilityForSchedule = nextValue
              }

              return { error: null }
            },
          }
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
    locationType: 'custom',
    locationValue: 'Zoom',
    videoProvider: null,
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
    mocks.existingScheduleId = null
    mocks.scheduleInsertPayload = null
    mocks.scheduleUpdatePayload = null
    mocks.savedScheduleId = 'schedule-1'
    mocks.eventTypePayload = null
    mocks.eventTypeOptions = null
    mocks.deletedAvailabilityForUser = ''
    mocks.deletedAvailabilityForSchedule = ''
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
    expect(mocks.scheduleInsertPayload).toMatchObject({
      user_id: 'profile-1',
      name: 'Default schedule',
      timezone: 'America/Los_Angeles',
      is_default: true,
    })
    expect(mocks.eventTypePayload).toMatchObject({
      user_id: 'profile-1',
      schedule_id: 'schedule-1',
      title: 'Intro Call',
      slug: 'intro-call',
      duration_minutes: 30,
      location_type: 'custom',
      location_value: 'Zoom',
      video_provider: null,
      is_active: true,
    })
    expect(mocks.eventTypeOptions).toEqual({ onConflict: 'user_id,slug' })
    expect(mocks.deletedAvailabilityForUser).toBe('profile-1')
    expect(mocks.deletedAvailabilityForSchedule).toBe('schedule-1')
    expect(mocks.insertedAvailability).toEqual([
      {
        user_id: 'profile-1',
        schedule_id: 'schedule-1',
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: true,
        timezone: 'America/Los_Angeles',
      },
    ])
  })

  it('updates an existing default schedule timezone during onboarding reuse', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'sarah@example.com' } },
      error: null,
    })
    mocks.existingScheduleId = 'schedule-existing'

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mocks.scheduleInsertPayload).toBeNull()
    expect(mocks.scheduleUpdatePayload).toMatchObject({
      timezone: 'America/Los_Angeles',
      updated_at: expect.any(String),
    })
    expect(mocks.eventTypePayload).toMatchObject({
      schedule_id: 'schedule-existing',
    })
    expect(mocks.deletedAvailabilityForSchedule).toBe('schedule-existing')
    expect(mocks.insertedAvailability[0]).toMatchObject({
      schedule_id: 'schedule-existing',
      timezone: 'America/Los_Angeles',
    })
  })

  it('persists generated video provider locations from onboarding', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'sarah@example.com' } },
      error: null,
    })

    const response = await POST(
      requestWithJson({
        ...validBody,
        eventType: {
          ...validBody.eventType,
          locationType: 'video_provider',
          locationValue: 'ignored manual details',
          videoProvider: 'google_meet',
        },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mocks.eventTypePayload).toMatchObject({
      location_type: 'video_provider',
      location_value: '',
      video_provider: 'google_meet',
    })
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
        'Failed to save profile. Check Butterbase schema/RLS or configure BUTTERBASE_API_KEY.',
    })
  })
})
