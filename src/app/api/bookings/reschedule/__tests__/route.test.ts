import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { rescheduleBooking } from '@/lib/booking/reschedule'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
  resolveIdempotencyKey: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  abandonIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(),
  consumePublicRateLimit: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/booking/reschedule', () => ({
  rescheduleBooking: vi.fn(),
}))

vi.mock('@/lib/idempotency/request-idempotency', () => ({
  resolveIdempotencyKey: mocks.resolveIdempotencyKey,
  beginIdempotentRequest: mocks.beginIdempotentRequest,
  completeIdempotentRequest: mocks.completeIdempotentRequest,
  abandonIdempotentRequest: mocks.abandonIdempotentRequest,
  hashRequestPayload: mocks.hashRequestPayload,
}))

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

const validBody = {
  rescheduleToken: '00000000-0000-4000-8000-000000000001',
  holdToken: '00000000-0000-4000-8000-000000000002',
  guestName: 'Sarah Chen',
  guestEmail: 'sarah@example.com',
  guestTimezone: 'America/Los_Angeles',
  notes: 'Later works.',
}

function requestWithJson(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/bookings/reschedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/bookings/reschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveIdempotencyKey.mockReturnValue({ ok: true, key: null })
    mocks.hashRequestPayload.mockReturnValue('request-hash')
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: '2025-01-15T14:05:00.000Z',
    })
    mocks.verifyTurnstileToken.mockResolvedValue({ ok: true, enforced: false })
    vi.mocked(rescheduleBooking).mockResolvedValue({
      success: true,
      bookingId: 'new-booking-1',
      previousBookingId: 'old-booking-1',
      cancellationToken: 'cancel-token-2',
      rescheduleToken: 'reschedule-token-2',
      conferenceStatus: 'not_required',
      conferenceUrl: null,
    })
  })

  it('reschedules a booking from a new hold', async () => {
    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({
      success: true,
      bookingId: 'new-booking-1',
      previousBookingId: 'old-booking-1',
      cancellationToken: 'cancel-token-2',
      rescheduleToken: 'reschedule-token-2',
      conferenceStatus: 'not_required',
      conferenceUrl: null,
    })
    expect(rescheduleBooking).toHaveBeenCalledWith(validBody, mocks.adminClient)
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'reschedule-booking',
        limit: 20,
        windowSeconds: 300,
      },
    })
  })

  it('returns validation errors for invalid payloads', async () => {
    const response = await POST(
      requestWithJson({ ...validBody, guestEmail: 'bad' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.guestEmail).toBeDefined()
    expect(rescheduleBooking).not.toHaveBeenCalled()
  })

  it('caches idempotent responses', async () => {
    mocks.resolveIdempotencyKey.mockReturnValue({ ok: true, key: 'idem-1' })
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'started',
      entry: { id: 'entry-1' },
    })

    const response = await POST(
      requestWithJson(validBody, { 'Idempotency-Key': 'idem-1' }) as any
    )

    expect(response.status).toBe(201)
    expect(mocks.beginIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      scope: 'reschedule-booking',
      key: 'idem-1',
      requestHash: 'request-hash',
    })
    expect(mocks.completeIdempotentRequest).toHaveBeenCalled()
  })

  it('rate limits fresh reschedule requests before the reschedule engine', async () => {
    mocks.resolveIdempotencyKey.mockReturnValue({ ok: true, key: 'idem-1' })
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'started',
      entry: {
        scope: 'reschedule-booking',
        key: 'idem-1',
        requestHash: 'request-hash',
      },
    })
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 20,
      remaining: 0,
      resetAt: '2025-01-15T14:05:00.000Z',
      retryAfterSeconds: 35,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('35')
    expect(data.rateLimit.remaining).toBe(0)
    expect(rescheduleBooking).not.toHaveBeenCalled()
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'reschedule-booking',
        key: 'idem-1',
        requestHash: 'request-hash',
      },
    })
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })

  it('requires Turnstile before rescheduling when verification is configured', async () => {
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
    expect(rescheduleBooking).not.toHaveBeenCalled()
  })

  it('maps expired holds to 410', async () => {
    vi.mocked(rescheduleBooking).mockResolvedValueOnce({
      success: false,
      error: 'Hold has expired. Please select a new slot.',
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(410)
    expect(data).toEqual({
      success: false,
      error: 'Hold has expired. Please select a new slot.',
    })
  })
})
