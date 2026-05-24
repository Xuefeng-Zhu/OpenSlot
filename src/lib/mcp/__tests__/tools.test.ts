import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callMcpTool, listMcpToolsForScopes } from '../tools'

const mocks = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
  consumePublicRateLimit: vi.fn(),
}))

vi.mock('@/lib/booking/cancel', () => ({
  cancelBooking: mocks.cancelBooking,
}))

vi.mock('@/lib/security/rate-limit', () => ({
  consumePublicRateLimit: mocks.consumePublicRateLimit,
}))

vi.mock('@/lib/idempotency/request-idempotency', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/idempotency/request-idempotency')
  >('@/lib/idempotency/request-idempotency')

  return actual
})

const auth = {
  tokenId: 'token-1',
  profileId: 'profile-1',
  scopes: ['mcp:read' as const, 'mcp:write' as const],
}

function context(adminClient: unknown) {
  return {
    adminClient: adminClient as any,
    auth,
    request: new Request('http://localhost/api/mcp'),
  }
}

describe('MCP tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 30,
      remaining: 29,
      resetAt: '2026-05-24T00:05:00.000Z',
    })
    mocks.cancelBooking.mockResolvedValue({ success: true })
  })

  it('filters tools by read/write scopes', () => {
    const readOnlyTools = listMcpToolsForScopes(['mcp:read'])
    const writeTools = listMcpToolsForScopes(['mcp:write'])

    expect(readOnlyTools.map((tool) => tool.name)).toContain(
      'openslot_get_profile'
    )
    expect(readOnlyTools.map((tool) => tool.name)).not.toContain(
      'openslot_confirm_booking'
    )
    expect(writeTools.map((tool) => tool.name)).toContain(
      'openslot_confirm_booking'
    )
    expect(writeTools.map((tool) => tool.name)).not.toContain(
      'openslot_get_profile'
    )
  })

  it('lists event types scoped to the authenticated profile', async () => {
    const filters: Array<{ column: string; value: unknown }> = []
    const adminClient = {
      from: vi.fn((table: string) => {
        expect(table).toBe('event_types')
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              filters.push({ column, value })
              return {
                order: async () => ({
                  data: [
                    {
                      id: '11111111-1111-4111-8111-111111111111',
                      title: 'Intro Call',
                      slug: 'intro-call',
                      description: '',
                      duration_minutes: 30,
                      buffer_before_minutes: 0,
                      buffer_after_minutes: 0,
                      min_notice_minutes: 60,
                      max_booking_days_ahead: 60,
                      location_type: 'online',
                      location_value: '',
                      video_provider: null,
                      invitee_questions: [],
                      is_active: true,
                      created_at: '2026-05-24T00:00:00.000Z',
                      updated_at: '2026-05-24T00:00:00.000Z',
                    },
                  ],
                  error: null,
                }),
              }
            },
          }),
        }
      }),
    }

    const result = await callMcpTool({
      name: 'openslot_list_event_types',
      argumentsValue: {},
      context: context(adminClient),
    })

    expect(result.isError).toBeUndefined()
    expect(filters).toEqual([{ column: 'user_id', value: 'profile-1' }])
    expect(result.structuredContent?.eventTypes).toEqual([
      expect.objectContaining({
        title: 'Intro Call',
        durationMinutes: 30,
      }),
    ])
  })

  it('lists bookings without exposing cancellation or reschedule tokens', async () => {
    const filters: Array<{ column: string; value: unknown }> = []
    const adminClient = {
      from: vi.fn((table: string) => {
        expect(table).toBe('bookings')
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters.push({ column, value })
            return builder
          },
          order: () => builder,
          limit: async () => ({
            data: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                event_type_id: '11111111-1111-4111-8111-111111111111',
                guest_name: 'Guest',
                guest_email: 'guest@example.com',
                guest_timezone: 'America/Los_Angeles',
                start_at: '2026-05-24T18:00:00.000Z',
                end_at: '2026-05-24T18:30:00.000Z',
                status: 'confirmed',
                cancellation_token: 'secret-cancel-token',
                reschedule_token: 'secret-reschedule-token',
                location_type: 'online',
                location_value: '',
                conference_provider: null,
                conference_url: null,
                conference_status: 'not_required',
                created_at: '2026-05-24T00:00:00.000Z',
                updated_at: '2026-05-24T00:00:00.000Z',
                event_types: { title: 'Intro Call' },
              },
            ],
            error: null,
          }),
        }

        return builder
      }),
    }

    const result = await callMcpTool({
      name: 'openslot_list_bookings',
      argumentsValue: { limit: 10 },
      context: context(adminClient),
    })

    expect(result.isError).toBeUndefined()
    expect(filters).toContainEqual({ column: 'host_user_id', value: 'profile-1' })
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      'secret-cancel-token'
    )
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      'secret-reschedule-token'
    )
  })

  it('cancels bookings by loading the host-scoped cancellation token internally', async () => {
    const filters: Array<{ column: string; value: unknown }> = []
    const adminClient = {
      from: vi.fn((table: string) => {
        expect(table).toBe('bookings')
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters.push({ column, value })
            return builder
          },
          single: async () => ({
            data: {
              id: '22222222-2222-4222-8222-222222222222',
              cancellation_token: 'cancel-token',
              reschedule_token: 'reschedule-token',
            },
            error: null,
          }),
        }

        return builder
      }),
    }

    const result = await callMcpTool({
      name: 'openslot_cancel_booking',
      argumentsValue: {
        bookingId: '22222222-2222-4222-8222-222222222222',
        cancelReason: 'No longer needed',
      },
      context: context(adminClient),
    })

    expect(result.isError).toBeUndefined()
    expect(filters).toEqual([
      { column: 'id', value: '22222222-2222-4222-8222-222222222222' },
      { column: 'host_user_id', value: 'profile-1' },
    ])
    expect(mocks.cancelBooking).toHaveBeenCalledWith(
      {
        cancellationToken: 'cancel-token',
        cancelReason: 'No longer needed',
      },
      adminClient
    )
  })
})
