import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  validateHoldSlotRequest: vi.fn(),
  beginIdempotentRequest: vi.fn(),
  completeIdempotentRequest: vi.fn(),
  abandonIdempotentRequest: vi.fn(),
  hashRequestPayload: vi.fn(() => 'request-hash'),
  consumePublicRateLimit: vi.fn(),
  verifyTurnstileToken: vi.fn(),
  verifySlotHoldToken: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/availability/available-slots', () => ({
  validateHoldSlotRequest: mocks.validateHoldSlotRequest,
}))

vi.mock('@/lib/availability/slot-token', () => ({
  verifySlotHoldToken: mocks.verifySlotHoldToken,
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

const validBody = {
  eventTypeId: '11111111-1111-4111-8111-111111111111',
  hostUserId: '22222222-2222-4222-8222-222222222222',
  startAt: '2025-01-15T14:00:00.000Z',
  endAt: '2025-01-15T14:30:00.000Z',
  guestEmail: 'guest@example.com',
}

const idempotencyKey = 'hold-key-1'

function requestWithJson(
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Request('http://localhost/api/holds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/holds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adminClient.rpc.mockReset()
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'started',
      entry: {
        scope: 'create-hold',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
    })
    mocks.completeIdempotentRequest.mockResolvedValue(undefined)
    mocks.abandonIdempotentRequest.mockResolvedValue(undefined)
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: '2025-01-15T14:05:00.000Z',
    })
    mocks.verifyTurnstileToken.mockResolvedValue({ ok: true, enforced: false })
    mocks.verifySlotHoldToken.mockResolvedValue({
      ok: false,
      reason: 'malformed',
    })
    mocks.validateHoldSlotRequest.mockResolvedValue({ success: true })
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
    expect(mocks.validateHoldSlotRequest).toHaveBeenCalledWith({
      supabase: mocks.adminClient,
      eventTypeId: validBody.eventTypeId,
      hostUserId: validBody.hostUserId,
      startAt: validBody.startAt,
      endAt: validBody.endAt,
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
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'create-hold',
        limit: 10,
        windowSeconds: 300,
      },
    })
  })

  it('records a fresh idempotent hold request and caches the response', async () => {
    const response = await POST(
      requestWithJson(
        { ...validBody, idempotencyKey },
        { 'Idempotency-Key': idempotencyKey }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.hashRequestPayload).toHaveBeenCalledWith(validBody)
    expect(mocks.beginIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      scope: 'create-hold',
      key: idempotencyKey,
      requestHash: 'request-hash',
    })
    expect(mocks.completeIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'create-hold',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
      response: {
        body: data,
        status: 201,
      },
    })
  })

  it('uses a valid slot token to skip recomputing availability', async () => {
    mocks.verifySlotHoldToken.mockResolvedValue({ ok: true })

    const response = await POST(
      requestWithJson({ ...validBody, slotToken: 'signed-slot-token' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.holdId).toBe('33333333-3333-4333-8333-333333333333')
    expect(mocks.verifySlotHoldToken).toHaveBeenCalledWith({
      token: 'signed-slot-token',
      eventTypeId: validBody.eventTypeId,
      hostUserId: validBody.hostUserId,
      startAt: validBody.startAt,
      endAt: validBody.endAt,
    })
    expect(mocks.validateHoldSlotRequest).not.toHaveBeenCalled()
  })

  it('replays a cached hold response before rate limiting or mutation work', async () => {
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'replay',
      response: {
        status: 201,
        body: {
          holdId: 'cached-hold',
          holdToken: 'cached-token',
          expiresAt: '2025-01-15T14:05:00.000Z',
        },
      },
    })

    const response = await POST(
      requestWithJson(
        { ...validBody, idempotencyKey },
        { 'Idempotency-Key': idempotencyKey }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.holdId).toBe('cached-hold')
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.validateHoldSlotRequest).not.toHaveBeenCalled()
    expect(mocks.adminClient.rpc).not.toHaveBeenCalled()
  })

  it('returns an idempotency conflict for reused keys with different payloads', async () => {
    mocks.beginIdempotentRequest.mockResolvedValue({
      type: 'conflict',
      response: {
        status: 409,
        body: {
          success: false,
          error: 'Idempotency key was already used for a different request',
        },
      },
    })

    const response = await POST(
      requestWithJson(
        { ...validBody, idempotencyKey },
        { 'Idempotency-Key': idempotencyKey }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('different request')
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
    expect(mocks.adminClient.rpc).not.toHaveBeenCalled()
  })

  it('rate limits fresh hold requests before availability validation', async () => {
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 10,
      remaining: 0,
      resetAt: '2025-01-15T14:05:00.000Z',
      retryAfterSeconds: 60,
    })

    const response = await POST(
      requestWithJson(
        { ...validBody, idempotencyKey },
        { 'Idempotency-Key': idempotencyKey }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(data.rateLimit.remaining).toBe(0)
    expect(mocks.validateHoldSlotRequest).not.toHaveBeenCalled()
    expect(mocks.adminClient.rpc).not.toHaveBeenCalled()
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      entry: {
        scope: 'create-hold',
        key: idempotencyKey,
        requestHash: 'request-hash',
      },
    })
    expect(mocks.completeIdempotentRequest).not.toHaveBeenCalled()
  })

  it('requires a valid Turnstile token before creating a hold when configured', async () => {
    mocks.verifyTurnstileToken.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'Verification challenge failed',
    })

    const response = await POST(
      requestWithJson(
        { ...validBody, idempotencyKey, turnstileToken: 'bad-token' },
        { 'Idempotency-Key': idempotencyKey }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('challenge')
    expect(mocks.abandonIdempotentRequest).toHaveBeenCalled()
    expect(mocks.validateHoldSlotRequest).not.toHaveBeenCalled()
    expect(mocks.adminClient.rpc).not.toHaveBeenCalled()
  })

  it('rejects a slot that is not in computed availability before calling the RPC', async () => {
    mocks.validateHoldSlotRequest.mockResolvedValue({
      success: false,
      status: 409,
      error: 'This time slot is no longer available. Please select a different time.',
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('no longer available')
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

  it('maps RPC event invariant failures to an unavailable-slot response', async () => {
    mocks.adminClient.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '22023', message: 'Hold duration must match event type duration' },
      }),
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('no longer available')
  })
})
