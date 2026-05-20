import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookingAgentGatewayError } from '@/lib/backend/booking-agent-gateway'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
  },
  consumePublicRateLimit: vi.fn(),
  runBookingAgentTurn: vi.fn(),
  runBookingAgentFallbackTurn: vi.fn(),
  isBookingAgentConfigured: vi.fn(() => true),
  providerConstructor: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
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

vi.mock('@/lib/booking-agent/agent', () => ({
  runBookingAgentTurn: mocks.runBookingAgentTurn,
  runBookingAgentFallbackTurn: mocks.runBookingAgentFallbackTurn,
}))

vi.mock('@/lib/backend/booking-agent-gateway', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/backend/booking-agent-gateway')
  >('@/lib/backend/booking-agent-gateway')

  return {
    ...actual,
    isBookingAgentConfigured: mocks.isBookingAgentConfigured,
    ButterbaseBookingAgentProvider: mocks.providerConstructor,
  }
})

const validBody = {
  mode: 'booking',
  eventTypeId: '11111111-1111-4111-8111-111111111111',
  hostUserId: '22222222-2222-4222-8222-222222222222',
  timezone: 'America/New_York',
  messages: [{ role: 'user', content: 'Next Tuesday afternoon' }],
}

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/booking-agent/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createQuery(result: { data: unknown; error: unknown | null }) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  }

  return query
}

describe('POST /api/booking-agent/message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isBookingAgentConfigured.mockReturnValue(true)
    mocks.providerConstructor.mockImplementation(function () {
      return { complete: vi.fn() }
    })
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAt: '2026-06-01T00:05:00.000Z',
    })
    mocks.runBookingAgentTurn.mockResolvedValue({
      success: true,
      reply: 'I found a few options.',
      suggestedSlots: [],
      nextAction: 'ask_preference',
    })
    mocks.runBookingAgentFallbackTurn.mockResolvedValue({
      success: true,
      reply: 'I checked that date directly.',
      suggestedSlots: [],
      nextAction: 'ask_preference',
    })
  })

  it('runs an ephemeral agent turn with safe public event context', async () => {
    const eventQuery = createQuery({
      data: {
        id: validBody.eventTypeId,
        title: 'Discovery Call',
        description: 'Intro call',
        duration_minutes: 30,
        location_type: 'video',
        location_value: null,
        invitee_questions: [],
        user_id: validBody.hostUserId,
        is_active: true,
      },
      error: null,
    })
    const profileQuery = createQuery({
      data: {
        id: validBody.hostUserId,
        name: 'Sarah Chen',
        username: 'sarah',
      },
      error: null,
    })
    mocks.adminClient.from
      .mockReturnValueOnce(eventQuery)
      .mockReturnValueOnce(profileQuery)

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reply).toBe('I found a few options.')
    expect(eventQuery.eq).toHaveBeenCalledWith('user_id', validBody.hostUserId)
    expect(eventQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mocks.consumePublicRateLimit).toHaveBeenCalledWith({
      request: expect.any(Request),
      adminClient: mocks.adminClient,
      config: {
        scope: 'booking-agent',
        limit: 20,
        windowSeconds: 300,
        identifierParts: [validBody.hostUserId, validBody.eventTypeId],
      },
    })
    expect(mocks.runBookingAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining(validBody),
        eventContext: expect.objectContaining({
          hostName: 'Sarah Chen',
          eventTitle: 'Discovery Call',
        }),
      })
    )
  })

  it('rate limits before loading event context or calling the gateway', async () => {
    mocks.consumePublicRateLimit.mockResolvedValue({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 20,
      remaining: 0,
      resetAt: '2026-06-01T00:05:00.000Z',
      retryAfterSeconds: 30,
    })

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.rateLimit.remaining).toBe(0)
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
    expect(mocks.runBookingAgentTurn).not.toHaveBeenCalled()
  })

  it('returns 503 when the Butterbase gateway is not configured', async () => {
    mocks.isBookingAgentConfigured.mockReturnValue(false)

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toContain('not configured')
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
  })

  it('maps gateway model allow-list failures clearly', async () => {
    const eventQuery = createQuery({
      data: {
        id: validBody.eventTypeId,
        title: 'Discovery Call',
        description: 'Intro call',
        duration_minutes: 30,
        location_type: 'video',
        location_value: null,
        invitee_questions: [],
        user_id: validBody.hostUserId,
        is_active: true,
      },
      error: null,
    })
    const profileQuery = createQuery({
      data: { id: validBody.hostUserId, name: 'Sarah Chen', username: 'sarah' },
      error: null,
    })
    mocks.adminClient.from
      .mockReturnValueOnce(eventQuery)
      .mockReturnValueOnce(profileQuery)
    mocks.runBookingAgentTurn.mockRejectedValue(
      new BookingAgentGatewayError('Model not allowed', 403)
    )

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('rejected')
  })

  it('uses deterministic fallback when the Butterbase gateway requires payment', async () => {
    const eventQuery = createQuery({
      data: {
        id: validBody.eventTypeId,
        title: 'Discovery Call',
        description: 'Intro call',
        duration_minutes: 30,
        location_type: 'video',
        location_value: null,
        invitee_questions: [],
        user_id: validBody.hostUserId,
        is_active: true,
      },
      error: null,
    })
    const profileQuery = createQuery({
      data: { id: validBody.hostUserId, name: 'Sarah Chen', username: 'sarah' },
      error: null,
    })
    mocks.adminClient.from
      .mockReturnValueOnce(eventQuery)
      .mockReturnValueOnce(profileQuery)
    mocks.runBookingAgentTurn.mockRejectedValue(
      new BookingAgentGatewayError('Payment required', 402)
    )

    const response = await POST(requestWithJson(validBody) as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reply).toBe('I checked that date directly.')
    expect(mocks.runBookingAgentFallbackTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining(validBody),
      })
    )
  })

  it('rejects invalid message payloads', async () => {
    const response = await POST(
      requestWithJson({ ...validBody, messages: [] }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(mocks.consumePublicRateLimit).not.toHaveBeenCalled()
  })
})
