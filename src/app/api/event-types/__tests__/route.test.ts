import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { id: 'profile-1' } as { id: string } | null,
  eventTypeInsertPayload: null as Record<string, unknown> | null,
  eventTypeInsertError: null as { code?: string; message: string } | null,
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

const validBody = {
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

describe('POST /api/event-types', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.profile = { id: 'profile-1' }
    mocks.eventTypeInsertPayload = null
    mocks.eventTypeInsertError = null
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
})
