import { describe, expect, it, vi } from 'vitest'
import {
  consumePublicRateLimit,
  publicRateLimitResponse,
} from '@/lib/security/rate-limit'

describe('public rate limiting', () => {
  it('consumes a database-backed limit using a hashed request fingerprint', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        allowed: true,
        limit_count: 120,
        remaining: 119,
        reset_at: '2026-06-01T00:01:00.000Z',
        retry_after_seconds: 0,
      },
      error: null,
    })
    const rpc = vi.fn((_name: string, _args: Record<string, unknown>) => ({
      single,
    }))
    const adminClient = { rpc } as any
    const request = new Request('http://localhost/api/slots', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'booking-test',
      },
    })

    const result = await consumePublicRateLimit({
      request: request as any,
      adminClient,
      config: {
        scope: 'list-slots',
        limit: 120,
        windowSeconds: 60,
        identifierParts: ['event-type-1'],
      },
    })

    expect(result.allowed).toBe(true)
    expect(rpc).toHaveBeenCalledWith(
      'consume_public_rate_limit',
      expect.objectContaining({
        p_scope: 'list-slots',
        p_limit_count: 120,
        p_window_seconds: 60,
        p_identifier_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
    expect(rpc.mock.calls.length).toBeGreaterThan(0)
    const args = rpc.mock.calls[0][1]
    expect(String(args.p_identifier_hash)).not.toContain('203.0.113.10')
    expect(String(args.p_identifier_hash)).not.toContain('booking-test')
  })

  it('returns retry metadata on rate-limited responses', () => {
    const response = publicRateLimitResponse({
      allowed: false,
      status: 429,
      error: 'Too many requests. Please retry after the rate limit resets.',
      limit: 20,
      remaining: 0,
      resetAt: '2026-06-01T00:05:00.000Z',
      retryAfterSeconds: 45,
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('45')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('20')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})
