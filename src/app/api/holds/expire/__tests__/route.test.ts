import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'
import { expireStaleSlotHolds } from '@/lib/booking/hold-expiry'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/booking/hold-expiry', () => ({
  expireStaleSlotHolds: vi.fn(),
}))

function request(
  method: 'GET' | 'POST',
  {
    body,
    headers = {},
    query = '',
  }: {
    body?: unknown
    headers?: Record<string, string>
    query?: string
  } = {}
) {
  return new Request(`http://localhost/api/holds/expire${query}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/holds/expire', () => {
  const originalHoldSecret = process.env.HOLD_EXPIRY_PROCESS_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HOLD_EXPIRY_PROCESS_SECRET = 'hold-secret'
    process.env.CRON_SECRET = undefined
    vi.mocked(expireStaleSlotHolds).mockResolvedValue({
      expiredHolds: 3,
      expiredReservations: 2,
    })
  })

  afterEach(() => {
    process.env.HOLD_EXPIRY_PROCESS_SECRET = originalHoldSecret
    process.env.CRON_SECRET = originalCronSecret
  })

  it('rejects unauthorized worker requests', async () => {
    const response = await POST(request('POST', { body: { limit: 5 } }) as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
    expect(expireStaleSlotHolds).not.toHaveBeenCalled()
  })

  it('expires stale holds and reservations with a bounded POST limit', async () => {
    const response = await POST(
      request('POST', {
        body: { limit: 5000 },
        headers: { Authorization: 'Bearer hold-secret' },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      expiredHolds: 3,
      expiredReservations: 2,
    })
    expect(expireStaleSlotHolds).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 1000,
    })
  })

  it('accepts Vercel cron GET requests authenticated by CRON_SECRET', async () => {
    process.env.HOLD_EXPIRY_PROCESS_SECRET = undefined
    process.env.CRON_SECRET = 'cron-secret'

    const response = await GET(
      request('GET', {
        query: '?limit=25',
        headers: { Authorization: 'Bearer cron-secret' },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.expiredHolds).toBe(3)
    expect(expireStaleSlotHolds).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 25,
    })
  })
})
