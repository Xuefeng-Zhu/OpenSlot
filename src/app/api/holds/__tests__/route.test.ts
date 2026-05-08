import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

const validBody = {
  eventTypeId: '11111111-1111-4111-8111-111111111111',
  hostUserId: '22222222-2222-4222-8222-222222222222',
  startAt: '2025-01-15T14:00:00.000Z',
  endAt: '2025-01-15T14:30:00.000Z',
  guestEmail: 'guest@example.com',
}

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/holds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function createConflictCheck(result: {
  data: Array<Record<string, unknown>> | null
  error: { code?: string; message: string } | null
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
}

function setupConflictChecks({
  holds = [],
  bookings = [],
}: {
  holds?: Array<Record<string, unknown>>
  bookings?: Array<Record<string, unknown>>
} = {}) {
  mocks.adminClient.from.mockReset()
  const holdsQuery = createConflictCheck({ data: holds, error: null })
  const bookingsQuery = createConflictCheck({ data: bookings, error: null })

  mocks.adminClient.from
    .mockReturnValueOnce(holdsQuery)
    .mockReturnValueOnce(bookingsQuery)

  return { holdsQuery, bookingsQuery }
}

describe('POST /api/holds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adminClient.rpc.mockReset()
    setupConflictChecks()
    mocks.adminClient.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          hold_id: '33333333-3333-4333-8333-333333333333',
          hold_token: '44444444-4444-4444-8444-444444444444',
          expires_at: '2025-01-15T14:05:00.000Z',
        },
        error: null,
      }),
    })
  })

  it('creates a hold through the reservation RPC', async () => {
    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({
      holdId: '33333333-3333-4333-8333-333333333333',
      holdToken: '44444444-4444-4444-8444-444444444444',
      expiresAt: '2025-01-15T14:05:00.000Z',
    })
    expect(mocks.adminClient.rpc).toHaveBeenCalledWith(
      'create_slot_hold_with_reservation',
      expect.objectContaining({
        p_event_type_id: validBody.eventTypeId,
        p_host_user_id: validBody.hostUserId,
        p_start_at: validBody.startAt,
        p_end_at: validBody.endAt,
        p_guest_email: validBody.guestEmail,
        p_expires_at: expect.any(String),
      })
    )
  })

  it('rejects a slot that is already held before calling the RPC', async () => {
    vi.clearAllMocks()
    setupConflictChecks({
      holds: [{ id: 'active-hold-id' }],
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('currently held')
    expect(mocks.adminClient.rpc).not.toHaveBeenCalled()
  })

  it('maps reservation exclusion conflicts to a slot-held response', async () => {
    mocks.adminClient.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23P01', message: 'conflicting key value violates exclusion constraint' },
      }),
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('currently held')
  })
})
