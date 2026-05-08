import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
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

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WEBHOOK_PROCESS_SECRET = 'secret'
    vi.mocked(processWebhookDeliveriesBatch).mockResolvedValue({
      claimed: 1,
      delivered: 1,
      failed: 0,
    })
  })

  afterEach(() => {
    process.env.WEBHOOK_PROCESS_SECRET = originalSecret
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
})
