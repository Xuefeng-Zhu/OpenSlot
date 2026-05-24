import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { DELETE, PATCH } from '../[id]/route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  scheduleLookupFilters: [] as Array<{ column: string; value: unknown }>,
  scheduleLookupResult: {
    id: '33333333-3333-4333-8333-333333333333',
  } as Record<string, unknown> | null,
  scheduleLookupError: null as { code?: string; message: string } | null,
  eventTypeInsertPayload: null as Record<string, unknown> | null,
  eventTypeInsertError: null as { code?: string; message: string } | null,
  eventTypeUpdatePayload: null as Record<string, unknown> | null,
  eventTypeUpdateFilters: [] as Array<{ column: string; value: unknown }>,
  eventTypeUpdateResult: { id: 'event-type-1', slug: 'intro-call' } as
    | Record<string, unknown>
    | null,
  eventTypeUpdateError: null as { code?: string; message: string } | null,
  bookingCountFilters: [] as Array<{ column: string; value: unknown }>,
  bookingCount: 0 as number | null,
  bookingCountError: null as { code?: string; message: string } | null,
  eventTypeDeleteFilters: [] as Array<{ column: string; value: unknown }>,
  eventTypeDeleteResult: { id: 'event-type-1' } as Record<string, unknown> | null,
  eventTypeDeleteError: null as { code?: string; message: string } | null,
}))

function createTableMock(table: string) {
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mocks.profile,
            error: null,
          }),
        }),
      }),
    }
  }

  if (table === 'event_types') {
    return {
      insert: (payload: Record<string, unknown>) => {
        mocks.eventTypeInsertPayload = payload
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'event-type-1', slug: payload.slug },
              error: mocks.eventTypeInsertError,
            }),
          }),
        }
      },
      update: (payload: Record<string, unknown>) => {
        mocks.eventTypeUpdatePayload = payload
        const builder = {
          eq: (column: string, value: unknown) => {
            mocks.eventTypeUpdateFilters.push({ column, value })
            return builder
          },
          select: () => builder,
          single: async () => ({
            data: mocks.eventTypeUpdateResult,
            error: mocks.eventTypeUpdateError,
          }),
        }

        return builder
      },
      delete: () => {
        const builder = {
          eq: (column: string, value: unknown) => {
            mocks.eventTypeDeleteFilters.push({ column, value })
            return builder
          },
          select: () => builder,
          maybeSingle: async () => ({
            data: mocks.eventTypeDeleteResult,
            error: mocks.eventTypeDeleteError,
          }),
        }

        return builder
      },
    }
  }

  if (table === 'bookings') {
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        mocks.bookingCountFilters.push({ column, value })
        return builder
      },
      then: (
        resolve: (value: {
          data: null
          count: number | null
          error: typeof mocks.bookingCountError
        }) => unknown
      ) =>
        Promise.resolve({
          data: null,
          count: mocks.bookingCount,
          error: mocks.bookingCountError,
        }).then(resolve),
    }

    return builder
  }

  if (table === 'schedules') {
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        mocks.scheduleLookupFilters.push({ column, value })
        return builder
      },
      single: async () => ({
        data: mocks.scheduleLookupResult,
        error: mocks.scheduleLookupError,
      }),
    }

    return builder
  }

  throw new Error(`Unexpected table: ${table}`)
}

vi.mock('@/lib/backend/server', () => ({
  createServerBackendClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: createTableMock,
  })),
}))

const validBody = {
  schedule_id: '33333333-3333-4333-8333-333333333333',
  title: 'Intro Call',
  slug: 'intro-call',
  description: 'A quick call to connect.',
  duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  max_booking_days_ahead: 60,
  location_type: 'online',
  location_value: 'Zoom',
  is_active: true,
  reminder_enabled: true,
  reminder_minutes_before: 1440,
  reminder_guest_enabled: true,
  reminder_host_enabled: true,
}

function requestWithJson(body: unknown) {
  return {
    json: async () => body,
  } as Request
}

function routeContext(id = 'event-type-1') {
  return {
    params: Promise.resolve({ id }),
  }
}

describe('POST /api/event-types', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.profile = { id: 'profile-1' }
    mocks.scheduleLookupFilters = []
    mocks.scheduleLookupResult = {
      id: '33333333-3333-4333-8333-333333333333',
    }
    mocks.scheduleLookupError = null
    mocks.eventTypeInsertPayload = null
    mocks.eventTypeInsertError = null
    mocks.eventTypeUpdatePayload = null
    mocks.eventTypeUpdateFilters = []
    mocks.eventTypeUpdateResult = { id: 'event-type-1', slug: 'intro-call' }
    mocks.eventTypeUpdateError = null
    mocks.bookingCountFilters = []
    mocks.bookingCount = 0
    mocks.bookingCountError = null
    mocks.eventTypeDeleteFilters = []
    mocks.eventTypeDeleteResult = { id: 'event-type-1' }
    mocks.eventTypeDeleteError = null
  })

  it('creates an event type for the authenticated profile', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({
      success: true,
      eventType: {
        id: 'event-type-1',
        slug: 'intro-call',
      },
    })
    expect(mocks.eventTypeInsertPayload).toMatchObject({
      user_id: 'profile-1',
      schedule_id: '33333333-3333-4333-8333-333333333333',
      title: 'Intro Call',
      slug: 'intro-call',
      description: 'A quick call to connect.',
      duration_minutes: 30,
      location_type: 'online',
      location_value: 'Zoom',
      video_provider: null,
      is_active: true,
      reminder_enabled: true,
      reminder_minutes_before: 1440,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
    })
  })

  it('creates generated video provider event types', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await POST(
      requestWithJson({
        ...validBody,
        location_type: 'video_provider',
        location_value: '',
        video_provider: 'google_meet',
      }) as any
    )

    expect(response.status).toBe(201)
    expect(mocks.eventTypeInsertPayload).toMatchObject({
      location_type: 'video_provider',
      location_value: '',
      video_provider: 'google_meet',
    })
  })

  it('rejects unauthenticated creates', async () => {
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

  it('returns field errors for invalid payloads', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await POST(
      requestWithJson({ ...validBody, slug: 'Intro Call' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.slug).toEqual([
      'Use lowercase letters, numbers, and hyphens',
    ])
  })

  it('requires at least one reminder recipient when reminders are enabled', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await POST(
      requestWithJson({
        ...validBody,
        reminder_guest_enabled: false,
        reminder_host_enabled: false,
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.reminder_guest_enabled).toEqual([
      'Select at least one reminder recipient',
    ])
  })

  it('returns a slug-specific conflict for duplicates', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.eventTypeInsertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "unique_slug_per_user"',
    }

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({
      success: false,
      error: 'This URL slug is already used by one of your event types.',
      details: {
        slug: ['This URL slug is already used by one of your event types.'],
      },
    })
  })

  it('rejects schedules that do not belong to the profile', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.scheduleLookupResult = null
    mocks.scheduleLookupError = { code: 'PGRST116', message: 'No rows found' }

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({
      success: false,
      error: 'Schedule not found',
    })
    expect(mocks.eventTypeInsertPayload).toBeNull()
  })
})

describe('PATCH /api/event-types/[id]', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.profile = { id: 'profile-1' }
    mocks.scheduleLookupFilters = []
    mocks.scheduleLookupResult = {
      id: '33333333-3333-4333-8333-333333333333',
    }
    mocks.scheduleLookupError = null
    mocks.eventTypeInsertPayload = null
    mocks.eventTypeInsertError = null
    mocks.eventTypeUpdatePayload = null
    mocks.eventTypeUpdateFilters = []
    mocks.eventTypeUpdateResult = { id: 'event-type-1', slug: 'intro-call' }
    mocks.eventTypeUpdateError = null
    mocks.bookingCountFilters = []
    mocks.bookingCount = 0
    mocks.bookingCountError = null
    mocks.eventTypeDeleteFilters = []
    mocks.eventTypeDeleteResult = { id: 'event-type-1' }
    mocks.eventTypeDeleteError = null
  })

  it('updates an event type scoped to the authenticated profile', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await PATCH(
      requestWithJson({
        ...validBody,
        title: 'Updated Intro Call',
        slug: 'updated-intro-call',
        reminder_minutes_before: 60,
        invitee_questions: [
          {
            id: 'question-1',
            label: 'What should we cover?',
            type: 'text',
            required: true,
            options: [],
          },
        ],
      }) as any,
      routeContext() as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      eventType: { id: 'event-type-1', slug: 'intro-call' },
    })
    expect(mocks.eventTypeUpdatePayload).toMatchObject({
      title: 'Updated Intro Call',
      slug: 'updated-intro-call',
      schedule_id: '33333333-3333-4333-8333-333333333333',
      video_provider: null,
      reminder_enabled: true,
      reminder_minutes_before: 60,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
      invitee_questions: [
        {
          id: 'question-1',
          label: 'What should we cover?',
          type: 'text',
          required: true,
          options: [],
        },
      ],
      updated_at: expect.any(String),
    })
    expect(mocks.eventTypeUpdatePayload).not.toHaveProperty('user_id')
    expect(mocks.eventTypeUpdateFilters).toEqual([
      { column: 'id', value: 'event-type-1' },
      { column: 'user_id', value: 'profile-1' },
    ])
  })

  it('normalizes generated video provider update payloads', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await PATCH(
      requestWithJson({
        ...validBody,
        location_type: 'video_provider',
        location_value: 'ignored user text',
        video_provider: 'microsoft_teams',
      }) as any,
      routeContext() as any
    )

    expect(response.status).toBe(200)
    expect(mocks.eventTypeUpdatePayload).toMatchObject({
      location_type: 'video_provider',
      location_value: '',
      video_provider: 'microsoft_teams',
    })
  })

  it('returns a slug-specific conflict for duplicate update slugs', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.eventTypeUpdateError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "unique_slug_per_user"',
    }

    const response = await PATCH(
      requestWithJson(validBody) as any,
      routeContext() as any
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({
      success: false,
      error: 'This URL slug is already used by one of your event types.',
      details: {
        slug: ['This URL slug is already used by one of your event types.'],
      },
    })
  })

  it('returns not found for missing or foreign event types', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.eventTypeUpdateError = {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    }

    const response = await PATCH(
      requestWithJson(validBody) as any,
      routeContext('foreign-event-type') as any
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({
      success: false,
      error: 'Event type not found',
    })
    expect(mocks.eventTypeUpdateFilters).toEqual([
      { column: 'id', value: 'foreign-event-type' },
      { column: 'user_id', value: 'profile-1' },
    ])
  })
})

describe('DELETE /api/event-types/[id]', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.profile = { id: 'profile-1' }
    mocks.scheduleLookupFilters = []
    mocks.scheduleLookupResult = {
      id: '33333333-3333-4333-8333-333333333333',
    }
    mocks.scheduleLookupError = null
    mocks.eventTypeInsertPayload = null
    mocks.eventTypeInsertError = null
    mocks.eventTypeUpdatePayload = null
    mocks.eventTypeUpdateFilters = []
    mocks.eventTypeUpdateResult = { id: 'event-type-1', slug: 'intro-call' }
    mocks.eventTypeUpdateError = null
    mocks.bookingCountFilters = []
    mocks.bookingCount = 0
    mocks.bookingCountError = null
    mocks.eventTypeDeleteFilters = []
    mocks.eventTypeDeleteResult = { id: 'event-type-1' }
    mocks.eventTypeDeleteError = null
  })

  it('deletes an event type scoped to the authenticated profile', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })

    const response = await DELETE({} as any, routeContext() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.bookingCountFilters).toEqual([
      { column: 'event_type_id', value: 'event-type-1' },
      { column: 'host_user_id', value: 'profile-1' },
    ])
    expect(mocks.eventTypeDeleteFilters).toEqual([
      { column: 'id', value: 'event-type-1' },
      { column: 'user_id', value: 'profile-1' },
    ])
  })

  it('blocks deleting event types that already have bookings', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.bookingCount = 2

    const response = await DELETE({} as any, routeContext() as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({
      success: false,
      error:
        'Event types with existing bookings cannot be deleted. Pause the event type instead.',
    })
    expect(mocks.eventTypeDeleteFilters).toHaveLength(0)
  })

  it('returns an error when booking checks fail before delete', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.bookingCountError = { message: 'permission denied' }

    const response = await DELETE({} as any, routeContext() as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: 'Failed to check event type bookings',
    })
    expect(mocks.eventTypeDeleteFilters).toHaveLength(0)
  })

  it('returns not found for missing or foreign event types', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    mocks.eventTypeDeleteResult = null

    const response = await DELETE(
      {} as any,
      routeContext('foreign-event-type') as any
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({
      success: false,
      error: 'Event type not found',
    })
    expect(mocks.eventTypeDeleteFilters).toEqual([
      { column: 'id', value: 'foreign-event-type' },
      { column: 'user_id', value: 'profile-1' },
    ])
  })
})
