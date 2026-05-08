import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'
import { processWebhookDeliveriesBatch } from '@/lib/webhooks/deliveries'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/webhooks/deliveries', () => ({
  processWebhookDeliveriesBatch: vi.fn(),
}))

function requestWithJson(body: unknown, token = 'secret') {
  return new Request('http://localhost/api/webhooks/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/process', () => {
  const originalSecret = process.env.WEBHOOK_PROCESS_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WEBHOOK_PROCESS_SECRET = 'secret'
    process.env.CRON_SECRET = undefined
    vi.mocked(processWebhookDeliveriesBatch).mockResolvedValue({
      claimed: 1,
      delivered: 1,
      failed: 0,
    })
  })

  afterEach(() => {
    process.env.WEBHOOK_PROCESS_SECRET = originalSecret
    process.env.CRON_SECRET = originalCronSecret
  })

  it('requires the configured bearer token', async () => {
    const response = await POST(requestWithJson({}, 'wrong') as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
    expect(processWebhookDeliveriesBatch).not.toHaveBeenCalled()
  })

  it('processes webhook deliveries with bounded batch options', async () => {
    const response = await POST(
      requestWithJson({ limit: 500, maxAttempts: 0 }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      claimed: 1,
      delivered: 1,
      failed: 0,
    })
    expect(processWebhookDeliveriesBatch).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 50,
      maxAttempts: 1,
    })
  })

  it('accepts Vercel cron GET requests authenticated by CRON_SECRET', async () => {
    process.env.WEBHOOK_PROCESS_SECRET = undefined
    process.env.CRON_SECRET = 'cron-secret'

    const response = await GET(
      new Request(
        'http://localhost/api/webhooks/process?limit=8&maxAttempts=4',
        {
          headers: { Authorization: 'Bearer cron-secret' },
        }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      claimed: 1,
      delivered: 1,
      failed: 0,
    })
    expect(processWebhookDeliveriesBatch).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 8,
      maxAttempts: 4,
    })
  })
})
