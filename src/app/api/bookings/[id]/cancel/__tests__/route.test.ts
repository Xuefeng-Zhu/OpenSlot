import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  cancelBooking: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  abandonIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(() => 'cancel-request-hash'),
  consumePublicRateLimit: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
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
    mocks.abandonIdempotentRequest.mockResolvedValue(undefined)
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: '2025-01-15T14:05:00.000Z',
    })
    mocks.verifyTurnstileToken.mockResolvedValue({ ok: true, enforced: false })
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
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'cancel-booking',
        limit: 20,
        windowSeconds: 300,
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
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
  })

  it('rate limits fresh cancellation requests before the cancellation engine', async () => {
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 20,
      remaining: 0,
      resetAt: '2025-01-15T14:05:00.000Z',
      retryAfterSeconds: 40,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('40')
    expect(data.rateLimit.remaining).toBe(0)
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'cancel-booking',
        key: idempotencyKey,
        requestHash: 'cancel-request-hash',
      },
    })
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })

  it('requires Turnstile before cancelling when verification is configured', async () => {
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
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })
})
