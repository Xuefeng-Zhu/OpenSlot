import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  cancelBooking: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(() => 'cancel-request-hash'),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/booking/cancel', () => ({
  cancelBooking: mocks.cancelBooking,
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

const idempotencyKey = 'cancel-key-1'

const validBody = {
  cancellationToken: '550e8400-e29b-41d4-a716-446655440000',
  cancelReason: 'Schedule conflict',
  idempotencyKey,
}

function requestWithJson(
  body: unknown,
  headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey }
) {
  return new Request('http://localhost/api/bookings/booking-1/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/bookings/[id]/cancel idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'started',
      entry: {
        scope: 'cancel-booking',
        key: idempotencyKey,
        requestHash: 'cancel-request-hash',
      },
    })
    mocks.completeIdempotentRequest.mockResolvedValue(undefined)
    mocks.cancelBooking.mockResolvedValue({ success: true })
  })

  it('records a fresh idempotent cancellation request and caches the response', async () => {
    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.beginIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      scope: 'cancel-booking',
      key: idempotencyKey,
      requestHash: 'cancel-request-hash',
    })
    expect(mocks.cancelBooking).toHaveBeenCalledWith(
      {
        cancellationToken: validBody.cancellationToken,
        cancelReason: validBody.cancelReason,
      },
      mocks.adminClient
    )
    expect(mocks.completeIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'cancel-booking',
        key: idempotencyKey,
        requestHash: 'cancel-request-hash',
      },
      response: {
        body: data,
        status: 200,
      },
    })
  })

  it('replays a cached cancellation response without calling the cancellation engine', async () => {
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'replay',
      response: {
        status: 200,
        body: { success: true },
      },
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })
})
