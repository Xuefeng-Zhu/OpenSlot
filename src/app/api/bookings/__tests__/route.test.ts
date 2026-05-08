import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  confirmBooking: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(() => 'request-hash'),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/booking/confirm', () => ({
  confirmBooking: mocks.confirmBooking,
}))

vi.mock('@/lib/idempotency/request-idempotency', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/idempotency/request-idempotency')
  >('@/lib/idempotency/request-idempotency')

  return {
    ...actual,
    beginIdempotentRequest: mocks.beginIdempotentRequest,
    completeIdempotentRequest: mocks.completeIdempotentRequest,
    hashRequestPayload: mocks.hashRequestPayload,
  }
})

const idempotencyKey = 'confirm-key-1'

const validBody = {
  holdToken: '550e8400-e29b-41d4-a716-446655440000',
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestTimezone: 'America/New_York',
  notes: 'Looking forward to it',
  idempotencyKey,
}

function requestWithJson(
  body: unknown,
  headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey }
) {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/bookings idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'started',
      entry: {
        scope: 'confirm-booking',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
    })
    mocks.completeIdempotentRequest.mockResolvedValue(undefined)
    mocks.confirmBooking.mockResolvedValue({
      success: true,
      bookingId: 'booking-1',
      cancellationToken: 'cancel-token-1',
      rescheduleToken: 'reschedule-token-1',
    })
  })

  it('records a fresh idempotent confirmation request and caches the response', async () => {
    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({
      success: true,
      bookingId: 'booking-1',
      cancellationToken: 'cancel-token-1',
      rescheduleToken: 'reschedule-token-1',
    })
    expect(mocks.beginIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      scope: 'confirm-booking',
      key: idempotencyKey,
      requestHash: 'request-hash',
    })
    expect(mocks.confirmBooking).toHaveBeenCalledWith(
      {
        holdToken: validBody.holdToken,
        guestName: validBody.guestName,
        guestEmail: validBody.guestEmail,
        guestTimezone: validBody.guestTimezone,
        notes: validBody.notes,
      },
      mocks.adminClient
    )
    expect(mocks.completeIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'confirm-booking',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
      response: {
        body: data,
        status: 201,
      },
    })
  })

  it('replays a cached confirmation response without calling the booking engine', async () => {
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'replay',
      response: {
        status: 201,
        body: {
          success: true,
          bookingId: 'cached-booking',
          cancellationToken: 'cached-cancel',
          rescheduleToken: 'cached-reschedule',
        },
      },
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.bookingId).toBe('cached-booking')
    expect(mocks.confirmBooking).not.toHaveBeenCalled()
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })

  it('rejects mismatched idempotency body and header values before mutation', async () => {
    const response = await POST(
      requestWithJson(validBody, { 'Idempotency-Key': 'different-key' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Idempotency key body and header values must match',
    })
    expect(mocks.beginIdempotentRequest).not.toHaveBeenCalled()
    expect(mocks.confirmBooking).not.toHaveBeenCalled()
  })
})
