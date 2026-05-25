import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  confirmBooking: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  abandonIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(() => 'request-hash'),
  consumePublicRateLimit: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
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
    abandonIdempotentRequest: mocks.abandonIdempotentRequest,
    hashRequestPayload: mocks.hashRequestPayload,
  }
})

vi.mock('@/lib/security/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/rate-limit')>(
    '@/lib/security/rate-limit'
  )

  return {
    ...actual,
    consumePublicRateLimit: mocks.consumePublicRateLimit,
  }
})

vi.mock('@/lib/security/turnstile', () => ({
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}))

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

function malformedJsonRequest() {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"holdToken"',
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
    mocks.abandonIdempotentRequest.mockResolvedValue(undefined)
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: '2025-01-15T14:05:00.000Z',
    })
    mocks.verifyTurnstileToken.mockResolvedValue({ ok: true, enforced: false })
    mocks.confirmBooking.mockResolvedValue({
      success: true,
      bookingId: 'booking-1',
      cancellationToken: 'cancel-token-1',
      rescheduleToken: 'reschedule-token-1',
      conferenceStatus: 'not_required',
      conferenceUrl: null,
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
      conferenceStatus: 'not_required',
      conferenceUrl: null,
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
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'confirm-booking',
        limit: 20,
        windowSeconds: 300,
      },
    })
  })

  it('rejects malformed JSON before idempotency, rate limiting, or confirmation', async () => {
    const response = await POST(malformedJsonRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Invalid JSON body',
    })
    expect(mocks.beginIdempotentRequest).not.toHaveBeenCalled()
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.confirmBooking).not.toHaveBeenCalled()
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
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
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

  it('rate limits fresh confirmation requests before the booking engine', async () => {
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 20,
      remaining: 0,
      resetAt: '2025-01-15T14:05:00.000Z',
      retryAfterSeconds: 45,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('45')
    expect(data.rateLimit.remaining).toBe(0)
    expect(mocks.confirmBooking).not.toHaveBeenCalled()
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'confirm-booking',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
    })
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })

  it('requires Turnstile before confirming when verification is configured', async () => {
    mocks.verifyTurnstileToken.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'Verification challenge failed',
    })

    const response = await POST(
      requestWithJson({ ...validBody, turnstileToken: 'bad-token' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('challenge')
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalled()
    expect(mocks.confirmBooking).not.toHaveBeenCalled()
  })
})
